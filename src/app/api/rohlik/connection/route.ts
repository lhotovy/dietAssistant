import { NextResponse } from "next/server";
import { disconnectRohlik, getRohlikConnection, rohlikConfigured, rohlikOAuthConfigured } from "@/lib/rohlik-oauth";

export const runtime = "nodejs";

export async function GET() {
  if (!rohlikConfigured()) return NextResponse.json({ configured: false, oauthConfigured: false, connected: false });
  try {
    const connection = await getRohlikConnection();
    return NextResponse.json({ configured: true, oauthConfigured: rohlikOAuthConfigured(), connected: Boolean(connection), method: connection?.credentials.kind === "legacy" ? "legacy" : connection ? "oauth" : null });
  } catch {
    return NextResponse.json({ configured: true, oauthConfigured: rohlikOAuthConfigured(), connected: false, error: "Připojení vypršelo." });
  }
}

export async function DELETE() {
  await disconnectRohlik();
  return NextResponse.json({ connected: false });
}
