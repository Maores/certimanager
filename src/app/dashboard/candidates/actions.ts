"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CandidateStatus } from "@/types/database";
import { parseCandidateExcel, type ParsedCandidate } from "@/lib/candidate-parser";

function mapSupabaseError(msg: string): string {
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
    if (msg.includes("id_number")) return "מועמד עם ת.ז זו כבר רשום לקורס זה";
    return "רשומה כפולה — המועמד כבר קיים";
  }
  if (msg.includes("foreign key")) {
    if (msg.includes("cert_type_id")) return "סוג ההסמכה שנבחר אינו קיים";
    return "לא ניתן לבצע את הפעולה — קיימים נתונים תלויים";
  }
  return "שגיאה בשמירת הנתונים. נסה שוב";
}

export async function checkEmployeeByIdNumber(idNumber: string): Promise<{ found: boolean; name?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { found: false };

  const { data } = await supabase
    .from("employees")
    .select("first_name, last_name")
    .eq("manager_id", user.id)
    .eq("employee_number", idNumber)
    .maybeSingle();

  if (data) return { found: true, name: `${data.first_name} ${data.last_name}` };
  return { found: false };
}

export async function createCandidate(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const first_name = (formData.get("first_name") as string || "").trim();
  const last_name = (formData.get("last_name") as string || "").trim();
  const id_number = (formData.get("id_number") as string || "").trim();
  const phone = (formData.get("phone") as string || "").trim() || null;
  const city = (formData.get("city") as string || "").trim() || null;
  const cert_type_id = (formData.get("cert_type_id") as string || "").trim();
  const status = (formData.get("status") as string || "ממתין").trim() as CandidateStatus;
  const notes = (formData.get("notes") as string || "").trim() || null;

  if (!first_name) throw new Error("שם פרטי הוא שדה חובה");
  if (!last_name) throw new Error("שם משפחה הוא שדה חובה");
  if (!id_number) throw new Error("ת.ז הוא שדה חובה");
  if (!cert_type_id) throw new Error("סוג הסמכה הוא שדה חובה");

  const { error } = await supabase.from("course_candidates").insert({
    manager_id: user.id,
    first_name, last_name, id_number, phone, city,
    cert_type_id, status, notes,
  });

  if (error) throw new Error(mapSupabaseError(error.message));
  revalidatePath("/dashboard/candidates");
  redirect("/dashboard/candidates");
}

export async function updateCandidateStatus(id: string, status: CandidateStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("course_candidates")
    .update({ status })
    .eq("id", id)
    .eq("manager_id", user.id);

  if (error) throw new Error(mapSupabaseError(error.message));
  revalidatePath("/dashboard/candidates");
}

export async function deleteCandidate(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("course_candidates")
    .delete()
    .eq("id", id)
    .eq("manager_id", user.id);

  if (error) throw new Error(mapSupabaseError(error.message));
  revalidatePath("/dashboard/candidates");
}

export async function promoteCandidate(id: string): Promise<{
  status: "promoted" | "already_employee";
  name: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch candidate
  const { data: candidate, error: fetchErr } = await supabase
    .from("course_candidates")
    .select("*, cert_types(name)")
    .eq("id", id)
    .eq("manager_id", user.id)
    .single();

  if (fetchErr || !candidate) throw new Error("מועמד לא נמצא");

  // Upsert employee by id_number
  const { data: existingEmp } = await supabase
    .from("employees")
    .select("id")
    .eq("manager_id", user.id)
    .eq("employee_number", candidate.id_number)
    .maybeSingle();

  // Detect redundant re-promotion: employee already exists AND candidate was
  // already marked "הוסמך" before this call. Real promotions (new employee,
  // or existing employee whose candidate status wasn't yet "הוסמך") proceed normally.
  const wasAlreadyPromoted =
    Boolean(existingEmp) && candidate.status === "הוסמך";

  let employeeId: string;

  if (existingEmp) {
    // Update existing — always update name, fill blank phone
    const { data: empData } = await supabase
      .from("employees")
      .select("first_name, last_name, phone")
      .eq("id", existingEmp.id)
      .single();

    const updates: Record<string, string> = {
      first_name: candidate.first_name,
      last_name: candidate.last_name,
    };
    // Only update phone if existing is blank
    if ((!empData?.phone || empData.phone.trim() === "") && candidate.phone) {
      updates.phone = candidate.phone;
    }
    await supabase.from("employees").update(updates)
      .eq("id", existingEmp.id).eq("manager_id", user.id);

    employeeId = existingEmp.id;
  } else {
    // Create new employee. employees.phone is NOT NULL DEFAULT '' — coerce null to ''.
    const { data: newEmp, error: empErr } = await supabase
      .from("employees")
      .insert({
        manager_id: user.id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        employee_number: candidate.id_number,
        phone: candidate.phone ?? "",
        status: "פעיל",
      })
      .select("id")
      .single();

    if (empErr || !newEmp) throw new Error("שגיאה ביצירת עובד: " + (empErr?.message || ""));
    employeeId = newEmp.id;
  }

  // Create certification (unique index prevents duplicates)
  const { error: certErr } = await supabase
    .from("certifications")
    .upsert({
      employee_id: employeeId,
      cert_type_id: candidate.cert_type_id,
      issue_date: new Date().toISOString().split("T")[0],
    }, { onConflict: "employee_id,cert_type_id" });

  if (certErr) throw new Error("שגיאה ביצירת הסמכה: " + certErr.message);

  // Update candidate status
  await supabase
    .from("course_candidates")
    .update({ status: "הוסמך" as CandidateStatus })
    .eq("id", id)
    .eq("manager_id", user.id);

  revalidatePath("/dashboard/candidates");
  revalidatePath("/dashboard/employees");

  return {
    status: wasAlreadyPromoted ? "already_employee" : "promoted",
    name: `${candidate.first_name} ${candidate.last_name}`,
  };
}

