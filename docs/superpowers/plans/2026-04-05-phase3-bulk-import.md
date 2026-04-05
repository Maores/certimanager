# Phase 3: Bulk Import from Excel - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable bulk import of ~148 employees and certifications from an Excel spreadsheet into CertiManager.

**Architecture:** 3-step wizard (upload → review → import) at `/dashboard/import`. Server-side xlsx parsing with dedup by `employee_number`. Upsert strategy for idempotent imports.

**Tech Stack:** Next.js 16 App Router, Supabase, TypeScript, xlsx (SheetJS), Tailwind CSS, RTL Hebrew UI.

**Spec:** `docs/superpowers/specs/2026-04-05-phase3-bulk-import-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migration_phase3.sql` | Already exists | Migration SQL — run in Supabase SQL Editor |
| `next.config.ts` | Modify | Add `serverActions.bodySizeLimit: '12mb'` |
| `src/app/dashboard/layout.tsx` | Modify | Add "ייבוא" nav item (desktop only) |
| `src/app/dashboard/cert-types/actions.ts` | Modify | Fix manager_id scoping on update/delete |
| `src/app/dashboard/certifications/actions.ts` | Modify | Fix manager_id scoping on update/delete |
| `src/lib/excel-parser.ts` | Create | Parse xlsx, normalize data, classify sheets, detect duplicates |
| `src/app/dashboard/import/page.tsx` | Create | Server component entry point |
| `src/app/dashboard/import/actions.ts` | Create | Server actions: `parseExcelFile()`, `executeBulkImport()` |
| `src/components/import/import-wizard.tsx` | Create | Client wizard component with 3 steps |
| `src/components/import/upload-step.tsx` | Create | Step 1: file upload dropzone |
| `src/components/import/review-step.tsx` | Create | Step 2: preview table with dedup indicators |
| `src/components/import/summary-step.tsx` | Create | Step 3: import results report |

---

## Task 0: Pre-requisites (Security Hardening + Config)

**Files:**
- Modify: `src/app/dashboard/cert-types/actions.ts`
- Modify: `src/app/dashboard/certifications/actions.ts`
- Modify: `next.config.ts`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Fix cert-types actions manager_id scoping**

In `src/app/dashboard/cert-types/actions.ts`, add `.eq("manager_id", user.id)` to both `updateCertType` and `deleteCertType`:

```typescript
// updateCertType — change:
.eq("id", id)
// to:
.eq("id", id)
.eq("manager_id", user.id)

// deleteCertType — change:
.eq("id", id)
// to:
.eq("id", id)
.eq("manager_id", user.id)
```

- [ ] **Step 2: Fix certifications actions manager_id scoping**

In `src/app/dashboard/certifications/actions.ts`, add auth checks to `updateCertification` and `deleteCertification`. Since certifications don't have `manager_id` directly, verify via the employee:

```typescript
// At the top of updateCertification, after creating supabase client:
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");

// Before the update query, verify ownership:
const { data: cert } = await supabase
  .from("certifications")
  .select("employee_id, employees!inner(manager_id)")
  .eq("id", id)
  .single();

if (!cert || (cert.employees as any).manager_id !== user.id) {
  throw new Error("Unauthorized");
}

// Same pattern for deleteCertification
```

- [ ] **Step 3: Configure server action body size limit**

In `next.config.ts`, add `serverActions` config:

```typescript
const nextConfig: NextConfig = {
  serverActions: {
    bodySizeLimit: '12mb',
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "uidxgisstzpsmepoatpm.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },
};
```

- [ ] **Step 4: Add import nav item (desktop sidebar only)**

In `src/app/dashboard/layout.tsx`, add to the `navItems` array:

```typescript
{ label: "ייבוא", href: "/dashboard/import", icon: "📥" },
```

In `src/components/layout/sidebar.tsx`, update the mobile bottom tab bar to only show the first 4 items (hide import on mobile since 5 tabs is too crowded at `text-[10px]`). Users access import via the desktop sidebar or by navigating directly.

