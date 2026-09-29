import { NextRequest, NextResponse } from "next/server";
import { finishRohlikAuthorization } from "@/lib/rohlik-oauth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (error || !code || !state) {
    return NextResponse.redirect(new URL("/plan?rohlik=cancelled", req.url));
  }
  try {
    await finishRohlikAuthorization(code, state, params.get("iss") ?? undefined);
    return NextResponse.redirect(new URL("/plan?rohlik=connected", req.url));
  } catch {
    return NextResponse.redirect(new URL("/plan?rohlik=failed", req.url));
  }
}
