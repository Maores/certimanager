// src/lib/supabase/auth.ts
import { cache } from "react";
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
