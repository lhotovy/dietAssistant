import { NextResponse } from "next/server";
import { beginRohlikAuthorization, rohlikConfigured } from "@/lib/rohlik-oauth";

export const runtime = "nodejs";

export async function GET() {
  if (!rohlikConfigured()) {
    return NextResponse.json({ error: "Připojení Rohlik není nakonfigurované." }, { status: 503 });
  }
  try {
    return NextResponse.redirect(await beginRohlikAuthorization());
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Připojení selhalo." }, { status: 502 });
  }
}
