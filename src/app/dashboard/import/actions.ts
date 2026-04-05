"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseExcel } from "@/lib/excel-parser";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// --- Shared types (used by client components) ---

export interface SerializedWorker {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  statusWarning: boolean;
  notes: string;
  responsible: string;
  certTypeNames: string[];
  existsInDb: boolean;
  existingCertTypes: string[];
}

export interface SerializedParseResult {
  uniqueWorkers: SerializedWorker[];
  certTypeNames: string[];
  noCertWorkerCount: number;
  totalParsed: number;
  totalSkipped: number;
  skippedRows: { sheet: string; row: number; reason: string }[];
}

export interface ParseResponse {
  success: boolean;
  error?: string;
  data?: SerializedParseResult;
}

export interface ImportResponse {
  success: boolean;
  error?: string;
  summary?: {
    employeesCreated: number;
    employeesSkipped: number;
    certTypesCreated: number;
    certificationsCreated: number;
    certificationsSkipped: number;
    errors: string[];
  };
}

// --- Parse Action ---

export async function parseExcelFile(formData: FormData): Promise<ParseResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("file") as File;
  if (!file || file.size === 0) {
    return { success: false, error: "לא נבחר קובץ" };
  }

  if (!file.name.endsWith(".xlsx")) {
    return { success: false, error: "יש להעלות קובץ בפורמט xlsx בלבד" };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "הקובץ גדול מדי. הגודל המקסימלי הוא 10MB" };
  }

  try {
    const buffer = await file.arrayBuffer();
    const result = parseExcel(buffer);

    // Check existing employees (scoped by manager)
    const empNumbers = Array.from(result.uniqueWorkers.keys());
    const { data: existingEmps } = await supabase
      .from("employees")
      .select("id, employee_number")
      .eq("manager_id", user.id)
      .in("employee_number", empNumbers);

    const existingEmpMap = new Map<string, string>();
    for (const emp of existingEmps || []) {
      existingEmpMap.set(emp.employee_number, emp.id);
    }

    // Check existing certifications (scoped via employee -> manager)
    const existingEmpIds = Array.from(existingEmpMap.values());
    const existingCertMap = new Map<string, string[]>();

    if (existingEmpIds.length > 0) {
      const { data: existingCerts } = await supabase
        .from("certifications")
        .select("employee_id, cert_types!inner(name)")
        .in("employee_id", existingEmpIds);

      for (const cert of existingCerts || []) {
        const ctName = (cert.cert_types as any)?.name;
        if (!ctName) continue;
        const empId = cert.employee_id;
        if (!existingCertMap.has(empId)) existingCertMap.set(empId, []);
        existingCertMap.get(empId)!.push(ctName);
      }
    }

    // Collect skipped rows
    const allSkippedRows: { sheet: string; row: number; reason: string }[] = [];
    for (const sheet of result.sheets) {
      for (const skip of sheet.skippedRows) {
        allSkippedRows.push({ sheet: sheet.name, ...skip });
      }
    }

    const serialized: SerializedParseResult = {
      uniqueWorkers: Array.from(result.uniqueWorkers.entries()).map(([empNum, w]) => {
        const empId = existingEmpMap.get(empNum);
        const existingCerts = empId ? (existingCertMap.get(empId) || []) : [];
        return {
          employeeNumber: empNum,
          firstName: w.firstName,
          lastName: w.lastName,
          status: w.status,
          statusWarning: w.statusWarning,
          notes: w.notes,
          responsible: w.responsible,
          certTypeNames: w.certTypeNames,
          existsInDb: existingEmpMap.has(empNum),
          existingCertTypes: existingCerts,
        };
      }),
      certTypeNames: result.certTypeNames,
      noCertWorkerCount: result.noCertWorkers.length,
      totalParsed: result.totalParsed,
      totalSkipped: result.totalSkipped,
      skippedRows: allSkippedRows,
    };

    return { success: true, data: serialized };
  } catch {
    return { success: false, error: "שגיאה בקריאת הקובץ. ודאו שהקובץ תקין" };
  }
}

// --- Import Action ---

