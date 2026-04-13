# Certification Types Update & Course Candidates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update cert types from 3 to 5, build a Course Candidates management module with import/promote flows, and cross-validate employee counts against source Excel files.

**Architecture:** Separate `course_candidates` table linked to `employees` via id_number soft-link and to `cert_types` via FK. Three promotion paths (manual, auto, bulk) upsert employees and create certifications. Import follows the existing 3-step wizard pattern.

**Tech Stack:** Next.js (App Router, Server Components, Server Actions), Supabase (PostgreSQL + RLS), Tailwind CSS, lucide-react icons, xlsx library for Excel parsing.

**Spec:** `docs/superpowers/specs/2026-04-13-cert-types-and-course-candidates-design.md`

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `supabase/migration_cert_types_v2.sql` | Migration: add 2 cert types, rename PFI, create course_candidates table |
| `src/app/dashboard/candidates/page.tsx` | Candidates list page (server component) |
| `src/app/dashboard/candidates/new/page.tsx` | Add candidate form page |
| `src/app/dashboard/candidates/import/page.tsx` | Import candidates page |
| `src/app/dashboard/candidates/actions.ts` | Server actions for CRUD, import, promote |
| `src/components/candidates/candidate-form.tsx` | Reusable candidate form component |
| `src/components/candidates/candidate-import-wizard.tsx` | 3-step import wizard |
| `src/components/candidates/candidate-upload-step.tsx` | Upload step for wizard |
| `src/components/candidates/candidate-review-step.tsx` | Review step for wizard |
| `src/components/candidates/candidate-summary-step.tsx` | Summary step for wizard |
| `src/components/candidates/promote-dialog.tsx` | Confirmation dialog for promotion |
| `src/components/candidates/candidates-table.tsx` | Client component: table with checkboxes, inline status, bulk actions |
| `src/lib/candidate-parser.ts` | Parse candidate Excel files |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/excel-parser.ts` | Update CANONICAL_CERT_TYPES to 5, update normalizeCertTypeName(), update WORKER_SHEETS for PFI rename |
| `src/types/database.ts` | Add CourseCandidate interface and CandidateStatus type |
| `src/app/dashboard/layout.tsx` | Add candidates nav item |
| `src/components/layout/sidebar.tsx` | Add GraduationCap icon import, add to iconMap, exclude from guest mode |

---

## Task 1: Database Migration — Cert Types + Course Candidates Table

**Files:**
- Create: `supabase/migration_cert_types_v2.sql`

- [ ] **Step 1: Write the migration SQL file**

```sql
-- Migration: Update cert types + create course_candidates table
-- Run against Supabase SQL Editor

-- ============================================
-- PART A: Update certification types (all managers)
-- ============================================

-- Add "חוצה ישראל" for all managers
INSERT INTO cert_types (manager_id, name, default_validity_months)
SELECT m.id, 'חוצה ישראל', 12 FROM managers m
WHERE NOT EXISTS (
  SELECT 1 FROM cert_types ct WHERE ct.manager_id = m.id AND ct.name = 'חוצה ישראל'
);

-- Add "נתיבי ישראל" for all managers
INSERT INTO cert_types (manager_id, name, default_validity_months)
SELECT m.id, 'נתיבי ישראל', 12 FROM managers m
WHERE NOT EXISTS (
  SELECT 1 FROM cert_types ct WHERE ct.manager_id = m.id AND ct.name = 'נתיבי ישראל'
);

-- Rename "PFI" → "חוצה צפון (PFI)" for all managers
UPDATE cert_types SET name = 'חוצה צפון (PFI)' WHERE name = 'PFI';

-- ============================================
-- PART B: Create course_candidates table
-- ============================================

