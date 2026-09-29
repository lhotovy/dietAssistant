import { NextResponse } from "next/server";
import { beginRohlikAuthorization, rohlikOAuthConfigured, RohlikRegistrationError } from "@/lib/rohlik-oauth";

export const runtime = "nodejs";

export async function GET() {
  if (!rohlikOAuthConfigured()) {
    return NextResponse.json({ error: "Připojení Rohlik není nakonfigurované." }, { status: 503 });
  }
  try {
    return NextResponse.redirect(await beginRohlikAuthorization());
  } catch (cause) {
    if (cause instanceof RohlikRegistrationError && cause.redirectRejected) {
      const base = process.env.APP_BASE_URL;
      if (base) return NextResponse.redirect(new URL("/plan?rohlik=unsupported-domain", base));
    }
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Připojení selhalo." }, { status: 502 });
  }
}
