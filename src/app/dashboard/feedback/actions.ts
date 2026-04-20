"use server";

import { requireUser } from "@/lib/supabase/auth";

const CATEGORIES = new Set(["bug", "suggestion", "question", "other"]);

type ActionResult = { ok: true } | { error: string };

export async function submitFeedback(formData: FormData): Promise<ActionResult> {
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const route = String(formData.get("route") ?? "").trim();
  const viewportRaw = String(formData.get("viewport") ?? "").trim();
  const uaRaw = String(formData.get("user_agent") ?? "").trim();
  const viewport = viewportRaw || null;
  const user_agent = uaRaw || null;

  if (!description) return { error: "תיאור הוא שדה חובה" };
  if (description.length > 2000) return { error: "התיאור ארוך מדי (מעל 2000 תווים)" };
  if (!CATEGORIES.has(category)) return { error: "קטגוריה לא חוקית" };
  if (!route) return { error: "נתיב דף חסר" };

  const { user, supabase } = await requireUser();

  const { error } = await supabase.from("feedback").insert({
    manager_id: user.id,
    category,
    description,
    route,
    viewport,
    user_agent,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function markFeedbackRead(id: string): Promise<ActionResult> {
  if (!id) return { error: "id חסר" };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("feedback")
    .update({ is_read: true })
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteFeedback(id: string): Promise<ActionResult> {
  if (!id) return { error: "id חסר" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
