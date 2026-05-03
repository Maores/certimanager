// src/app/dashboard/candidates/leads-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function authedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Mark a lead as read (clears the unread tint). Idempotent. */
export async function markLeadRead(id: string): Promise<void> {
  const { supabase, user } = await authedClient();
  await supabase
    .from("course_candidates")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("manager_id", user.id)
    .is("read_at", null);
  revalidatePath("/dashboard/candidates");
}

type LeadField = "city" | "notes" | "status" | "police_clearance_status" | "cert_type_id";
type LeadFieldValue = string | null;

/** Update a single lead field; also stamps read_at if it was null. */
export async function updateLeadField(
  id: string,
  field: LeadField,
  value: LeadFieldValue
): Promise<void> {
  const { supabase, user } = await authedClient();
  const updates: Record<string, unknown> = {
    [field]: value,
    read_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("course_candidates")
    .update(updates)
    .eq("id", id)
    .eq("manager_id", user.id);
  if (error) {
    // The course_candidates table has UNIQUE(manager_id, id_number, cert_type_id).
    // Assigning a cert_type_id to a lead whose id_number already has a candidate
    // row with the same cert_type_id violates that constraint — surface a Hebrew
    // message so the manager isn't left wondering why the dropdown reverted.
    if (
      field === "cert_type_id" &&
      (error.code === "23505" ||
        /duplicate key|unique constraint/i.test(error.message))
    ) {
      throw new Error(
        "אדם זה כבר רשום לקורס הזה. בדוק את לשונית 'מועמדים'."
      );
    }
    throw new Error(`עדכון נכשל: ${error.message}`);
  }
  revalidatePath("/dashboard/candidates");
}
