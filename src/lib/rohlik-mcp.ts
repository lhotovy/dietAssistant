import { getRohlikConnection, saveRohlikConversationId, type LegacyRohlikCredentials, type RohlikCredentials } from "@/lib/rohlik-oauth";

const MCP_URL = "https://mcp.rohlik.cz/mcp";
type JsonRpcResult = { jsonrpc: "2.0"; id?: number; result?: unknown; error?: { message?: string } };

async function parseMcpResponse(response: Response, id: number, legacy: boolean): Promise<JsonRpcResult> {
  const contentType = response.headers.get("content-type") ?? "";
  const raw = await response.text();
  if (!response.ok) throw new Error(response.status === 401 ? (legacy ? "Rohlik odmítl legacy přihlášení. Odpoj a připoj účet znovu." : "Připojení Rohlik vypršelo. Připoj účet znovu.") : `Rohlik MCP vrátil HTTP ${response.status}.`);
  if (contentType.includes("text/event-stream")) {
    const events = raw.split(/\r?\n\r?\n/);
    for (const event of events) {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
      if (!data) continue;
      const parsed = JSON.parse(data) as JsonRpcResult;
      if (parsed.id === id) return parsed;
    }
    throw new Error("Rohlik MCP nevrátil odpověď na požadavek.");
  }
  return JSON.parse(raw) as JsonRpcResult;
}

function authHeaders(credentials: RohlikCredentials): Record<string, string> {
  return credentials.kind === "legacy"
    ? { "rhl-email": credentials.email, "rhl-pass": credentials.password }
    : { Authorization: `Bearer ${credentials.accessToken}` };
}

async function request(credentials: RohlikCredentials, method: string, params: unknown, id: number, sessionId?: string): Promise<{ result: unknown; sessionId?: string }> {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      ...authHeaders(credentials),
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-06-18",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const rpc = await parseMcpResponse(response, id, credentials.kind === "legacy");
  if (rpc.error) throw new Error(rpc.error.message ?? "Rohlik MCP volání selhalo.");
  return { result: rpc.result, sessionId: response.headers.get("Mcp-Session-Id") ?? sessionId };
}

async function notifyInitialized(credentials: RohlikCredentials, sessionId?: string): Promise<void> {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      ...authHeaders(credentials),
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-06-18",
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Rohlik MCP odmítl inicializaci.");
}

function decodeToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const value = result as { isError?: boolean; content?: { type?: string; text?: string }[]; structuredContent?: unknown };
  if (value.isError) throw new Error(value.content?.find((part) => part.type === "text")?.text ?? "Rohlik nástroj selhal.");
  if (value.structuredContent !== undefined) return value.structuredContent;
  const text = value.content?.find((part) => part.type === "text")?.text;
  if (!text) return result;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function extractConversationId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const object = value as Record<string, unknown>;
  if (typeof object.conversation_id === "string") return object.conversation_id;
  if (typeof object.conversationId === "string") return object.conversationId;
  for (const nested of Object.values(object)) {
    const id = extractConversationId(nested);
    if (id) return id;
  }
  return undefined;
}

export async function callRohlikTool(name: string, argumentsWithoutConversation: Record<string, unknown>): Promise<unknown> {
  const connection = await getRohlikConnection();
  if (!connection) throw new Error("Nejdříve připoj účet Rohlik.");
  const { credentials } = connection;
  const initialized = await request(credentials, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "diet-assistant", version: "0.1.0" },
  }, 1);
  await notifyInitialized(credentials, initialized.sessionId);
  const result = await request(credentials, "tools/call", {
    name,
    arguments: {
      ...argumentsWithoutConversation,
      ...(credentials.conversationId ? { conversation_id: credentials.conversationId } : {}),
    },
  }, 2, initialized.sessionId);
  const decoded = decodeToolResult(result.result);
  const conversationId = extractConversationId(decoded) ?? extractConversationId(result.result);
  if (conversationId && conversationId !== credentials.conversationId) {
    try {
      await saveRohlikConversationId(connection.id, credentials, conversationId);
    } catch {
      // The tool may already have changed the cart. Preserve its response.
    }
  }
  return decoded;
}

export async function verifyLegacyRohlikCredentials(credentials: LegacyRohlikCredentials): Promise<void> {
  const initialized = await request(credentials, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "diet-assistant", version: "0.1.0" },
  }, 1);
  await notifyInitialized(credentials, initialized.sessionId);
  const listed = await request(credentials, "tools/list", {}, 2, initialized.sessionId);
  if (!listed.result || typeof listed.result !== "object" || !("tools" in listed.result)) {
    throw new Error("Rohlik nepotvrdil legacy MCP připojení.");
  }
}