Change the mobile nav section:

```typescript
{/* Mobile bottom tab bar */}
<nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 md:hidden safe-area-bottom">
  <div className="flex justify-around items-center h-16 px-1">
    {items.slice(0, 4).map((item) => {
```

- [ ] **Step 5: Build and verify**

```bash
npx next build
```

Expected: Build passes with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/cert-types/actions.ts src/app/dashboard/certifications/actions.ts next.config.ts src/app/dashboard/layout.tsx src/components/layout/sidebar.tsx
git commit -m "fix: harden manager_id scoping + configure import prerequisites"
```

---

## Task 1: Excel Parser Utility

**Files:**
- Create: `src/lib/excel-parser.ts`

This is the core parsing logic, pure functions with no Supabase dependency.

- [ ] **Step 1: Create the excel-parser module**

Create `src/lib/excel-parser.ts` with:

```typescript
import * as XLSX from "xlsx";

// --- Types ---

export interface ParsedWorker {
  employeeNumber: string;       // normalized
  rawEmployeeNumber: string;    // original from Excel
  firstName: string;
  lastName: string;
  status: string;               // normalized Hebrew status
  statusWarning: boolean;       // true if original status was unrecognized
  notes: string;
  responsible: string;          // אחראי field
  sourceSheet: string;          // which sheet this came from
  certTypeName: string | null;  // null for no-cert sheets
}