export async function promoteCandidates(ids: string[]) {
  const results = {
    promoted: 0,
    already_employee: 0,
    errors: [] as string[],
  };

  for (const id of ids) {
    try {
      const r = await promoteCandidate(id);
      if (r.status === "already_employee") results.already_employee++;
      else results.promoted++;
    } catch (e) {
      results.errors.push(`${id}: ${e instanceof Error ? e.message : "שגיאה"}`);
    }
  }

  revalidatePath("/dashboard/candidates");
  revalidatePath("/dashboard/employees");
  return results;
}

// --- Import actions ---

export interface CandidateImportPreview {
  candidates: (ParsedCandidate & { existsInDb: boolean })[];
  skipped: { row: number; reason: string }[];
  totalRows: number;
  certTypeMap: Record<string, string>;
}

export async function parseCandidateFile(formData: FormData): Promise<{
  success: boolean;
  data?: CandidateImportPreview;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "לא מחובר" };

  const file = formData.get("file") as File;
  if (!file || !file.name.endsWith(".xlsx")) {
    return { success: false, error: "יש להעלות קובץ .xlsx" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "גודל הקובץ חורג מ-5MB" };
  }

  const buffer = await file.arrayBuffer();
  const result = parseCandidateExcel(buffer);

  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("id, name")
    .eq("manager_id", user.id);

  const certTypeMap: Record<string, string> = {};
  for (const ct of certTypes || []) {
    certTypeMap[ct.name] = ct.id;
  }

  const idNumbers = result.candidates.map(c => c.id_number);
  const { data: existing } = await supabase
    .from("course_candidates")
    .select("id_number, cert_type_id")
    .eq("manager_id", user.id)
    .in("id_number", idNumbers.length > 0 ? idNumbers : ["__none__"]);

  const existingSet = new Set(
    (existing || []).map(e => `${e.id_number}:${e.cert_type_id}`)
  );

  const enriched = result.candidates.map(c => {
    const certId = c.cert_type_name ? certTypeMap[c.cert_type_name] : undefined;
    return {
      ...c,
      existsInDb: certId ? existingSet.has(`${c.id_number}:${certId}`) : false,
    };
  });

  return {
    success: true,
    data: {
      candidates: enriched,
      skipped: result.skipped,
      totalRows: result.totalRows,
      certTypeMap,
    },
  };
}

export interface CandidateImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export async function executeCandidateImport(
  candidates: { first_name: string; last_name: string; id_number: string; phone: string | null; city: string | null; cert_type_id: string; status: string; notes: string | null }[]
): Promise<CandidateImportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("לא מחובר");

  const result: CandidateImportResult = { imported: 0, skipped: 0, errors: [] };
  const BATCH = 50;

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH).map(c => ({
      manager_id: user.id,
      first_name: c.first_name,
      last_name: c.last_name,
      id_number: c.id_number,
      phone: c.phone,
      city: c.city,
      cert_type_id: c.cert_type_id,
      status: c.status || "ממתין",
      notes: c.notes,
    }));

    const { error, data } = await supabase
      .from("course_candidates")
      .upsert(batch, { onConflict: "manager_id,id_number,cert_type_id" })
      .select("id");

    if (error) {
      result.errors.push(`שורות ${i + 1}-${i + batch.length}: ${error.message}`);
    } else {
      result.imported += (data?.length || 0);
    }
  }

  revalidatePath("/dashboard/candidates");
  return result;
}
