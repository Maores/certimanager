"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createGuestSession, clearGuestSessionCookie, getGuestSessionId } from "@/lib/guest-session";
import { clearGuestSession } from "@/lib/guest-store";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "אימייל או סיסמה שגויים", email: email };
  }

  redirect("/dashboard");
}

export async function guestLogin() {
  await createGuestSession();
  redirect("/dashboard");
}

export async function logout() {
  // Clear guest session if exists
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    clearGuestSession(guestSid);
    await clearGuestSessionCookie();
    redirect("/login");
  }

  // Regular Supabase logout
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