CREATE TABLE IF NOT EXISTS course_candidates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id    uuid NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  id_number     text NOT NULL,
  phone         text,
  city          text,
  cert_type_id  uuid NOT NULL REFERENCES cert_types(id) ON DELETE RESTRICT,
  status        text NOT NULL DEFAULT 'ממתין',
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(manager_id, id_number, cert_type_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_candidates_manager ON course_candidates(manager_id);
CREATE INDEX IF NOT EXISTS idx_candidates_manager_status ON course_candidates(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_id_number ON course_candidates(id_number);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON course_candidates
FOR EACH ROW EXECUTE FUNCTION update_candidates_updated_at();

-- RLS
ALTER TABLE course_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_own" ON course_candidates FOR ALL
  USING (manager_id = auth.uid());

-- Unique index on certifications for promotion dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_employee_cert_type
  ON certifications(employee_id, cert_type_id);
```

- [ ] **Step 2: Run migration against Supabase**

Run the SQL in the Supabase SQL Editor (Dashboard → SQL Editor → paste and run).
Expected: All statements succeed. Verify with:
```sql
SELECT name FROM cert_types ORDER BY name;
-- Should show 5 types (per manager)

SELECT column_name FROM information_schema.columns
WHERE table_name = 'course_candidates' ORDER BY ordinal_position;
-- Should show all 12 columns
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_cert_types_v2.sql
git commit -m "feat: add migration for cert types update and course_candidates table"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add CourseCandidate type**

Add after the EmployeeTask interface in `src/types/database.ts`:

```typescript
export type CandidateStatus = "ממתין" | "נרשם" | "השלים" | "הוסמך";

export const CANDIDATE_STATUSES: CandidateStatus[] = ["ממתין", "נרשם", "השלים", "הוסמך"];

export interface CourseCandidate {
  id: string;
  manager_id: string;
  first_name: string;
  last_name: string;
  id_number: string;
  phone: string | null;
  city: string | null;
  cert_type_id: string;
  cert_type_name?: string; // joined from cert_types
  status: CandidateStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_employee?: boolean; // computed: does id_number match an employee?
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add CourseCandidate type and CandidateStatus"
```

---

## Task 3: Update Excel Parser — Cert Type Names

**Files:**
- Modify: `src/lib/excel-parser.ts` (lines 48-116)

- [ ] **Step 1: Update CANONICAL_CERT_TYPES**

Change line 81 from:
```typescript
const CANONICAL_CERT_TYPES = ["נת״ע", "כביש 6", "PFI"] as const;
```
to:
```typescript
const CANONICAL_CERT_TYPES = ["נת״ע", "כביש 6", "חוצה ישראל", "נתיבי ישראל", "חוצה צפון (PFI)"] as const;
```

- [ ] **Step 2: Update WORKER_SHEETS for PFI rename**

Change the PFI entry in WORKER_SHEETS (around line 51) from:
```typescript
"PFI": { certTypes: ["PFI"], defaultStatus: "פעיל" },
```
to:
```typescript
"PFI": { certTypes: ["חוצה צפון (PFI)"], defaultStatus: "פעיל" },
```

Note: No WORKER_SHEETS entries are added for "חוצה ישראל" or "נתיבי ישראל" because the source Excel files do not have dedicated sheets for these cert types. They are only assigned via the per-row "הסמכה" column, which goes through `normalizeCertTypeName()`. If future Excel files add sheets for these types, add entries to WORKER_SHEETS at that time.

- [ ] **Step 3: Update normalizeCertTypeName()**

**Replace lines 96-97** in `src/lib/excel-parser.ts` (the existing PFI match):
```typescript
  // Case-insensitive match for PFI
  if (/^pfi$/i.test(s)) return ["PFI"];
```
with the expanded block covering all new cert types:
```typescript
  // חוצה ישראל
  if (s === "חוצה ישראל") return ["חוצה ישראל"];

  // נתיבי ישראל
  if (s === "נתיבי ישראל") return ["נתיבי ישראל"];

  // חוצה צפון (PFI) — case-insensitive PFI + Hebrew variants
  if (/^pfi$/i.test(s) || s.includes("חוצה צפון")) {
    return ["חוצה צפון (PFI)"];
  }
```

Note: The function uses variable `s` (not `n`) — see line 90: `let s = raw.trim();`

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/lib/excel-parser.ts
git commit -m "feat: update cert types to 5 — add חוצה ישראל, נתיבי ישראל, rename PFI"
```

---

## Task 4: Update Sidebar Navigation

**Files:**
- Modify: `src/app/dashboard/layout.tsx` (lines 8-16)
- Modify: `src/components/layout/sidebar.tsx` (lines 1-5 imports, 27-35 iconMap, 45-46 guest filter)

- [ ] **Step 1: Add nav item in layout.tsx**

Insert after the cert-types item (line 12) and before tasks:
```typescript
{ label: "מועמדים לקורסים", href: "/dashboard/candidates", icon: "candidates" },
```

The full array becomes:
```typescript
const navItems: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: "dashboard" },
  { label: "עובדים", href: "/dashboard/employees", icon: "employees" },
  { label: "הסמכות", href: "/dashboard/certifications", icon: "certifications" },
  { label: "סוגי הסמכות", href: "/dashboard/cert-types", icon: "cert-types" },
  { label: "מועמדים לקורסים", href: "/dashboard/candidates", icon: "candidates" },
  { label: "משימות", href: "/dashboard/tasks", icon: "tasks" },
  { label: "ייבוא", href: "/dashboard/import", icon: "import" },
  { label: "דוחות", href: "/dashboard/reports", icon: "reports" },
];
```

- [ ] **Step 2: Update sidebar.tsx — icon import**

Add `GraduationCap` to the lucide-react import:
```typescript
import { LayoutDashboard, Users, Award, Tag, FileUp, BarChart3, ClipboardList, GraduationCap } from "lucide-react";
```

- [ ] **Step 3: Update sidebar.tsx — iconMap**

Add to iconMap:
```typescript
candidates: GraduationCap,
```

- [ ] **Step 4: Update sidebar.tsx — guest mode filter**

Update the guest filter to exclude candidates:
```typescript
const filteredItems = isGuest
  ? items.filter(item => !["/dashboard/import", "/dashboard/candidates"].includes(item.href))
  : items;
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/layout.tsx src/components/layout/sidebar.tsx
git commit -m "feat: add candidates nav item to sidebar with GraduationCap icon"
```

---

## Task 5: Server Actions — Candidate CRUD + Promote

**Files:**
- Create: `src/app/dashboard/candidates/actions.ts`

- [ ] **Step 1: Create the server actions file**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CandidateStatus } from "@/types/database";

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

export async function promoteCandidate(id: string) {
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
    // Create new employee
    const { data: newEmp, error: empErr } = await supabase
      .from("employees")
      .insert({
        manager_id: user.id,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        employee_number: candidate.id_number,
        phone: candidate.phone,
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
}

export async function promoteCandidates(ids: string[]) {
  const results = { promoted: 0, errors: [] as string[] };

  for (const id of ids) {
    try {
      await promoteCandidate(id);
      results.promoted++;
    } catch (e) {
      results.errors.push(`${id}: ${e instanceof Error ? e.message : "שגיאה"}`);
    }
  }

  revalidatePath("/dashboard/candidates");
  revalidatePath("/dashboard/employees");
  return results;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/candidates/actions.ts
git commit -m "feat: add server actions for candidate CRUD and promotion"
```

