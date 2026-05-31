import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const USER_COOKIE = "diet_user_id";

/** Stable anonymous user id; creates and persists the cookie when missing. */
export async function getUserId(): Promise<string> {
  return ensureUserCookie();
}

export async function ensureUserCookie(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE);
  if (existing?.value) return existing.value;
  const id = randomUUID();
  cookieStore.set(USER_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365 * 5, // 5 years
    path: "/",
  });
  return id;
}