export interface ParsedSheet {
  name: string;
  isWorkerSheet: boolean;
  certTypeName: string | null;
  workers: ParsedWorker[];
  skippedRows: SkippedRow[];
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ParseResult {
  sheets: ParsedSheet[];
  uniqueWorkers: Map<string, ParsedWorker & { certTypeNames: string[] }>;
  certTypeNames: string[];
  noCertWorkers: ParsedWorker[];
  totalParsed: number;
  totalSkipped: number;
}

// --- Constants ---

const WORKER_SHEETS: Record<string, string | null> = {
  "מאושרי נת\"ע": "נת\"ע",
  "מאושרי כביש 6 + נת\"ע": "כביש 6 + נת\"ע",
  "מאושרי כביש 6": "כביש 6",
  "PFI": "PFI",
  "פעיל - ללא הסמכה מוגדרת": null,
  "חלת - מחלה": null,
  "ללא הסמכה - לבירור": null,
};
// NOTE: "כביש 6 + נת\"ע" must come BEFORE "כביש 6" to match the longer string first

const SKIP_SHEETS = [
  "ריכוז כל המשימות",
  "משימות לפי אחראי",
  "סיכום כללי",
  "משימות להמשך טיפול",
];

const STATUS_MAP: Record<string, string> = {
  "פעיל": "פעיל",
  "חלת": 'חל"ת',
  'חל"ת': 'חל"ת',
  'חל״ת': 'חל"ת',
  "מחלה": "מחלה",
  "לא פעיל": "לא פעיל",
};

// --- Functions ---

export function normalizeEmployeeNumber(raw: string): string {
  return raw.toString().trim().replace(/[^a-zA-Z0-9]/g, "");
}

export function normalizeStatus(raw: string | undefined): { value: string; warning: boolean } {
  if (!raw || !raw.trim()) return { value: "פעיל", warning: false };
  const trimmed = raw.trim();
  const mapped = STATUS_MAP[trimmed];
  if (mapped) return { value: mapped, warning: false };
  return { value: "פעיל", warning: true };
}

export function parseExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets: ParsedSheet[] = [];
  const uniqueWorkers = new Map<string, ParsedWorker & { certTypeNames: string[] }>();
  const certTypeNames = new Set<string>();
  const noCertWorkers: ParsedWorker[] = [];
  let totalParsed = 0;
  let totalSkipped = 0;

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.some(s => sheetName.includes(s))) continue;

    const matchedKey = Object.keys(WORKER_SHEETS).find(k => sheetName.includes(k));
    if (!matchedKey) continue;

    const certTypeName = WORKER_SHEETS[matchedKey];
    if (certTypeName) certTypeNames.add(certTypeName);

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

    const parsedWorkers: ParsedWorker[] = [];
    const skippedRows: SkippedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const empNumRaw = String(
        row["מספר זהות"] || row["דרכון"] || row["מספר זהות / דרכון"] ||
        row["ת.ז"] || row["ת.ז."] || row["מס זהות"] || ""
      );
      const empNum = normalizeEmployeeNumber(empNumRaw);

      if (empNum.length < 5) {
        skippedRows.push({ row: rowNum, reason: `מספר זהות לא תקין: "${empNumRaw}"` });
        totalSkipped++;
        continue;
      }

      const firstName = String(row["שם פרטי"] || "").trim();
      const lastName = String(row["שם משפחה"] || "").trim();

      if (!firstName && !lastName) {
        skippedRows.push({ row: rowNum, reason: "חסר שם פרטי ושם משפחה" });
        totalSkipped++;
        continue;
      }

      const statusRaw = String(row["סטטוס"] || row["סטאטוס"] || "").trim();
      const { value: status, warning: statusWarning } = normalizeStatus(statusRaw);

      const notes = String(row["הערות"] || row["משימות"] || row["הערה"] || "").trim();
      const responsible = String(row["אחראי"] || "").trim();

      const worker: ParsedWorker = {
        employeeNumber: empNum,
        rawEmployeeNumber: empNumRaw,
        firstName: firstName || "לא ידוע",
        lastName: lastName || "לא ידוע",
        status,
        statusWarning,
        notes,
        responsible,
        sourceSheet: sheetName,
        certTypeName,
      };

      parsedWorkers.push(worker);
      totalParsed++;

      if (uniqueWorkers.has(empNum)) {
        const existing = uniqueWorkers.get(empNum)!;
        if (certTypeName && !existing.certTypeNames.includes(certTypeName)) {
          existing.certTypeNames.push(certTypeName);
        }
        if (notes && !existing.notes.includes(notes)) {
          existing.notes = existing.notes ? `${existing.notes}\n${notes}` : notes;
        }
      } else {
        uniqueWorkers.set(empNum, {
          ...worker,
          certTypeNames: certTypeName ? [certTypeName] : [],
        });
        if (!certTypeName) {
          noCertWorkers.push(worker);
        }
      }
    }

    sheets.push({
      name: sheetName,
      isWorkerSheet: true,
      certTypeName,
      workers: parsedWorkers,
      skippedRows,
    });
  }

  return {
    sheets,
    uniqueWorkers,
    certTypeNames: Array.from(certTypeNames),
    noCertWorkers,
    totalParsed,
    totalSkipped,
  };
}
```

- [ ] **Step 2: Build and verify**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/excel-parser.ts
git commit -m "feat: add Excel parser utility for bulk import"
```

---

## Task 2: Server Actions (Parse + Import)

**Files:**
- Create: `src/app/dashboard/import/actions.ts`

- [ ] **Step 1: Create the complete actions file**

