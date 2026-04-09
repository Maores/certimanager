/**
 * Guest session helpers.
 * Uses a simple cookie to track guest sessions.
 * Works with Next.js server components and server actions.
 */

import { cookies } from "next/headers";
import { hasGuestSession } from "@/lib/guest-store";

const GUEST_COOKIE = "guest_session";

/**
 * Check if the current request is a guest session.
 * Validates the cookie value against the server-side sessions Map.
 */
export async function isGuestSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(GUEST_COOKIE)?.value;
  if (!sid) return false;
  return hasGuestSession(sid);
}

/**
 * Get the guest session ID, or null if not a guest.
 * Validates the cookie value against the server-side sessions Map.
 */
export async function getGuestSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(GUEST_COOKIE)?.value ?? null;
  if (!sid) return null;
  return hasGuestSession(sid) ? sid : null;
}

/**
 * Create a new guest session. Returns the session ID.
 */
export async function createGuestSession(): Promise<string> {
  const cookieStore = await cookies();
  const sessionId = `guest-${crypto.randomUUID()}`;
  cookieStore.set(GUEST_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Session cookie — no maxAge, expires when browser closes
  });
  return sessionId;
}

/**
 * Clear the guest session cookie and in-memory data.
 */
export async function clearGuestSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(GUEST_COOKIE)?.value ?? null;
  cookieStore.delete(GUEST_COOKIE);
  return sid;
}
