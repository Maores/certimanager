// src/app/dashboard/candidates/sync-leads-action.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isValidIsraeliId,
  normalizeName,
  normalizePhone,
} from "@/lib/leads/normalize";
import { parseLeadsXlsx } from "@/lib/leads/parse";
import { dedupLeads, type ExistingCandidate } from "@/lib/leads/dedup";
import type { NormalizedLead, SyncSummary } from "@/lib/leads/types";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1B5jN3NH9FqCOsAac7S-j4cwGUliqjHs_Vg0iraljQBM/export?format=xlsx&gid=0";

export async function syncLeadsFromSheet(): Promise<SyncSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Fetch — fetch() rejects on transport errors (DNS, connection reset, etc.),
  // returns ok=false on HTTP 4xx/5xx. Translate both into a Hebrew message.
  let res: Response;
  try {
    res = await fetch(SHEET_URL, { cache: "no-store" });
  } catch {
    throw new Error(
      "שגיאת רשת בעת חיבור לגוגל שיטס. בדוק את החיבור ונסה שוב."
    );
  }
  if (!res.ok) {
    throw new Error(
      `שגיאה בקבלת הקובץ מגוגל שיטס (סטטוס ${res.status}). ודא ששיתוף הקישור פתוח.`
    );
  }
  const buffer = await res.arrayBuffer();

  // 2. Parse
  const { rows } = parseLeadsXlsx(buffer);

  // 3. Normalize
  const normalized: NormalizedLead[] = rows.map((r) => {
    const phone = normalizePhone(r.phone);
    const name = normalizeName(r.first_name);
    const idValid = isValidIsraeliId(r.id_number);
    return {
      first_name: name.value,
      phone: phone.value,
      city: r.city,
      id_number: r.id_number,
      source_row_number: r.source_row_number,
      flags: {
        empty_name: name.empty,
        invalid_phone: !phone.valid,
        invalid_id: !idValid,
      },
    };
  });

  // 4. Fetch existing candidates for this manager
  const { data: existingData } = await supabase
    .from("course_candidates")
    .select("id, id_number, phone")
    .eq("manager_id", user.id);

  const existing: ExistingCandidate[] = (existingData ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      id_number: (r.id_number as string) ?? "",
      phone: (r.phone as string | null) ?? null,
    })
  );

  // 5. Dedup
  const { toInsert, toUpdate } = dedupLeads(normalized, existing);

  // 6. Updates: only the source fields (first_name / phone / city) — never
  // status / cert_type / read_at / notes / last_name. The source sheet has no
  // last_name column, so leaving it untouched preserves any curated value the
  // manager entered after a re-promotion. Batched in parallel — sequential
  // awaits at ~100ms each would take ~22s for a 200-row sheet.
  const UPDATE_BATCH = 25;
  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
    const batch = toUpdate.slice(i, i + UPDATE_BATCH);
    const results = await Promise.all(
      batch.map((m) =>
        supabase
          .from("course_candidates")
          .update({
            first_name: m.lead.first_name,
            phone: m.lead.phone,
            city: m.lead.city,
          })
          .eq("id", m.existing_id)
          .eq("manager_id", user.id)
      )
    );
    const failed = results.filter((r) => r.error);
    if (failed.length > 0) {
      throw new Error(
        `נכשלו ${failed.length} עדכונים: ${failed[0].error?.message ?? "שגיאה לא ידועה"}`
      );
    }
  }

  // 7. Inserts
  if (toInsert.length > 0) {
    const newRows = toInsert.map((l) => ({
      manager_id: user.id,
      first_name: l.first_name,
      last_name: "",
      id_number: l.id_number,
      phone: l.phone,
      city: l.city,
      cert_type_id: null,
      status: "ליד חדש",
      police_clearance_status: "לא נשלח",
      read_at: null,
    }));
    const { error: insertError } = await supabase
      .from("course_candidates")
      .insert(newRows);
    if (insertError) {
      throw new Error(`הכנסה נכשלה: ${insertError.message}`);
    }
  }

  revalidatePath("/dashboard/candidates");

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    rejected: { missing_name: 0, invalid_id: 0, invalid_phone: 0 },
    total_rows: rows.length,
  };
}