---

## Task 6: Candidate Parser

**Files:**
- Create: `src/lib/candidate-parser.ts`

- [ ] **Step 1: Create the parser**

```typescript
import * as XLSX from "xlsx";
import { normalizeCertTypeName } from "./excel-parser";

export interface ParsedCandidate {
  first_name: string;
  last_name: string;
  id_number: string;
  phone: string | null;
  city: string | null;
  cert_type_name: string | null;
  status: string | null;
  row_number: number;
}

export interface CandidateParseResult {
  candidates: ParsedCandidate[];
  skipped: { row: number; reason: string }[];
  totalRows: number;
}

// Column name mappings (Hebrew variants)
const COL_MAPS: Record<string, string[]> = {
  first_name: ["שם פרטי", "שם_פרטי", "first_name"],
  last_name: ["שם משפחה", "שם_משפחה", "last_name"],
  id_number: ["ת.ז", "ת.ז.", "תעודת זהות", "ת\"ז", "id_number", "id"],
  phone: ["טלפון", "מס' טלפון", "מס׳ טלפון", "phone"],
  city: ["עיר", "מקום מגורים", "city"],
  cert_type: ["סוג הסמכה", "הסמכה", "cert_type"],
  status: ["סטטוס", "status"],
};

function findColumn(headers: string[], field: string): number {
  const variants = COL_MAPS[field] || [];
  for (const v of variants) {
    const idx = headers.findIndex(h => h.trim().toLowerCase() === v.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseCandidateExcel(buffer: ArrayBuffer): CandidateParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length < 2) {
    return { candidates: [], skipped: [], totalRows: 0 };
  }

  const headers = rows[0].map(h => String(h).trim());
  const colIdx = {
    first_name: findColumn(headers, "first_name"),
    last_name: findColumn(headers, "last_name"),
    id_number: findColumn(headers, "id_number"),
    phone: findColumn(headers, "phone"),
    city: findColumn(headers, "city"),
    cert_type: findColumn(headers, "cert_type"),
    status: findColumn(headers, "status"),
  };

  // Require at minimum: first_name or last_name, and id_number
  if (colIdx.id_number === -1) {
    return {
      candidates: [],
      skipped: [{ row: 1, reason: "לא נמצאה עמודת ת.ז בכותרות" }],
      totalRows: rows.length - 1,
    };
  }

  const candidates: ParsedCandidate[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id_number = String(row[colIdx.id_number] || "").trim();

    if (!id_number) {
      skipped.push({ row: i + 1, reason: "ת.ז חסר" });
      continue;
    }

    const first_name = colIdx.first_name >= 0 ? String(row[colIdx.first_name] || "").trim() : "";
    const last_name = colIdx.last_name >= 0 ? String(row[colIdx.last_name] || "").trim() : "";

    if (!first_name && !last_name) {
      skipped.push({ row: i + 1, reason: "שם חסר" });
      continue;
    }

    const rawCertType = colIdx.cert_type >= 0 ? String(row[colIdx.cert_type] || "").trim() : null;
    let cert_type_name: string | null = null;
    if (rawCertType) {
      const normalized = normalizeCertTypeName(rawCertType);
      cert_type_name = normalized.length > 0 ? normalized[0] : rawCertType;
    }

    candidates.push({
      first_name: first_name || "",
      last_name: last_name || "",
      id_number,
      phone: colIdx.phone >= 0 ? String(row[colIdx.phone] || "").trim() || null : null,
      city: colIdx.city >= 0 ? String(row[colIdx.city] || "").trim() || null : null,
      cert_type_name,
      status: colIdx.status >= 0 ? String(row[colIdx.status] || "").trim() || null : null,
      row_number: i + 1,
    });
  }

  return { candidates, skipped, totalRows: rows.length - 1 };
}
```