export async function executeBulkImport(
  workers: SerializedWorker[],
  certTypeNames: string[]
): Promise<ImportResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const errors: string[] = [];
  let certTypesCreated = 0;
  let employeesCreated = 0;
  let employeesSkipped = 0;
  let certificationsCreated = 0;
  let certificationsSkipped = 0;

  try {
    // Step 1: Upsert cert types
    const certTypeMap = new Map<string, string>();

    const { data: existingCertTypes } = await supabase
      .from("cert_types")
      .select("id, name")
      .eq("manager_id", user.id);

    for (const ct of existingCertTypes || []) {
      certTypeMap.set(ct.name, ct.id);
    }

    for (const ctName of certTypeNames) {
      if (!certTypeMap.has(ctName)) {
        const { data: newCt, error } = await supabase
          .from("cert_types")
          .upsert(
            { manager_id: user.id, name: ctName, default_validity_months: 12 },
            { onConflict: "manager_id,name" }
          )
          .select("id")
          .single();

        if (error) {
          errors.push(`שגיאה ביצירת סוג הסמכה "${ctName}": ${error.message}`);
        } else if (newCt) {
          certTypeMap.set(ctName, newCt.id);
          certTypesCreated++;
        }
      }
    }

    // Step 2: Insert new employees in batches of 50
    // Re-verify which employees exist server-side (don't trust client existsInDb)
    const allEmpNumbers = workers.map(w => w.employeeNumber);
    const { data: currentExisting } = await supabase
      .from("employees")
      .select("employee_number")
      .eq("manager_id", user.id)
      .in("employee_number", allEmpNumbers);

    const existingEmpSet = new Set((currentExisting || []).map(e => e.employee_number));
    const newWorkers = workers.filter(w => !existingEmpSet.has(w.employeeNumber));

    for (let i = 0; i < newWorkers.length; i += 50) {
      const batch = newWorkers.slice(i, i + 50).map(w => ({
        manager_id: user.id,
        first_name: w.firstName,
        last_name: w.lastName,
        employee_number: w.employeeNumber,
        department: "",
        phone: "",
        email: "",
        status: w.status,
        notes: w.responsible
          ? (w.notes ? `${w.notes}\nאחראי: ${w.responsible}` : `אחראי: ${w.responsible}`)
          : (w.notes || null),
      }));

      const { error } = await supabase
        .from("employees")
        .upsert(batch, { onConflict: "manager_id,employee_number", ignoreDuplicates: true });

      if (error) {
        errors.push(`שגיאה בייבוא עובדים (אצווה ${Math.floor(i / 50) + 1}): ${error.message}`);
      }
    }

    // Always refresh full employee map after upserts
    const employeeMap = new Map<string, string>();
    const { data: allEmps } = await supabase
      .from("employees")
      .select("id, employee_number")
      .eq("manager_id", user.id);

    for (const emp of allEmps || []) {
      employeeMap.set(emp.employee_number, emp.id);
    }

    employeesCreated = newWorkers.filter(w => employeeMap.has(w.employeeNumber)).length;
    employeesSkipped = workers.length - newWorkers.length;

    // Step 3: Create certifications (scoped dedup)
    const existingCertSet = new Set<string>();
    const empIds = Array.from(employeeMap.values());

    if (empIds.length > 0) {
      const { data: existingCerts } = await supabase
        .from("certifications")
        .select("employee_id, cert_type_id")
        .in("employee_id", empIds);

      for (const c of existingCerts || []) {
        existingCertSet.add(`${c.employee_id}:${c.cert_type_id}`);
      }
    }

    const certRows: { employee_id: string; cert_type_id: string; issue_date: null; expiry_date: null; notes: null }[] = [];

    for (const worker of workers) {
      const empId = employeeMap.get(worker.employeeNumber);
      if (!empId) continue;

      for (const ctName of worker.certTypeNames) {
        const ctId = certTypeMap.get(ctName);
        if (!ctId) continue;

        const key = `${empId}:${ctId}`;
        if (existingCertSet.has(key)) {
          certificationsSkipped++;
          continue;
        }

        certRows.push({
          employee_id: empId,
          cert_type_id: ctId,
          issue_date: null,
          expiry_date: null,
          notes: null,
        });
        existingCertSet.add(key);
      }
    }

    for (let i = 0; i < certRows.length; i += 50) {
      const batch = certRows.slice(i, i + 50);
      const { data: inserted, error } = await supabase
        .from("certifications")
        .insert(batch)
        .select("id");

      if (error) {
        errors.push(`שגיאה בייבוא הסמכות (אצווה ${Math.floor(i / 50) + 1}): ${error.message}`);
      } else {
        certificationsCreated += inserted?.length || 0;
      }
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/certifications");
    revalidatePath("/dashboard/cert-types");

    return {
      success: true,
      summary: {
        employeesCreated,
        employeesSkipped,
        certTypesCreated,
        certificationsCreated,
        certificationsSkipped,
        errors,
      },
    };
  } catch (e: any) {
    console.error("Bulk import error:", e);
    return { success: false, error: "שגיאה כללית בייבוא. נסו שוב מאוחר יותר" };
  }
}
