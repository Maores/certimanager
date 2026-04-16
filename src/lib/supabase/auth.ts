// src/lib/supabase/auth.ts
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Returns the authenticated Supabase user for the current request, or null.
 *
 * Wrapped in React's `cache()` so every server component within a single
 * render tree shares ONE network round-trip to Supabase, even when layout
 * and page both need the user.
 *
 * Use this ANYWHERE a server component needs the user — never call
 * `supabase.auth.getUser()` directly in a server component.
 *
 * Note: Middleware runs in Edge runtime and cannot share this cache.
 * Middleware keeps its own `getUser()` call as the security gate.
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Returns `{ user, supabase }` for an authenticated request, otherwise
 * redirects to `/login`. `redirect()` throws `NEXT_REDIRECT` which Next.js
 * handles, so the return statement only runs when `user` is non-null —
 * TypeScript narrows the return type accordingly, letting callers use
 * `user.id` without a non-null assertion.
 *
 * Use this in server components that need both the user and a Supabase
 * client. Reuses the `cache()`d `getAuthenticatedUser` so layout and page
 * still share one auth round-trip.
 */
export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  return { user, supabase };
}
