import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const AUTH_ORIGIN = "https://identity.rohlik.cz";
const METADATA_URL = `${AUTH_ORIGIN}/.well-known/oauth-authorization-server`;
const FLOW_COOKIE = "rohlik_oauth_flow";
const CONNECTION_COOKIE = "rohlik_connection";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type AuthorizationMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
};

export type RohlikCredentials = {
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  conversationId?: string;
};

type PendingFlow = {
  state: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
};

export class RohlikRegistrationError extends Error {
  constructor(public readonly redirectRejected: boolean, message: string) {
    super(message);
    this.name = "RohlikRegistrationError";
  }
}

function encryptionKey(): Buffer {
  const key = Buffer.from(process.env.ROHLIK_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("ROHLIK_TOKEN_ENCRYPTION_KEY musí mít 32 bajtů v base64.");
  return key;
}

export function rohlikConfigured(): boolean {
  try {
    encryptionKey();
    return Boolean(process.env.APP_BASE_URL);
  } catch {
    return false;
  }
}

function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL;
  if (!raw) throw new Error("APP_BASE_URL není nastavené.");
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("APP_BASE_URL musí být samotný veřejný origin aplikace.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("APP_BASE_URL musí používat HTTPS.");
  }
  return url.origin;
}

async function metadata(): Promise<AuthorizationMetadata> {
  const response = await fetch(METADATA_URL, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Nepodařilo se načíst autorizaci Rohlik.");
  const value = await response.json() as AuthorizationMetadata;
  if (value.issuer !== AUTH_ORIGIN) throw new Error("Neplatný vydavatel Rohlik OAuth.");
  for (const endpoint of [value.authorization_endpoint, value.token_endpoint, value.registration_endpoint]) {
    if (new URL(endpoint).origin !== AUTH_ORIGIN) throw new Error("Neplatný Rohlik OAuth endpoint.");
  }
  return value;
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function registeredClientSecret(): string | undefined {
  return process.env.ROHLIK_OAUTH_CLIENT_ID ? process.env.ROHLIK_OAUTH_CLIENT_SECRET : undefined;
}

export async function beginRohlikAuthorization(): Promise<string> {
  encryptionKey();
  const endpoints = await metadata();
  const redirectUri = `${appBaseUrl()}/api/rohlik/callback`;
  let clientId = process.env.ROHLIK_OAUTH_CLIENT_ID;
  if (!clientId) {
    const registration = await fetch(endpoints.registration_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Diet Assistant",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!registration.ok) {
      const body = await registration.text();
      let description = "";
      try { description = (JSON.parse(body) as { error_description?: string }).error_description ?? ""; } catch { /* non-JSON error */ }
      const redirectRejected = description.includes("Redirect URI is not allowed for dynamic client registration");
      throw new RohlikRegistrationError(
        redirectRejected,
        redirectRejected
          ? `Rohlik nepovoluje OAuth callback ${redirectUri} pro dynamickou registraci klienta.`
          : `Rohlik odmítl registraci OAuth klienta (HTTP ${registration.status}${description ? `: ${description.slice(0, 200)}` : ""}).`
      );
    }
    const client = await registration.json() as { client_id?: string };
    clientId = client.client_id;
    if (!clientId) throw new Error("Rohlik nevrátil OAuth client_id.");
  }

  const flow: PendingFlow = {
    state: base64url(randomBytes(32)),
    verifier: base64url(randomBytes(32)),
    clientId,
    redirectUri,
  };
  (await cookies()).set(FLOW_COOKIE, JSON.stringify(flow), { ...COOKIE_OPTIONS, maxAge: 600 });
  const challenge = createHash("sha256").update(flow.verifier).digest("base64url");
  const url = new URL(endpoints.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", flow.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", flow.state);
  url.searchParams.set("resource", "https://mcp.rohlik.cz/mcp");
  return url.toString();
}

export async function finishRohlikAuthorization(code: string, state: string, issuer?: string): Promise<void> {
  if (issuer && issuer !== AUTH_ORIGIN) throw new Error("Nesouhlasí vydavatel OAuth odpovědi.");
  const cookieStore = await cookies();
  const raw = cookieStore.get(FLOW_COOKIE)?.value;
  cookieStore.delete(FLOW_COOKIE);
  if (!raw) throw new Error("Připojení vypršelo. Začni znovu.");
  let flow: PendingFlow;
  try { flow = JSON.parse(raw) as PendingFlow; } catch { throw new Error("Neplatný stav připojení."); }
  if (state !== flow.state || flow.redirectUri !== `${appBaseUrl()}/api/rohlik/callback`) {
    throw new Error("Nesouhlasí stav OAuth připojení.");
  }
  const endpoints = await metadata();
  const response = await fetch(endpoints.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: flow.clientId,
      ...(registeredClientSecret() ? { client_secret: registeredClientSecret() } : {}),
      redirect_uri: flow.redirectUri,
      code_verifier: flow.verifier,
      resource: "https://mcp.rohlik.cz/mcp",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Rohlik nevydal přístupový token.");
  const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokens.access_token) throw new Error("Chybí přístupový token Rohlik.");

  const connectionSecret = base64url(randomBytes(32));
  const credentials: RohlikCredentials = {
    clientId: flow.clientId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
  };
  const previousSecret = cookieStore.get(CONNECTION_COOKIE)?.value;
  if (previousSecret) {
    const oldId = connectionId(previousSecret);
    await prisma.$transaction([
      prisma.rohlikProductPreference.deleteMany({ where: { connectionId: oldId } }),
      prisma.rohlikConnection.deleteMany({ where: { id: oldId } }),
    ]);
  }
  await prisma.rohlikConnection.create({ data: {
    id: connectionId(connectionSecret),
    credentials: encrypt(credentials),
  } });
  cookieStore.set(CONNECTION_COOKIE, connectionSecret, { ...COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 365 });
}

function connectionId(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function encrypt(value: RohlikCredentials): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(base64url).join(".");
}

function decrypt(value: string): RohlikCredentials {
  const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")) as RohlikCredentials;
}

export async function getRohlikConnection(): Promise<{ id: string; credentials: RohlikCredentials } | null> {
  const secret = (await cookies()).get(CONNECTION_COOKIE)?.value;
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  const id = connectionId(secret);
  const stored = await prisma.rohlikConnection.findUnique({ where: { id } });
  if (!stored) return null;
  let credentials = decrypt(stored.credentials);
  if (credentials.expiresAt && credentials.expiresAt < Date.now() + 60_000 && credentials.refreshToken) {
    const endpoints = await metadata();
    const response = await fetch(endpoints.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: credentials.clientId,
        ...(registeredClientSecret() ? { client_secret: registeredClientSecret() } : {}),
        resource: "https://mcp.rohlik.cz/mcp",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Připojení Rohlik vypršelo. Připoj účet znovu.");
    const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tokens.access_token) throw new Error("Rohlik nevrátil nový token.");
    credentials = {
      ...credentials,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? credentials.refreshToken,
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
    };
    await prisma.rohlikConnection.update({ where: { id }, data: { credentials: encrypt(credentials) } });
  }
  return { id, credentials };
}

export async function disconnectRohlik(): Promise<void> {
  const cookieStore = await cookies();
  const secret = cookieStore.get(CONNECTION_COOKIE)?.value;
  if (secret) {
    const id = connectionId(secret);
    await prisma.$transaction([
      prisma.rohlikProductPreference.deleteMany({ where: { connectionId: id } }),
      prisma.rohlikConnection.deleteMany({ where: { id } }),
    ]);
  }
  cookieStore.delete(CONNECTION_COOKIE);
}

export async function saveRohlikConversationId(id: string, credentials: RohlikCredentials, conversationId: string): Promise<void> {
  await prisma.rohlikConnection.update({
    where: { id },
    data: { credentials: encrypt({ ...credentials, conversationId }) },
  });
}
