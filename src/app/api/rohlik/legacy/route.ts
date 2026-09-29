import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rohlikConfigured, storeRohlikConnection, type LegacyRohlikCredentials } from "@/lib/rohlik-oauth";
import { verifyLegacyRohlikCredentials } from "@/lib/rohlik-mcp";

export const runtime = "nodejs";

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
});

export async function POST(req: NextRequest) {
  if (!rohlikConfigured()) return NextResponse.json({ error: "Není nastavený šifrovací klíč Rohlik." }, { status: 503 });
  if (req.headers.get("origin") !== req.nextUrl.origin || !req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 403 });
  }
  const body = await req.text();
  if (body.length > 4096) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 413 });
  let parsedBody: unknown;
  try { parsedBody = JSON.parse(body); } catch { return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 }); }
  const parsed = schema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ error: "Zadej platný e-mail a heslo." }, { status: 400 });

  const credentials: LegacyRohlikCredentials = { kind: "legacy", email: parsed.data.email, password: parsed.data.password };
  try {
    await verifyLegacyRohlikCredentials(credentials);
    await storeRohlikConnection(credentials);
    return NextResponse.json({ connected: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Rohlik legacy připojení se nepodařilo. Ověř přihlašovací údaje nebo potvrď nové přihlášení u Rohlik." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
