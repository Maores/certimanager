"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseExcel, type CertDates } from "@/lib/excel-parser";
import { decideCertMerge } from "@/lib/cert-merge";

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
  certDatesByType: Record<string, CertDates>;
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
    employeesUpdated: number;
    certTypesCreated: number;
    certificationsCreated: number;
    certificationsUpdated: number;
    certificationsSkipped: number;
    tasksCreated: number;
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
    return { success: false, error: "הקובץ גדול מדי. הגודל המקסימלי הוא 5MB" };
  }

  try {
    const buffer = await file.arrayBuffer();
    const result = parseExcel(buffer);

    // Check existing employees (scoped by manager)
    const empNumbers = Array.from(result.uniqueWorkers.keys());
    const { data: existingEmps } = empNumbers.length > 0
      ? await supabase
          .from("employees")
          .select("id, employee_number")
          .eq("manager_id", user.id)
          .in("employee_number", empNumbers)
      : { data: [] };

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
          certDatesByType: w.certDatesByType,
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
  let employeesUpdated = 0;
  let certificationsCreated = 0;
  let certificationsUpdated = 0;
  let certificationsSkipped = 0;
  let tasksCreated = 0;

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

    // Step 2: Upsert employees in batches of 50
    // Re-verify which employees exist server-side (don't trust client existsInDb)
    const allEmpNumbers = workers.map(w => w.employeeNumber);
    const { data: currentExisting } = allEmpNumbers.length > 0
      ? await supabase
          .from("employees")
          .select("employee_number")
          .eq("manager_id", user.id)
          .in("employee_number", allEmpNumbers)
      : { data: [] };

    const existingEmpSet = new Set((currentExisting || []).map(e => e.employee_number));

    for (let i = 0; i < workers.length; i += 50) {
      const batch = workers.slice(i, i + 50).map(w => ({
        manager_id: user.id,
        first_name: w.firstName,
        last_name: w.lastName,
        employee_number: w.employeeNumber,
        department: "",
        phone: "",
        email: "",
        status: w.status,
        notes: w.notes || null,
      }));

      const { error } = await supabase
        .from("employees")
        .upsert(batch, { onConflict: "manager_id,employee_number" });

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

    employeesCreated = workers.filter(w => !existingEmpSet.has(w.employeeNumber) && employeeMap.has(w.employeeNumber)).length;
    employeesUpdated = workers.filter(w => existingEmpSet.has(w.employeeNumber) && employeeMap.has(w.employeeNumber)).length;

    // Step 2b: Create employee_tasks for workers with notes or responsible data
    const taskRows: { employee_id: string; description: string; responsible: string | null; status: string }[] = [];
    const taskWorkers = workers.filter(w => w.notes && w.notes.trim() !== "");

    if (taskWorkers.length > 0) {
      // Fetch existing tasks for dedup
      const taskEmpIds = taskWorkers
        .map(w => employeeMap.get(w.employeeNumber))
        .filter((id): id is string => !!id);

      const existingTaskSet = new Set<string>();
      if (taskEmpIds.length > 0) {
        const { data: existingTasks } = await supabase
          .from("employee_tasks")
          .select("employee_id, description")
          .in("employee_id", taskEmpIds);

        for (const t of existingTasks || []) {
          existingTaskSet.add(`${t.employee_id}:${t.description}`);
        }
      }

      for (const w of taskWorkers) {
        const empId = employeeMap.get(w.employeeNumber);
        if (!empId) continue;

        const description = w.notes.trim();
        const key = `${empId}:${description}`;
        if (existingTaskSet.has(key)) continue;

        taskRows.push({
          employee_id: empId,
          description,
          responsible: w.responsible || null,
          status: "פתוח",
        });
        existingTaskSet.add(key);
      }

      for (let i = 0; i < taskRows.length; i += 50) {
        const batch = taskRows.slice(i, i + 50);
        const { data: inserted, error } = await supabase
          .from("employee_tasks")
          .insert(batch)
          .select("id");

        if (error) {
          errors.push(`שגיאה ביצירת משימות (אצווה ${Math.floor(i / 50) + 1}): ${error.message}`);
        } else {
          tasksCreated += inserted?.length || 0;
        }
      }
    }

    // Step 3: Create or update certifications (monotonic field-level merge)
    const empIds = Array.from(employeeMap.values());

    // Fetch existing certs with full date tuples, keyed by (empId, cert_type_id)
    type ExistingCert = {
      id: string;
      employee_id: string;
      cert_type_id: string;
      issue_date: string | null;
      expiry_date: string | null;
      next_refresh_date: string | null;
    };
    const existingCertMap = new Map<string, ExistingCert>();

    if (empIds.length > 0) {
      const { data: existingCerts } = await supabase
        .from("certifications")
        .select("id, employee_id, cert_type_id, issue_date, expiry_date, next_refresh_date")
        .in("employee_id", empIds);

      for (const c of (existingCerts || []) as ExistingCert[]) {
        existingCertMap.set(`${c.employee_id}:${c.cert_type_id}`, c);
      }
    }

    const insertRows: {
      employee_id: string;
      cert_type_id: string;
      issue_date: string | null;
      expiry_date: string | null;
      next_refresh_date: string | null;
      notes: null;
    }[] = [];

    const updateOps: {
      id: string;
      patch: {
        issue_date: string | null;
        expiry_date: string | null;
        next_refresh_date: string | null;
      };
    }[] = [];

    for (const worker of workers) {
      const empId = employeeMap.get(worker.employeeNumber);
      if (!empId) continue;

      for (const ctName of worker.certTypeNames) {
        const ctId = certTypeMap.get(ctName);
        if (!ctId) continue;

        const fileDates: CertDates = worker.certDatesByType[ctName] ?? {
          issue_date: null,
          expiry_date: null,
          next_refresh_date: null,
        };

        const key = `${empId}:${ctId}`;
        const existing = existingCertMap.get(key) ?? null;
        const dbDates: CertDates | null = existing
          ? {
              issue_date: existing.issue_date,
              expiry_date: existing.expiry_date,
              next_refresh_date: existing.next_refresh_date,
            }
          : null;

        const decision = decideCertMerge(fileDates, dbDates);

        if (decision.action === "insert") {
          insertRows.push({
            employee_id: empId,
            cert_type_id: ctId,
            issue_date: decision.merged.issue_date,
            expiry_date: decision.merged.expiry_date,
            next_refresh_date: decision.merged.next_refresh_date,
            notes: null,
          });
        } else if (decision.action === "update" && existing) {
          updateOps.push({
            id: existing.id,
            patch: {
              issue_date: decision.merged.issue_date,
              expiry_date: decision.merged.expiry_date,
              next_refresh_date: decision.merged.next_refresh_date,
            },
          });
        } else {
          certificationsSkipped++;
        }
      }
    }

    // Batch INSERTs
    for (let i = 0; i < insertRows.length; i += 50) {
      const batch = insertRows.slice(i, i + 50);
      const { data: inserted, error } = await supabase
        .from("certifications")
        .insert(batch)
        .select("id");

      if (error) {
        errors.push(`שגיאה ביצירת הסמכות (אצווה ${Math.floor(i / 50) + 1}): ${error.message}`);
      } else {
        certificationsCreated += inserted?.length || 0;
      }
    }

    // UPDATEs — one-by-one because patches differ per row
    for (const op of updateOps) {
      const { error } = await supabase
        .from("certifications")
        .update(op.patch)
        .eq("id", op.id);

      if (error) {
        errors.push(`שגיאה בעדכון הסמכה: ${error.message}`);
      } else {
        certificationsUpdated++;
      }
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/certifications");
    revalidatePath("/dashboard/cert-types");

    return {
      success: true,
      summary: {
        employeesCreated,
        employeesUpdated,
        certTypesCreated,
        certificationsCreated,
        certificationsUpdated,
        certificationsSkipped,
        tasksCreated,
        errors,
      },
    };
  } catch {
    return { success: false, error: "שגיאה כללית בייבוא. נסו שוב מאוחר יותר" };
  }
}
