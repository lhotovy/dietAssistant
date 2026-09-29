import assert from "node:assert/strict";
import test from "node:test";
import { verifyLegacyRohlikCredentials } from "../src/lib/rohlik-mcp";

test("legacy MCP login verifies tools and sends credentials only to Rohlik", async () => {
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "https://mcp.rohlik.cz/mcp");
    assert.equal(new Headers(init?.headers).get("rhl-email"), "test@example.com");
    assert.equal(new Headers(init?.headers).get("rhl-pass"), "example-password");
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    const request = JSON.parse(String(init?.body)) as { method: string; id?: number };
    methods.push(request.method);
    if (request.method === "notifications/initialized") return new Response(null, { status: 202 });
    return Response.json({ jsonrpc: "2.0", id: request.id, result: request.method === "tools/list" ? { tools: [] } : { protocolVersion: "2025-06-18" } });
  };
  try {
    await verifyLegacyRohlikCredentials({ kind: "legacy", email: "test@example.com", password: "example-password" });
    assert.deepEqual(methods, ["initialize", "notifications/initialized", "tools/list"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy MCP login rejects an unauthorized response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  try {
    await assert.rejects(verifyLegacyRohlikCredentials({ kind: "legacy", email: "test@example.com", password: "wrong" }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
