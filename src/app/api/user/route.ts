import { NextResponse } from "next/server";
import { ensureUserCookie } from "@/lib/user";

// Called on first load to establish anonymous user session cookie
export async function POST() {
  const userId = await ensureUserCookie();
  return NextResponse.json({ userId });
}