Create `src/app/dashboard/import/actions.ts` with both `parseExcelFile` and `executeBulkImport`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseExcel } from "@/lib/excel-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
  existingCertTypes: string[]; // cert types this employee already has in DB
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

    // Check existing employees in DB (scoped by manager)
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
    const existingCertMap = new Map<string, string[]>(); // empId -> [certTypeName, ...]

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

    // Collect all skipped rows across sheets
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
    const certTypeMap = new Map<string, string>(); // name -> id

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

    // Step 2: Insert new employees in batches
    const newWorkers = workers.filter(w => !w.existsInDb);

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
        errors.push(`שגיאה בייבוא עובדי�� (אצווה ${Math.floor(i / 50) + 1}): ${error.message}`);
      }
    }

    // Always refresh full employee map after upserts (handles race conditions)
    const employeeMap = new Map<string, string>();
    const { data: allEmps } = await supabase
      .from("employees")
      .select("id, employee_number")
      .eq("manager_id", user.id);

    for (const emp of allEmps || []) {
      employeeMap.set(emp.employee_number, emp.id);
    }

    // Count created vs skipped
    for (const w of workers) {
      if (w.existsInDb) employeesSkipped++;
      else if (employeeMap.has(w.employeeNumber)) employeesCreated++;
    }

    // Step 3: Create certifications (scoped dedup via employee -> manager)
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
    return { success: false, error: `שגיאה כללית בייבוא: ${e.message}` };
  }
}
```

Key changes from review:
- `executeBulkImport` takes `(workers, certTypeNames)` instead of full `SerializedParseResult` — reduces payload and avoids trusting client-side `existsInDb` flag (re-verifies server-side)
- Certification dedup query scoped through `employee_id IN (manager's employees)` instead of reading all certifications
- Employee map always refreshed unconditionally after upserts
- No `sheets` data passed to import action (only needed for review UI)

- [ ] **Step 2: Build and verify**

```bash
npx next build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/import/actions.ts
git commit -m "feat: add server actions for Excel parse and bulk import"
```

---

## Task 3: Import Wizard UI Components

**Files:**
- Create: `src/components/import/upload-step.tsx`
- Create: `src/components/import/review-step.tsx`
- Create: `src/components/import/summary-step.tsx`
- Create: `src/components/import/import-wizard.tsx`

- [ ] **Step 1: Create upload-step component**

Create `src/components/import/upload-step.tsx`:

```typescript
"use client";

import { useRef, useState } from "react";
import { parseExcelFile, type SerializedParseResult } from "@/app/dashboard/import/actions";

interface UploadStepProps {
  onParsed: (data: SerializedParseResult) => void;
}

export default function UploadStep({ onParsed }: UploadStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.endsWith(".xlsx")) {
      setError("יש להעלות קובץ בפורמט xlsx בלבד");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("הקובץ גדול מדי. הגודל המקסימלי הוא 10MB");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    const result = await parseExcelFile(formData);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "שגיאה לא ידועה");
    } else if (result.data) {
      onParsed(result.data);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12
          cursor-pointer transition-colors
          ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"}
          ${loading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {loading ? (
          <>
            <svg className="h-8 w-8 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-600">מנתח את הקובץ...</p>
          </>
        ) : (
          <>
            <span className="text-4xl">📥</span>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                גררו קובץ Excel לכאן או לחצו לבחירה
              </p>
              <p className="mt-1 text-xs text-gray-500">
                קובץ xlsx בלבד, עד 10MB
              </p>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create review-step component**

Create `src/components/import/review-step.tsx`:

```typescript
"use client";

import type { SerializedParseResult } from "@/app/dashboard/import/actions";

interface ReviewStepProps {
  data: SerializedParseResult;
  onConfirm: () => void;
  onBack: () => void;
  importing: boolean;
}

export default function ReviewStep({ data, onConfirm, onBack, importing }: ReviewStepProps) {
  const newWorkers = data.uniqueWorkers.filter(w => !w.existsInDb);
  const existingWorkers = data.uniqueWorkers.filter(w => w.existsInDb);
  const withWarnings = data.uniqueWorkers.filter(w => w.statusWarning);

  const stats = [
    { label: "עובדים שנמצאו", value: data.totalParsed, color: "blue" },
    { label: "ייחודיים", value: data.uniqueWorkers.length, color: "indigo" },
    { label: "חדשים", value: newWorkers.length, color: "green" },
    { label: "קיימים במערכת", value: existingWorkers.length, color: "gray" },
    { label: "ללא הסמכה", value: data.noCertWorkerCount, color: "yellow" },
    { label: "שורות שדולגו", value: data.totalSkipped, color: "red" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Cert types to create */}
      {data.certTypeNames.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            סוגי הסמכות שייווצרו ({data.certTypeNames.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.certTypeNames.map((name) => (
              <span key={name} className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Workers table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-right font-medium text-gray-600">#</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">שם</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">מספר זהות</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">סטטוס</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">הסמכות</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">מצב</th>
              </tr>
            </thead>
            <tbody>
              {data.uniqueWorkers.map((worker, i) => (
                <tr
                  key={worker.employeeNumber}
                  className={`border-b border-gray-100 ${
                    worker.existsInDb ? "bg-gray-50" : "bg-green-50/30"
                  }`}
                >
                  <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">
                    {worker.firstName} {worker.lastName}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600" dir="ltr">{worker.employeeNumber}</td>
                  <td className="px-4 py-2.5">
                    <span className={worker.statusWarning ? "text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded text-xs" : "text-gray-600"}>
                      {worker.status}
                      {worker.statusWarning && " ⚠"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {worker.certTypeNames.length > 0 ? worker.certTypeNames.map((ct) => {
                        const alreadyExists = worker.existingCertTypes.includes(ct);
                        return (
                          <span
                            key={ct}
                            className={`text-xs px-2 py-0.5 rounded ${
                              alreadyExists
                                ? "bg-gray-200 text-gray-500 line-through"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {ct}
                          </span>
                        );
                      }) : (
                        <span className="text-xs text-gray-400">ללא</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {worker.existsInDb ? (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">קיים</span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">חדש</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skipped rows */}
      {data.skippedRows.length > 0 && (
        <details className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <summary className="text-sm font-medium text-yellow-800 cursor-pointer">
            שורות שדולגו ({data.skippedRows.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {data.skippedRows.map((row, i) => (
              <li key={i} className="text-xs text-yellow-700">
                {row.sheet} - שורה {row.row}: {row.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onConfirm}
          disabled={importing || newWorkers.length === 0}
          className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? (
            <>
              <svg className="ml-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              מייבא...
            </>
          ) : (
            `ייבוא ${newWorkers.length} עובדים`
          )}
        </button>
        <button
          onClick={onBack}
          disabled={importing}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          חזרה
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create summary-step component**

Create `src/components/import/summary-step.tsx`:

```typescript
"use client";

import Link from "next/link";
import type { ImportResponse } from "@/app/dashboard/import/actions";

interface SummaryStepProps {
  summary: ImportResponse["summary"];
  onReset: () => void;
}

export default function SummaryStep({ summary, onReset }: SummaryStepProps) {
  if (!summary) return null;

  const cards = [
    { label: "עובדים חדשים", value: summary.employeesCreated, color: "green" },
    { label: "עובדים קיימים (דולגו)", value: summary.employeesSkipped, color: "gray" },
    { label: "סוגי הסמכות חדשים", value: summary.certTypesCreated, color: "blue" },
    { label: "הסמכות נוצרו", value: summary.certificationsCreated, color: "indigo" },
    { label: "הסמכות קיימות (דולגו)", value: summary.certificationsSkipped, color: "gray" },
  ];

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center py-4">
        <span className="text-5xl">✅</span>
        <h2 className="mt-3 text-xl font-bold text-gray-900">הייבוא הושלם בהצלחה</h2>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className={`text-3xl font-bold text-${card.color}-600`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Errors */}
      {summary.errors.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <h3 className="text-sm font-medium text-red-800 mb-2">
            שגיאות ({summary.errors.length})
          </h3>
          <ul className="space-y-1">
            {summary.errors.map((err, i) => (
              <li key={i} className="text-xs text-red-700">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation links */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/dashboard/employees"
          className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          צפה בעובדים
        </Link>
        <Link
          href="/dashboard/certifications"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          צפה בהסמכות
        </Link>
        <button
          onClick={onReset}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          ייבוא ��וסף
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create import-wizard orchestrator**

Create `src/components/import/import-wizard.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { SerializedParseResult, ImportResponse } from "@/app/dashboard/import/actions";
import { executeBulkImport } from "@/app/dashboard/import/actions";
import UploadStep from "./upload-step";
import ReviewStep from "./review-step";
import SummaryStep from "./summary-step";

type WizardStep = "upload" | "review" | "summary";

const STEPS = [
  { key: "upload" as const, label: "העלאת קובץ", num: 1 },
  { key: "review" as const, label: "סקירה", num: 2 },
  { key: "summary" as const, label: "סיכום", num: 3 },
];

export default function ImportWizard() {
  const [step, setStep] = useState<WizardStep>("upload");
  const [parseData, setParseData] = useState<SerializedParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse["summary"] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function handleParsed(data: SerializedParseResult) {
    setParseData(data);
    setStep("review");
  }

  async function handleConfirmImport() {
    if (!parseData) return;
    setImporting(true);
    setImportError(null);

    const result = await executeBulkImport(parseData.uniqueWorkers, parseData.certTypeNames);
    setImporting(false);

    if (result.success && result.summary) {
      setImportResult(result.summary);
      setStep("summary");
    } else {
      setImportError(result.error || "שגיאה לא ידועה");
    }
  }

  function handleReset() {
    setStep("upload");
    setParseData(null);
    setImportResult(null);
    setImportError(null);
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
              ${step === s.key
                ? "bg-blue-600 text-white"
                : STEPS.findIndex(x => x.key === step) > i
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-400"
              }
            `}>
              {STEPS.findIndex(x => x.key === step) > i ? "✓" : s.num}
            </div>
            <span className={`text-sm hidden sm:inline ${step === s.key ? "font-medium text-gray-900" : "text-gray-400"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px bg-gray-300 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Import error */}
      {importError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Active step */}
      {step === "upload" && <UploadStep onParsed={handleParsed} />}
      {step === "review" && parseData && (
        <ReviewStep
          data={parseData}
          onConfirm={handleConfirmImport}
          onBack={() => { setStep("upload"); setParseData(null); }}
          importing={importing}
        />
      )}
      {step === "summary" && importResult && (
        <SummaryStep summary={importResult} onReset={handleReset} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Build and verify**

```bash
npx next build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/import/
git commit -m "feat: add import wizard UI components (upload, review, summary)"
```

---

## Task 4: Import Page + Integration

**Files:**
- Create: `src/app/dashboard/import/page.tsx`

- [ ] **Step 1: Create the import page**

Create `src/app/dashboard/import/page.tsx`:

```typescript
import ImportWizard from "@/components/import/import-wizard";

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ייבוא מאקסל</h1>
        <p className="mt-1 text-sm text-gray-500">
          ייבוא עובדים והסמכות מקובץ Excel
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
```

- [ ] **Step 2: Full build verification**

```bash
npx next build
```

Expected: All routes compile including `/dashboard/import`.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/import/page.tsx
git commit -m "feat: add import page route"
```

---

## Task 5: End-to-End Testing

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server and test full flow**

1. Start dev server: `npx next dev`
2. Navigate to `/dashboard/import`
3. Verify the upload dropzone renders
4. Upload the test xlsx file
5. Verify review step shows parsed workers with correct counts
6. Verify dedup indicators work (new = green, existing = gray)
7. Verify cert type badges show which are new vs already exist
8. Confirm import
9. Verify summary shows correct stats
10. Check employees list has new entries
11. Check certifications list has new entries
12. Check cert-types list has auto-created types

- [ ] **Step 2: Test edge cases**

1. Upload a non-xlsx file → should show Hebrew error
2. Upload an empty/corrupt file → should show Hebrew error
3. Re-run import with same file → should skip all existing (dedup works)
4. Check mobile view of import page

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: Phase 3 - bulk import from Excel with wizard UI"
```
