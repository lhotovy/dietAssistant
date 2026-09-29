import { NextResponse } from "next/server";
import { disconnectRohlik, getRohlikConnection, rohlikConfigured } from "@/lib/rohlik-oauth";

export const runtime = "nodejs";

export async function GET() {
  if (!rohlikConfigured()) return NextResponse.json({ configured: false, connected: false });
  try {
    const connection = await getRohlikConnection();
    return NextResponse.json({ configured: true, connected: Boolean(connection) });
  } catch {
    return NextResponse.json({ configured: true, connected: false, error: "Připojení vypršelo." });
  }
}

export async function DELETE() {
  await disconnectRohlik();
  return NextResponse.json({ connected: false });
}