- [ ] **Step 2: Export normalizeCertTypeName from excel-parser.ts**

In `src/lib/excel-parser.ts`, ensure `normalizeCertTypeName` is exported (add `export` keyword if not already exported).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/candidate-parser.ts src/lib/excel-parser.ts
git commit -m "feat: add candidate Excel parser with Hebrew column mapping"
```

---

## Task 7: Import Server Actions

**Files:**
- Modify: `src/app/dashboard/candidates/actions.ts` (append import actions)

- [ ] **Step 1: Add import actions to the existing actions file**

Append to `src/app/dashboard/candidates/actions.ts`:

```typescript
import { parseCandidateExcel, type ParsedCandidate, type CandidateParseResult } from "@/lib/candidate-parser";

export interface CandidateImportPreview {
  candidates: (ParsedCandidate & { existsInDb: boolean })[];
  skipped: { row: number; reason: string }[];
  totalRows: number;
  certTypeMap: Record<string, string>; // name → id
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

  // Fetch cert types for this manager
  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("id, name")
    .eq("manager_id", user.id);

  const certTypeMap: Record<string, string> = {};
  for (const ct of certTypes || []) {
    certTypeMap[ct.name] = ct.id;
  }

  // Check which candidates already exist
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
  imported: number; // includes both created and updated (upsert)
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/candidates/actions.ts
git commit -m "feat: add candidate import server actions (parse + bulk insert)"
```

---

## Task 8: Candidate Form Component

**Files:**
- Create: `src/components/candidates/candidate-form.tsx`

- [ ] **Step 1: Create the form component**

Follow the pattern from `src/components/employees/employee-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import type { CertType } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import { checkEmployeeByIdNumber } from "@/app/dashboard/candidates/actions";

interface CandidateFormProps {
  action: (formData: FormData) => Promise<void>;
  certTypes: CertType[];
}

const inputClasses =
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";

export function CandidateForm({ action, certTypes }: CandidateFormProps) {
  const [employeeMatch, setEmployeeMatch] = useState<string | null>(null);

  const handleIdBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val.length >= 5) {
      const result = await checkEmployeeByIdNumber(val);
      setEmployeeMatch(result.found ? result.name || null : null);
    } else {
      setEmployeeMatch(null);
    }
  };

  const [error, formAction, isPending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      try {
        await action(formData);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "שגיאה בשמירה";
      }
    },
    null
  );

  return (
    <form action={formAction} className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="first_name" className="mb-1 block text-sm font-medium">שם פרטי *</label>
          <input id="first_name" name="first_name" required className={inputClasses} />
        </div>
        <div>
          <label htmlFor="last_name" className="mb-1 block text-sm font-medium">שם משפחה *</label>
          <input id="last_name" name="last_name" required className={inputClasses} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="id_number" className="mb-1 block text-sm font-medium">ת.ז *</label>
          <input id="id_number" name="id_number" required className={inputClasses} onBlur={handleIdBlur} />
          {employeeMatch && (
            <div className="mt-1 rounded bg-green-50 border border-green-200 px-2 py-1 text-xs text-green-700">
              עובד/ת קיימ/ת: {employeeMatch}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">מס׳ טלפון</label>
          <input id="phone" name="phone" type="tel" className={inputClasses} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="mb-1 block text-sm font-medium">מקום מגורים</label>
          <input id="city" name="city" className={inputClasses} />
        </div>
        <div>
          <label htmlFor="cert_type_id" className="mb-1 block text-sm font-medium">סוג הסמכה *</label>
          <select id="cert_type_id" name="cert_type_id" required className={inputClasses}>
            <option value="">בחר סוג הסמכה</option>
            {certTypes.map(ct => (
              <option key={ct.id} value={ct.id}>{ct.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium">סטטוס</label>
          <select id="status" name="status" defaultValue="ממתין" className={inputClasses}>
            {CANDIDATE_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium">הערות</label>
        <textarea id="notes" name="notes" rows={3} className={inputClasses} />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "שומר..." : "שמור"}
        </button>
        <a
          href="/dashboard/candidates"
          className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          ביטול
        </a>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/candidates/candidate-form.tsx
git commit -m "feat: add candidate form component with cert type dropdown"
```

---

## Task 9: Candidates List Page + Table Component

**Files:**
- Create: `src/app/dashboard/candidates/page.tsx`
- Create: `src/components/candidates/candidates-table.tsx`
- Create: `src/components/candidates/promote-dialog.tsx`

- [ ] **Step 1: Create the promote dialog component**

`src/components/candidates/promote-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";

interface PromoteDialogProps {
  open: boolean;
  candidateNames: string[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function PromoteDialog({ open, candidateNames, onConfirm, onCancel }: PromoteDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" dir="rtl">
        <h3 className="text-lg font-semibold mb-3">קידום לעובדים</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {candidateNames.length === 1
            ? `האם לקדם את ${candidateNames[0]} לעובד/ת?`
            : `האם לקדם ${candidateNames.length} מועמדים לעובדים?`}
        </p>
        {candidateNames.length > 1 && (
          <ul className="mb-4 max-h-40 overflow-y-auto rounded border border-border p-2 text-sm space-y-1">
            {candidateNames.map((name, i) => <li key={i}>{name}</li>)}
          </ul>
        )}
        <p className="text-xs text-muted-foreground mb-4">
          פעולה זו תיצור/תעדכן רשומת עובד ותוסיף הסמכה. סטטוס המועמד ישתנה ל&quot;הוסמך&quot;.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
            ביטול
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? "מקדם..." : "קדם לעובד"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the candidates table client component**

`src/components/candidates/candidates-table.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CourseCandidate, CandidateStatus } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import { updateCandidateStatus, promoteCandidate, promoteCandidates, deleteCandidate } from "@/app/dashboard/candidates/actions";
import { PromoteDialog } from "./promote-dialog";

const statusColors: Record<CandidateStatus, string> = {
  "ממתין": "bg-yellow-100 text-yellow-800",
  "נרשם": "bg-blue-100 text-blue-800",
  "השלים": "bg-green-100 text-green-800",
  "הוסמך": "bg-purple-100 text-purple-800",
};

interface CandidatesTableProps {
  candidates: CourseCandidate[];
}

export function CandidatesTable({ candidates }: CandidatesTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promoteTarget, setPromoteTarget] = useState<{ ids: string[]; names: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map(c => c.id)));
    }
  };

  const handleStatusChange = (id: string, status: CandidateStatus) => {
    setError(null);
    if (status === "הוסמך") {
      const c = candidates.find(c => c.id === id);
      setPromoteTarget({ ids: [id], names: [c ? `${c.first_name} ${c.last_name}` : ""] });
      return;
    }
    startTransition(async () => {
      try {
        await updateCandidateStatus(id, status);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה");
      }
    });
  };

  const handlePromoteSingle = (id: string) => {
    const c = candidates.find(c => c.id === id);
    setPromoteTarget({ ids: [id], names: [c ? `${c.first_name} ${c.last_name}` : ""] });
  };

  const handlePromoteBulk = () => {
    const items = candidates.filter(c => selected.has(c.id));
    setPromoteTarget({
      ids: items.map(c => c.id),
      names: items.map(c => `${c.first_name} ${c.last_name}`),
    });
  };

  const confirmPromote = async () => {
    if (!promoteTarget) return;
    setError(null);
    try {
      if (promoteTarget.ids.length === 1) {
        await promoteCandidate(promoteTarget.ids[0]);
      } else {
        await promoteCandidates(promoteTarget.ids);
      }
      setPromoteTarget(null);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בקידום");
      setPromoteTarget(null);
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm("האם למחוק את המועמד?")) return;
    startTransition(async () => {
      try {
        await deleteCandidate(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה");
      }
    });
  };

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
          <span>{selected.size} מועמדים נבחרו</span>
          <button onClick={handlePromoteBulk}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors">
            קדם לעובדים
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-3 text-right w-10">
                <input type="checkbox" checked={selected.size === candidates.length && candidates.length > 0}
                  onChange={toggleAll} className="rounded" />
              </th>
              <th className="p-3 text-right font-medium">שם מלא</th>
              <th className="p-3 text-right font-medium">ת.ז</th>
              <th className="p-3 text-right font-medium hidden md:table-cell">טלפון</th>
              <th className="p-3 text-right font-medium hidden lg:table-cell">עיר</th>
              <th className="p-3 text-right font-medium">סוג הסמכה</th>
              <th className="p-3 text-right font-medium">סטטוס</th>
              <th className="p-3 text-right font-medium hidden md:table-cell">עובד?</th>
              <th className="p-3 text-right font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map(c => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(c.id)}
                    onChange={() => toggleSelect(c.id)} className="rounded" />
                </td>
                <td className="p-3 font-medium">{c.first_name} {c.last_name}</td>
                <td className="p-3 font-mono text-xs">{c.id_number}</td>
                <td className="p-3 hidden md:table-cell">{c.phone || "—"}</td>
                <td className="p-3 hidden lg:table-cell">{c.city || "—"}</td>
                <td className="p-3">
                  <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                    {c.cert_type_name || "—"}
                  </span>
                </td>
                <td className="p-3">
                  <select
                    value={c.status}
                    onChange={e => handleStatusChange(c.id, e.target.value as CandidateStatus)}
                    disabled={isPending}
                    className={`rounded px-2 py-0.5 text-xs font-medium border-0 ${statusColors[c.status as CandidateStatus] || ""}`}
                  >
                    {CANDIDATE_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3 hidden md:table-cell">
                  {c.is_employee
                    ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">כן ✓</span>
                    : <span className="text-xs text-muted-foreground">לא</span>}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => handlePromoteSingle(c.id)}
                      className="rounded border border-border px-2 py-1 text-xs hover:bg-muted transition-colors">
                      הוסף כעובד
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      aria-label={`מחק ${c.first_name} ${c.last_name}`}>
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PromoteDialog
        open={!!promoteTarget}
        candidateNames={promoteTarget?.names || []}
        onConfirm={confirmPromote}
        onCancel={() => setPromoteTarget(null)}
      />
    </>
  );
}
```

- [ ] **Step 3: Create the candidates list page**

`src/app/dashboard/candidates/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import type { CourseCandidate } from "@/types/database";

const PAGE_SIZE = 25;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cert_type?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  // Fetch cert types for filter dropdown
  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("id, name")
    .eq("manager_id", user.id)
    .order("name");

  // Build query
  let query = supabase
    .from("course_candidates")
    .select("*, cert_types(name)")
    .eq("manager_id", user.id)
    .order("created_at", { ascending: false });

  // Search
  if (params.q) {
    const safe = params.q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,id_number.ilike.%${safe}%`
    );
  }

  // Filters
  if (params.cert_type) query = query.eq("cert_type_id", params.cert_type);
  if (params.status) query = query.eq("status", params.status);

  // Count
  let countQuery = supabase
    .from("course_candidates")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", user.id);
  if (params.q) {
    const safe = params.q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    countQuery = countQuery.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,id_number.ilike.%${safe}%`
    );
  }
  if (params.cert_type) countQuery = countQuery.eq("cert_type_id", params.cert_type);
  if (params.status) countQuery = countQuery.eq("status", params.status);
  const { count } = await countQuery;

  // Paginate
  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const { data: rawCandidates } = await query;

  // Cross-reference with employees to set is_employee flag
  const idNumbers = (rawCandidates || []).map((c: Record<string, unknown>) => c.id_number as string);
  const { data: matchingEmps } = idNumbers.length > 0
    ? await supabase
        .from("employees")
        .select("employee_number")
        .eq("manager_id", user.id)
        .in("employee_number", idNumbers)
    : { data: [] };

  const empSet = new Set((matchingEmps || []).map(e => e.employee_number));

  const candidates: CourseCandidate[] = (rawCandidates || []).map((c: Record<string, unknown>) => ({
    ...c,
    cert_type_name: (c.cert_types as { name: string } | null)?.name || null,
    is_employee: empSet.has(c.id_number as string),
  })) as CourseCandidate[];

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">מועמדים לקורסים</h1>
          <p className="text-sm text-muted-foreground">ניהול מועמדים לקורסי הסמכה</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/candidates/import"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
            ייבוא מקובץ
          </Link>
          <Link href="/dashboard/candidates/new"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
            + הוסף מועמד
          </Link>
        </div>
      </div>

      <form className="flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={params.q || ""}
          placeholder="חיפוש לפי שם או ת.ז..."
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <AutoSubmitSelect name="cert_type" defaultValue={params.cert_type || ""} aria-label="סינון לפי סוג הסמכה">
          <option value="">כל סוגי ההסמכה</option>
          {(certTypes || []).map(ct => (
            <option key={ct.id} value={ct.id}>{ct.name}</option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="status" defaultValue={params.status || ""} aria-label="סינון לפי סטטוס">
          <option value="">כל הסטטוסים</option>
          <option value="ממתין">ממתין</option>
          <option value="נרשם">נרשם</option>
          <option value="השלים">השלים</option>
          <option value="הוסמך">הוסמך</option>
        </AutoSubmitSelect>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm text-white hover:bg-primary/90"
          aria-label="חיפוש מועמדים">
          חיפוש
        </button>
      </form>

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">אין מועמדים</p>
          <p className="text-sm mt-1">הוסף מועמדים באמצעות הטופס או ייבוא מקובץ</p>
        </div>
      ) : (
        <CandidatesTable candidates={candidates} />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link key={p}
              href={`/dashboard/candidates?${new URLSearchParams(Object.fromEntries(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v !== undefined && v !== ""))).toString()}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${p === page ? "bg-primary text-white" : "border border-border hover:bg-muted"}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/candidates/page.tsx src/components/candidates/candidates-table.tsx src/components/candidates/promote-dialog.tsx
git commit -m "feat: add candidates list page with table, search, filters, and promote"
```

---

## Task 10: Add Candidate Form Page

**Files:**
- Create: `src/app/dashboard/candidates/new/page.tsx`

- [ ] **Step 1: Create the new candidate page**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CandidateForm } from "@/components/candidates/candidate-form";
import { createCandidate } from "@/app/dashboard/candidates/actions";

export default async function NewCandidatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: certTypes } = await supabase
    .from("cert_types")
    .select("id, name")
    .eq("manager_id", user.id)
    .order("name");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הוספת מועמד</h1>
        <p className="text-sm text-muted-foreground">הוספת מועמד חדש לקורס הסמכה</p>
      </div>
      <CandidateForm action={createCandidate} certTypes={certTypes || []} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/candidates/new/page.tsx
git commit -m "feat: add new candidate form page"
```

---

## Task 11: Candidate Import Wizard

**Files:**
- Create: `src/components/candidates/candidate-import-wizard.tsx`
- Create: `src/components/candidates/candidate-upload-step.tsx`
- Create: `src/components/candidates/candidate-review-step.tsx`
- Create: `src/components/candidates/candidate-summary-step.tsx`
- Create: `src/app/dashboard/candidates/import/page.tsx`

- [ ] **Step 1: Create upload step**

`src/components/candidates/candidate-upload-step.tsx` — Follow pattern from `src/components/import/upload-step.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { parseCandidateFile, type CandidateImportPreview } from "@/app/dashboard/candidates/actions";

interface UploadStepProps {
  onParsed: (data: CandidateImportPreview) => void;
}

export function CandidateUploadStep({ onParsed }: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx")) {
      setError("יש להעלות קובץ .xlsx בלבד");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("גודל הקובץ חורג מ-5MB");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await parseCandidateFile(fd);
    setLoading(false);
    if (result.success && result.data) {
      onParsed(result.data);
    } else {
      setError(result.error || "שגיאה בקריאת הקובץ");
    }
  };

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => { if (e.key === "Enter") inputRef.current?.click(); }}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        {loading ? (
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">מעבד קובץ...</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg font-medium">גרור קובץ לכאן או לחץ לבחירה</p>
            <p className="mt-1 text-sm text-muted-foreground">קובץ .xlsx עד 5MB</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create review step**

`src/components/candidates/candidate-review-step.tsx`:

```tsx
"use client";

import type { CandidateImportPreview } from "@/app/dashboard/candidates/actions";

interface ReviewStepProps {
  data: CandidateImportPreview;
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}

export function CandidateReviewStep({ data, onConfirm, onBack, loading }: ReviewStepProps) {
  const newCount = data.candidates.filter(c => !c.existsInDb).length;
  const existingCount = data.candidates.filter(c => c.existsInDb).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold">{data.totalRows}</div>
          <div className="text-xs text-muted-foreground">שורות בקובץ</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{newCount}</div>
          <div className="text-xs text-muted-foreground">מועמדים חדשים</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{existingCount}</div>
          <div className="text-xs text-muted-foreground">קיימים (יעודכנו)</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{data.skipped.length}</div>
          <div className="text-xs text-muted-foreground">דילוג</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-2 text-right">שם</th>
              <th className="p-2 text-right">ת.ז</th>
              <th className="p-2 text-right">סוג הסמכה</th>
              <th className="p-2 text-right">סטטוס</th>
              <th className="p-2 text-right">מצב</th>
            </tr>
          </thead>
          <tbody>
            {data.candidates.slice(0, 50).map((c, i) => (
              <tr key={i} className={`border-b last:border-0 ${c.existsInDb ? "bg-gray-50" : "bg-green-50/30"}`}>
                <td className="p-2">{c.first_name} {c.last_name}</td>
                <td className="p-2 font-mono text-xs">{c.id_number}</td>
                <td className="p-2">{c.cert_type_name || "—"}</td>
                <td className="p-2">{c.status || "ממתין"}</td>
                <td className="p-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${c.existsInDb ? "bg-gray-200" : "bg-green-200 text-green-800"}`}>
                    {c.existsInDb ? "קיים" : "חדש"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.candidates.length > 50 && (
          <div className="p-2 text-center text-xs text-muted-foreground">
            מציג 50 מתוך {data.candidates.length} מועמדים
          </div>
        )}
      </div>

      {data.skipped.length > 0 && (
        <details className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-orange-800">
            {data.skipped.length} שורות דולגו
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-orange-700">
            {data.skipped.map((s, i) => (
              <li key={i}>שורה {s.row}: {s.reason}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} disabled={loading}
          className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors">
          חזור
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading ? "מייבא..." : `ייבא ${data.candidates.length} מועמדים`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create summary step**

`src/components/candidates/candidate-summary-step.tsx`:

```tsx
"use client";

import type { CandidateImportResult } from "@/app/dashboard/candidates/actions";

interface SummaryStepProps {
  result: CandidateImportResult;
  onReset: () => void;
}

export function CandidateSummaryStep({ result, onReset }: SummaryStepProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <div className="text-3xl font-bold text-green-700">{result.imported}</div>
        <div className="text-sm text-green-600">מועמדים נוספו/עודכנו בהצלחה</div>
      </div>

      {result.skipped > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
          {result.skipped} מועמדים דולגו
        </div>
      )}

      {result.errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700 mb-2">שגיאות:</p>
          <ul className="space-y-1 text-xs text-red-600">
            {result.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onReset}
          className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted transition-colors">
          ייבוא נוסף
        </button>
        <a href="/dashboard/candidates"
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
          צפה במועמדים
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create wizard component**

`src/components/candidates/candidate-import-wizard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CandidateUploadStep } from "./candidate-upload-step";
import { CandidateReviewStep } from "./candidate-review-step";
import { CandidateSummaryStep } from "./candidate-summary-step";
import { executeCandidateImport, type CandidateImportPreview, type CandidateImportResult } from "@/app/dashboard/candidates/actions";

type Step = "upload" | "review" | "summary";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "העלאת קובץ" },
  { key: "review", label: "סקירה" },
  { key: "summary", label: "סיכום" },
];

export function CandidateImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<CandidateImportPreview | null>(null);
  const [result, setResult] = useState<CandidateImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParsed = (data: CandidateImportPreview) => {
    setPreview(data);
    setError(null);
    setStep("review");
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    try {
      const importData = preview.candidates
        .filter(c => c.cert_type_name && preview.certTypeMap[c.cert_type_name])
        .map(c => ({
          first_name: c.first_name,
          last_name: c.last_name,
          id_number: c.id_number,
          phone: c.phone,
          city: c.city,
          cert_type_id: preview.certTypeMap[c.cert_type_name!],
          status: c.status || "ממתין",
          notes: null,
        }));

      const res = await executeCandidateImport(importData);
      setResult(res);
      setStep("summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בייבוא");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              s.key === step ? "bg-primary text-white" :
              STEPS.findIndex(x => x.key === step) > i ? "bg-green-100 text-green-700" :
              "bg-muted text-muted-foreground"
            }`}>
              {STEPS.findIndex(x => x.key === step) > i ? "✓" : i + 1}
            </div>
            <span className="text-sm hidden sm:inline">{s.label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {step === "upload" && <CandidateUploadStep onParsed={handleParsed} />}
      {step === "review" && preview && (
        <CandidateReviewStep data={preview} onConfirm={handleConfirm} onBack={handleReset} loading={importing} />
      )}
      {step === "summary" && result && (
        <CandidateSummaryStep result={result} onReset={handleReset} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create import page**

`src/app/dashboard/candidates/import/page.tsx`:

```tsx
import { CandidateImportWizard } from "@/components/candidates/candidate-import-wizard";

export default function CandidateImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ייבוא מועמדים</h1>
        <p className="text-sm text-muted-foreground">ייבוא מועמדים לקורסי הסמכה מקובץ Excel</p>
      </div>
      <CandidateImportWizard />
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/candidates/ src/app/dashboard/candidates/import/
git commit -m "feat: add candidate import wizard with upload, review, and summary steps"
```

---

## Task 12: Cross-Validation (Task 3)

**Files:** No code files — this is a verification task.

- [ ] **Step 1: Read both Excel source files**

Read these files and count employees per cert type:
- `C:\Users\maor4\OneDrive\Desktop\כ״א +משימות.xlsx`
- `C:\Users\maor4\OneDrive\Desktop\עותק של מאושרי_נתע_לשיבוץ_מעודכן.xlsx` (source of truth)

- [ ] **Step 2: Query the app database**

Via Supabase or the running app, count employees per cert type and total unique employees.

- [ ] **Step 3: Compare and report**

Produce the comparison table:
| Certification Type | Excel Count | App Count | Match? |
|--------------------|-------------|-----------|--------|

- [ ] **Step 4: Fix any discrepancies**

If mismatches found:
- Missing employees → add via import
- Extra employees → report (no deletion without approval)
- Re-verify after fixes

- [ ] **Step 5: Commit verification results**

Save the comparison table to `docs/cross-validation-results.md` and commit.

```bash
git add docs/cross-validation-results.md
git commit -m "docs: add cross-validation results for employee counts"
```

---

## Task Summary

| Task | Description | Est. Files |
|------|-------------|-----------|
| 1 | DB migration — cert types + course_candidates table | 1 |
| 2 | TypeScript types | 1 |
| 3 | Excel parser — cert type names | 1 |
| 4 | Sidebar navigation | 2 |
| 5 | Server actions — CRUD + promote | 1 |
| 6 | Candidate parser | 2 |
| 7 | Import server actions | 1 |
| 8 | Candidate form component | 1 |
| 9 | Candidates list page + table | 3 |
| 10 | New candidate form page | 1 |
| 11 | Import wizard (4 components + page) | 5 |
| 12 | Cross-validation | 1 |
| **Total** | | **20** |
