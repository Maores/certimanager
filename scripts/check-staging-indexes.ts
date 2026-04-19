import { createClient } from "@supabase/supabase-js";

const MANAGER_ID = "d4a5b88a-496f-4d18-95a8-b39e6a8f51db";
// seed cert_type_id we know exists
const CERT_TYPE_ID = "aaaa1111-1111-1111-1111-111111111111";
// seed employee_id we know exists
const EMP_ID = "bbbb1111-1111-1111-1111-111111111111";

async function main() {
  if (process.env.SUPABASE_ENV !== "staging") {
    throw new Error("SUPABASE_ENV must be 'staging'");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const probes = [
    {
      label: "employees upsert on (manager_id, employee_number)",
      table: "employees" as const,
      row: {
        manager_id: MANAGER_ID,
        first_name: "Diag",
        last_name: "Test",
        employee_number: "__diag_99999",
        department: "",
        phone: "",
        email: "",
        status: "פעיל",
        notes: null,
      },
      onConflict: "manager_id,employee_number",
      cleanup: { col: "employee_number", val: "__diag_99999" },
    },
    {
      label: "cert_types upsert on (manager_id, name)",
      table: "cert_types" as const,
      row: {
        manager_id: MANAGER_ID,
        name: "__diag_cert_type_99999",
        default_validity_months: 12,
      },
      onConflict: "manager_id,name",
      cleanup: { col: "name", val: "__diag_cert_type_99999" },
    },
    {
      label: "certifications upsert on (employee_id, cert_type_id) — candidate promote path",
      table: "certifications" as const,
      row: {
        employee_id: EMP_ID,
        cert_type_id: CERT_TYPE_ID,
        issue_date: "2025-01-01",
      },
      onConflict: "employee_id,cert_type_id",
      cleanup: null,
    },
    {
      label: "course_candidates upsert on (manager_id, id_number, cert_type_id) — bulk import path",
      table: "course_candidates" as const,
      row: {
        manager_id: MANAGER_ID,
        first_name: "Diag",
        last_name: "Test",
        id_number: "__diag_cand_99999",
        cert_type_id: CERT_TYPE_ID,
        status: "ממתין",
      },
      onConflict: "manager_id,id_number,cert_type_id",
      cleanup: { col: "id_number", val: "__diag_cand_99999" },
    },
  ];

  for (const p of probes) {
    const { error } = await supabase
      .from(p.table)
      .upsert([p.row as Record<string, unknown>], { onConflict: p.onConflict });
    if (error) {
      console.log(`FAIL  ${p.label}: ${error.code} ${error.message}`);
    } else {
      console.log(`OK    ${p.label}`);
    }
  }

  for (const p of probes) {
    if (p.cleanup) {
      await supabase
        .from(p.table)
        .delete()
        .eq(p.cleanup.col, p.cleanup.val)
        .eq("manager_id", MANAGER_ID);
    }
  }
}

main();
