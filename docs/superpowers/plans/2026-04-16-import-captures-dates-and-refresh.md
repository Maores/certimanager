# Capture dates + next_refresh on import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The xlsx importer captures `תוקף תעודה` and `מועד רענון הבא` from the נת״ע file and persists them as `issue_date`, `expiry_date`, and a new `next_refresh_date` field on the `certifications` table. Re-imports apply a monotonic field-level merge (never overwrite real data with null, never silently skip newer data).

**Architecture:** Add one nullable DB column. Parser reads both date columns and applies a two-regime disambiguation rule. Import action compares effective dates and merges field-by-field. `getCertStatus` is extended to consider both `expiry_date` and `next_refresh_date`. UI surfaces the new field in form, cert list, employee detail, and import review step.

**Tech Stack:** Next.js 16, React 19, Supabase Postgres, TypeScript, Vitest (`npm test`), Tailwind CSS, `xlsx` package for Excel parsing.

**Spec:** [docs/superpowers/specs/2026-04-16-import-captures-dates-and-refresh.md](../specs/2026-04-16-import-captures-dates-and-refresh.md)

**Branch:** `feat/import-captures-dates-and-refresh` (branched from `master` at `c146d87`). Spec already committed.

**Domain glossary for the implementer:**

- `נת״ע` — an Israeli highway-infrastructure certification program. `"מאושרי נת״ע"` = "approved-for-נת״ע workers".
- `תוקף תעודה` — literally "certificate validity". In regime 1 it means `issue_date`; in regime 2 it means `expiry_date`.
- `מועד רענון הבא` — "next refresh date" — when the cert needs to be refreshed.
- **Regime 1:** the file row has both columns populated. `תוקף תעודה` → `issue_date`, `מועד רענון הבא` → `next_refresh_date`, `expiry_date` remains null.
- **Regime 2:** the file row has only `תוקף תעודה` populated. It means `expiry_date`. `issue_date` and `next_refresh_date` remain null.
- Monotonic merge: "file row wins" only if its effective date (`max(issue, expiry, next_refresh)`) is strictly later than the DB's. When it wins, we merge field-by-field — never overwriting non-null DB fields with null.

---

## File Structure Map

**Created:**
- `supabase/migration_next_refresh_date.sql` — adds the column.
- `src/lib/cert-merge.ts` — pure `decideCertMerge()` function (testable without a DB).
- `src/__tests__/cert-merge.test.ts` — unit tests for decideCertMerge.
- `src/__tests__/cert-status.test.ts` — unit tests for the expanded `getCertStatus`.

**Modified:**
- `supabase/schema.sql` — new column in the `certifications` DDL.
- `src/types/database.ts` — `Certification` interface + `getCertStatus` signature.
- `src/lib/guest-store.ts` — seed defaults + create/update handling for the new field.
- `src/lib/excel-parser.ts` — `parseExcelDate` helper + two date columns + regime disambiguation + per-cert-type date map on merged workers.
- `src/__tests__/excel-parser.test.ts` — tests for parseExcelDate and the new columns.
- `src/app/dashboard/import/actions.ts` — `SerializedWorker` gains `certDatesByType`; `executeBulkImport` uses decideCertMerge.
- `src/components/import/review-step.tsx` — show per-cert-type dates.
- `src/components/certifications/certification-form.tsx` — optional dates + new input.
- `src/app/dashboard/certifications/actions.ts` — read/write `next_refresh_date` in create/update (guest + supabase branches).
- `src/app/dashboard/certifications/page.tsx` — select the new column, render it (desktop + mobile), pass both dates to `getCertStatus`.
- `src/app/dashboard/employees/[id]/page.tsx` — select the new column, render refresh line, pass both dates.

**Not touched:**
- Existing tests remain green without modification (backward-compatible `getCertStatus` signature via optional second param).
- Cert list filters, sort, search: unchanged.
- Email/notification logic: none affected.

---

## Task 1: Schema migration + TS interface + guest-store defaults

**Files:**
- Create: `supabase/migration_next_refresh_date.sql`
- Modify: `supabase/schema.sql` (line 40–50 — `certifications` DDL block)
- Modify: `src/types/database.ts:31` — `Certification` interface
- Modify: `src/lib/guest-store.ts:44–49` — seeded certs + create/update payload shape

No test for this task — schema and type changes compile-verify only. Apps don't run against the migration until it's applied to the Supabase instance; that's a deployment step covered in Task 14.

- [ ] **Step 1: Create the migration file**

Create `supabase/migration_next_refresh_date.sql` with content:

```sql
-- Add next_refresh_date column to certifications table.
-- Captures "מועד רענון הבא" from the נת״ע xlsx export (regime 1 rows).
-- Nullable because most historical certs and regime-2 rows will not have it.

ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS next_refresh_date DATE;
```

- [ ] **Step 2: Update `supabase/schema.sql`**

In `supabase/schema.sql`, locate the `CREATE TABLE certifications` block (around line 40). Add the new column between `expiry_date` and `image_url`:

```sql
CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  cert_type_id UUID NOT NULL REFERENCES cert_types(id) ON DELETE RESTRICT,
  issue_date DATE,
  expiry_date DATE,
  next_refresh_date DATE,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Keep existing columns exactly as they were. Only the new `next_refresh_date DATE` line is added.

- [ ] **Step 3: Update `Certification` interface**

In `src/types/database.ts`, modify the `Certification` interface (around line 31) to add the new field between `expiry_date` and `image_url`:

```ts
export interface Certification {
  id: string;
  employee_id: string;
  cert_type_id: string;
  cert_type_name?: string;
  issue_date: string | null;
  expiry_date: string | null;
  next_refresh_date: string | null;
  image_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Update guest-store seed certs**

In `src/lib/guest-store.ts`, the `certifications` array near line 44 seeds five guest certs. Add `next_refresh_date: null` to each:

```ts
const certifications: Certification[] = [
  { id: "g-cert-1", employee_id: "g-emp-1", cert_type_id: "g-ct-1", issue_date: "2025-06-01", expiry_date: sixtyDays, next_refresh_date: null, image_url: null, notes: null, created_at: now, updated_at: now },
  { id: "g-cert-2", employee_id: "g-emp-1", cert_type_id: "g-ct-2", issue_date: "2025-01-15", expiry_date: tenDaysAgo, next_refresh_date: null, image_url: null, notes: null, created_at: now, updated_at: now },
  { id: "g-cert-3", employee_id: "g-emp-2", cert_type_id: "g-ct-1", issue_date: "2025-08-01", expiry_date: fiveDays, next_refresh_date: null, image_url: null, notes: null, created_at: now, updated_at: now },
  { id: "g-cert-4", employee_id: "g-emp-3", cert_type_id: "g-ct-3", issue_date: "2025-03-10", expiry_date: thirtyDays, next_refresh_date: null, image_url: null, notes: null, created_at: now, updated_at: now },
  { id: "g-cert-5", employee_id: "g-emp-4", cert_type_id: "g-ct-2", issue_date: "2025-09-01", expiry_date: sixtyDays, next_refresh_date: null, image_url: null, notes: null, created_at: now, updated_at: now },
];
```

(No other changes to `guest-store.ts` in this task — the create/update functions use `Partial<Certification>` and `Omit<Certification, ...>` which both pick up the new field automatically.)

- [ ] **Step 5: Bridge call sites to keep the build green**

Because the `Certification` type now requires `next_refresh_date`, `Omit<Certification, ...>` in `guestCreateCertification`/`guestUpdateCertification` signatures also requires it. The callers in `src/app/dashboard/certifications/actions.ts` would otherwise fail TypeScript until Task 9 wires FormData. Bridge them now by passing `next_refresh_date: null`.

In `src/app/dashboard/certifications/actions.ts`, find each call to `guestCreateCertification` (there's one in `createCertification`) and each call to `guestUpdateCertification` (one in `updateCertification`). In the object literal passed as the cert payload, add `next_refresh_date: null` between `expiry_date` and `image_url`:

```ts
    await guestCreateCertification(guestSid, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: null,
      image_url: image_url || null,
      notes: notes || null,
    });
```

```ts
    const success = await guestUpdateCertification(guestSid, id, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: null,
      image_url: image_url || null,
      notes: notes || null,
    });
```

Task 9 will replace the `null` with `formData.get("next_refresh_date")` handling. For now, `null` keeps types happy and preserves today's behavior exactly (the form still only submits two dates, so `null` matches reality until the form is extended in Task 10).

Also add `next_refresh_date: null` to the two supabase-branch `insert`/`update` object literals in the same file, for the same reason:

```ts
  const { error } = await supabase.from("certifications").insert({
    employee_id,
    cert_type_id,
    issue_date: issue_date || null,
    expiry_date: expiry_date || null,
    next_refresh_date: null,
    image_url: image_url || null,
    notes: notes || null,
  });
```

```ts
  const { error } = await supabase
    .from("certifications")
    .update({
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: null,
      image_url: image_url || null,
      notes: notes || null,
    })
    .eq("id", id);
```

(The supabase `insert`/`update` don't strictly require this for typecheck because the client is typed loosely, but including `next_refresh_date: null` now ensures the DB column is explicit and the patch is obvious when Task 9 replaces it.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no TypeScript errors anywhere.

- [ ] **Step 7: Commit**

```bash
git add supabase/migration_next_refresh_date.sql supabase/schema.sql src/types/database.ts src/lib/guest-store.ts src/app/dashboard/certifications/actions.ts
git commit -m "feat(schema): add next_refresh_date column to certifications

New nullable DATE column captures 'מועד רענון הבא' from נת״ע xlsx files.
Migration file follows the project's flat-file pattern (no migrations/ dir).
Updates Certification TS interface, guest-store seed defaults, and bridges
the cert create/update actions to pass the new field as null (Task 9 will
wire it from FormData)."
```

---

## Task 2: Extend `getCertStatus` to consider next_refresh_date

**Files:**
- Create: `src/__tests__/cert-status.test.ts`
- Modify: `src/types/database.ts:88–105` — `getCertStatus` function

The new signature is backward-compatible: the second parameter is optional. Callers that only care about `expiry_date` don't need updating. Callers that also have `next_refresh_date` pass it explicitly.

- [ ] **Step 1: Write the failing test file**

Create `src/__tests__/cert-status.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCertStatus } from "@/types/database";

describe("getCertStatus", () => {
  // Freeze "today" at 2026-04-16 for deterministic tests.
  const FROZEN_TODAY = new Date(2026, 3, 16); // April 16, 2026 (month is 0-indexed)

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("legacy one-argument usage (expiry only)", () => {
    it("returns 'unknown' when expiry is null", () => {
      expect(getCertStatus(null)).toBe("unknown");
    });

    it("returns 'expired' when expiry is before today", () => {
      expect(getCertStatus("2026-04-15")).toBe("expired");
    });

    it("returns 'expiring_soon' when expiry is within 30 days", () => {
      expect(getCertStatus("2026-05-01")).toBe("expiring_soon");
    });

    it("returns 'valid' when expiry is more than 30 days out", () => {
      expect(getCertStatus("2026-06-01")).toBe("valid");
    });
  });

  describe("two-argument usage (expiry + refresh)", () => {
    it("returns 'unknown' when both are null", () => {
      expect(getCertStatus(null, null)).toBe("unknown");
    });

    it("uses refresh when expiry is null", () => {
      expect(getCertStatus(null, "2026-04-15")).toBe("expired");
      expect(getCertStatus(null, "2026-05-01")).toBe("expiring_soon");
      expect(getCertStatus(null, "2026-06-01")).toBe("valid");
    });

    it("uses expiry when refresh is null", () => {
      expect(getCertStatus("2026-04-15", null)).toBe("expired");
    });

    it("uses the earlier of the two when both are populated", () => {
      // Refresh 2026-04-15 (expired), expiry 2026-06-01 (valid) → expired (refresh earlier)
      expect(getCertStatus("2026-06-01", "2026-04-15")).toBe("expired");
      // Refresh 2026-06-01 (valid), expiry 2026-04-15 (expired) → expired (expiry earlier)
      expect(getCertStatus("2026-04-15", "2026-06-01")).toBe("expired");
      // Both within 30-day window → expiring_soon
      expect(getCertStatus("2026-05-10", "2026-05-05")).toBe("expiring_soon");
      // Both far out → valid
      expect(getCertStatus("2026-07-01", "2026-08-01")).toBe("valid");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/cert-status.test.ts`
Expected: tests fail on the two-argument cases (current `getCertStatus` ignores the second argument). The one-argument cases may still pass since they exercise the existing behavior.

- [ ] **Step 3: Implement the new signature**

In `src/types/database.ts`, replace the `getCertStatus` function (lines 88–105) with:

```ts
export function getCertStatus(
  expiryDate: string | null,
  nextRefreshDate?: string | null,
): CertStatus {
  // Effective deadline is the earlier of the two populated dates.
  const dates = [expiryDate, nextRefreshDate].filter(
    (d): d is string => !!d,
  );
  if (dates.length === 0) return "unknown";
  // Dates are "YYYY-MM-DD" and lexicographically comparable.
  const effective = dates.reduce((a, b) => (a < b ? a : b));

  // Normalize to date-only comparison (YYYY-MM-DD) to avoid timezone issues
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  if (effective < todayStr) return "expired";

  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyStr = `${thirtyDays.getFullYear()}-${String(thirtyDays.getMonth() + 1).padStart(2, '0')}-${String(thirtyDays.getDate()).padStart(2, '0')}`;

  if (effective <= thirtyStr) return "expiring_soon";
  return "valid";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/cert-status.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Run full test suite to confirm no regression**

Run: `npx vitest run`
Expected: all pre-existing tests remain green. The extended `getCertStatus` is called with one argument in `src/app/dashboard/certifications/page.tsx` and `src/app/dashboard/employees/[id]/page.tsx` — the optional second parameter means those calls still compile and behave exactly as before.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/__tests__/cert-status.test.ts
git commit -m "feat(status): extend getCertStatus to consider next_refresh_date

getCertStatus(expiry, refresh?) uses min(populated) as the effective
deadline. One-argument callers keep existing behavior via optional param."
```

---

## Task 3: Add `parseExcelDate` helper with full test coverage

**Files:**
- Modify: `src/lib/excel-parser.ts` — add exported helper near the other normalizers.
- Modify: `src/__tests__/excel-parser.test.ts` — add a `describe("parseExcelDate", ...)` block.

The xlsx package can return a cell value as:
- A number (Excel date serial, days since 1900-01-01)
- A string (pre-formatted, e.g., `"2025-06-01"` or `"01/06/2025"`)
- Empty string or undefined

The helper normalizes all variants to `YYYY-MM-DD` (string) or `null`.

- [ ] **Step 1: Append the failing tests to `excel-parser.test.ts`**

At the bottom of `src/__tests__/excel-parser.test.ts` (after all existing `describe` blocks, inside the file), add:

```ts
// ---------------------------------------------------------------------------
// parseExcelDate
// ---------------------------------------------------------------------------
import { parseExcelDate } from "@/lib/excel-parser";

describe("parseExcelDate", () => {
  it("returns null for empty, undefined, dash, whitespace", () => {
    expect(parseExcelDate(undefined)).toBeNull();
    expect(parseExcelDate(null)).toBeNull();
    expect(parseExcelDate("")).toBeNull();
    expect(parseExcelDate("-")).toBeNull();
    expect(parseExcelDate("   ")).toBeNull();
  });

  it("parses an Excel date serial number (days since 1900)", () => {
    // 45658 is 2025-01-01 in Excel's calendar (roughly — with the classic off-by-one)
    // 45292 is 2024-01-01
    expect(parseExcelDate(45292)).toBe("2024-01-01");
    expect(parseExcelDate(45658)).toBe("2025-01-01");
  });

  it("parses an ISO-style string date", () => {
    expect(parseExcelDate("2025-06-01")).toBe("2025-06-01");
    expect(parseExcelDate("2024-12-31")).toBe("2024-12-31");
  });

  it("parses a DD/MM/YYYY string (Hebrew locale format)", () => {
    expect(parseExcelDate("01/06/2025")).toBe("2025-06-01");
    expect(parseExcelDate("31/12/2024")).toBe("2024-12-31");
  });

  it("parses a DD.MM.YYYY string", () => {
    expect(parseExcelDate("01.06.2025")).toBe("2025-06-01");
  });

  it("parses a DD-MM-YYYY string", () => {
    expect(parseExcelDate("01-06-2025")).toBe("2025-06-01");
  });

  it("returns null for garbage strings", () => {
    expect(parseExcelDate("not a date")).toBeNull();
    expect(parseExcelDate("abc/def/ghi")).toBeNull();
  });

  it("returns null for impossible dates", () => {
    expect(parseExcelDate("32/01/2025")).toBeNull(); // day 32
    expect(parseExcelDate("01/13/2025")).toBeNull(); // month 13
  });

  it("accepts a Date object (xlsx sometimes parses serials eagerly)", () => {
    expect(parseExcelDate(new Date(2025, 5, 1))).toBe("2025-06-01"); // June is month index 5
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/excel-parser.test.ts -t "parseExcelDate"`
Expected: fails — `parseExcelDate` is not exported.

- [ ] **Step 3: Implement `parseExcelDate` in `src/lib/excel-parser.ts`**

Add this function right after the `normalizeStatus` function (around line 138) in `src/lib/excel-parser.ts`:

```ts
/**
 * Parse a cell value from xlsx into a "YYYY-MM-DD" string or null.
 * Accepts Excel date serials (number), Date objects, and common string formats
 * including ISO (YYYY-MM-DD) and Hebrew-locale DD/MM/YYYY (also .- separators).
 * Returns null for empty, invalid, or impossible dates.
 */
export function parseExcelDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // Date object: xlsx with cellDates:true produces these.
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return formatDateLocal(raw);
  }

  // Excel date serial (number): days since 1899-12-30 (Excel's epoch).
  if (typeof raw === "number") {
    if (!isFinite(raw) || raw <= 0) return null;
    // Excel serial 1 = 1900-01-01 (actually 1899-12-31 due to the 1900 leap bug).
    // The well-known formula: days since 1899-12-30.
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return formatDateLocalUTC(d);
  }

  // String: trim, reject empty/dash/whitespace, then try known formats.
  const s = String(raw).trim();
  if (!s || s === "-") return null;

  // ISO-like: YYYY-MM-DD (optionally with time suffix)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return validateYmd(+y, +m, +d);
  }

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY (Hebrew-locale common formats)
  const dmy = /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return validateYmd(+y, +m, +d);
  }

  return null;
}

function validateYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  // Use UTC to avoid timezone drift; validate that the round-trip matches.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLocalUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/excel-parser.test.ts -t "parseExcelDate"`
Expected: all 9 `parseExcelDate` tests pass.

- [ ] **Step 5: Run full excel-parser test suite to confirm no regression**

Run: `npx vitest run src/__tests__/excel-parser.test.ts`
Expected: all pre-existing parser tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/excel-parser.ts src/__tests__/excel-parser.test.ts
git commit -m "feat(parser): add parseExcelDate helper

Normalizes xlsx cell values (Date, serial number, ISO/DMY strings) into
YYYY-MM-DD or null. Used by the upcoming date-column capture logic."
```

---

## Task 4: Read the two date columns + apply two-regime disambiguation in `parseExcel`

**Files:**
- Modify: `src/lib/excel-parser.ts` — `ParsedWorker` interface + `parseExcel` function body.
- Modify: `src/__tests__/excel-parser.test.ts` — new tests for regime 1 / 2 / empty.

This task extends the per-row parsing. Cross-sheet merge of per-cert-type dates comes in Task 5.

- [ ] **Step 1: Append the failing tests**

Append inside the `describe("parseExcel", ...)` block in `src/__tests__/excel-parser.test.ts` (before the closing `});` of that block):

```ts
  // -------------------------------------------------------------------------
  // Date column capture with two-regime disambiguation
  // -------------------------------------------------------------------------
  describe("date columns", () => {
    it("regime 1: both columns populated → issue + next_refresh, expiry null", () => {
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "01/06/2025", "01/06/2026"],
          ],
        },
      ]);
      const result = parseExcel(buf);
      const worker = result.sheets[0].workers[0];
      expect(worker.certDates).toEqual({
        issue_date: "2025-06-01",
        expiry_date: null,
        next_refresh_date: "2026-06-01",
      });
    });

    it("regime 2: only תוקף תעודה populated → expiry only", () => {
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "01/12/2026", ""],
          ],
        },
      ]);
      const result = parseExcel(buf);
      const worker = result.sheets[0].workers[0];
      expect(worker.certDates).toEqual({
        issue_date: null,
        expiry_date: "2026-12-01",
        next_refresh_date: null,
      });
    });

    it("both columns empty → all three dates null", () => {
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "", ""],
          ],
        },
      ]);
      const result = parseExcel(buf);
      const worker = result.sheets[0].workers[0];
      expect(worker.certDates).toEqual({
        issue_date: null,
        expiry_date: null,
        next_refresh_date: null,
      });
    });

    it("garbage refresh value falls back to regime 2", () => {
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "01/12/2026", "not a date"],
          ],
        },
      ]);
      const result = parseExcel(buf);
      const worker = result.sheets[0].workers[0];
      // Invalid refresh → treat as regime 2 (expiry-only)
      expect(worker.certDates).toEqual({
        issue_date: null,
        expiry_date: "2026-12-01",
        next_refresh_date: null,
      });
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/excel-parser.test.ts -t "date columns"`
Expected: fails — `certDates` property does not exist on `ParsedWorker`.

- [ ] **Step 3: Extend `ParsedWorker` interface**

In `src/lib/excel-parser.ts`, update the `ParsedWorker` interface (top of file) by adding a new field:

```ts
export interface CertDates {
  issue_date: string | null;
  expiry_date: string | null;
  next_refresh_date: string | null;
}

export interface ParsedWorker {
  employeeNumber: string;
  rawEmployeeNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  statusWarning: boolean;
  notes: string;
  responsible: string;
  sourceSheet: string;
  certTypeName: string | null;
  certDates: CertDates;
}
```

- [ ] **Step 4: Read the new columns + apply disambiguation inside `parseExcel`**

In `src/lib/excel-parser.ts`, inside the `parseExcel` function, in the column-index-map section (around line 193–199), add two new column lookups:

```ts
    const tokefTeudaCol = colIdx(["תוקף תעודה"]);
    const moedRenoonCol = colIdx(["מועד רענון הבא"]);
```

Then in the per-row loop, after the `responsible` line (around line 234) and BEFORE the `Determine cert types` block, add:

```ts
      // --- Date columns with two-regime disambiguation ---
      const tokefTeudaRaw = tokefTeudaCol >= 0 ? row[tokefTeudaCol] : undefined;
      const moedRenoonRaw = moedRenoonCol >= 0 ? row[moedRenoonCol] : undefined;
      const moedRenoonParsed = parseExcelDate(moedRenoonRaw);
      const tokefTeudaParsed = parseExcelDate(tokefTeudaRaw);

      const certDates: CertDates =
        moedRenoonParsed !== null
          ? {
              issue_date: tokefTeudaParsed,
              expiry_date: null,
              next_refresh_date: moedRenoonParsed,
            }
          : {
              issue_date: null,
              expiry_date: tokefTeudaParsed,
              next_refresh_date: null,
            };
```

Then in the `worker: ParsedWorker = { ... }` object literal (around line 245), add `certDates` as the last property:

```ts
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
        certTypeName: effectiveCertTypes[0] ?? null,
        certDates,
      };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/excel-parser.test.ts -t "date columns"`
Expected: all 4 regime tests pass.

- [ ] **Step 6: Run full excel-parser test suite**

Run: `npx vitest run src/__tests__/excel-parser.test.ts`
Expected: all pre-existing tests still pass. The new `certDates` field is present on every worker (as `{null, null, null}` for rows without date columns).

- [ ] **Step 7: Commit**

```bash
git add src/lib/excel-parser.ts src/__tests__/excel-parser.test.ts
git commit -m "feat(parser): capture תוקף תעודה + מועד רענון הבא with regime disambiguation

If מועד רענון הבא parses to a date, תוקף תעודה = issue_date and we set
next_refresh_date. Otherwise תוקף תעודה = expiry_date. New certDates field
on ParsedWorker. Covered by unit tests."
```

---

## Task 5: Thread per-cert-type dates through the merged `uniqueWorkers` map

**Files:**
- Modify: `src/lib/excel-parser.ts` — extend the unique-worker merge to carry a `Map<certTypeName, CertDates>`.
- Modify: `src/__tests__/excel-parser.test.ts` — add a test for a worker appearing in two sheets with different cert types and different date regimes.

Today, `uniqueWorkers.get(empNum)` returns `ParsedWorker & { certTypeNames: string[] }`. We need to also carry the date tuple per cert-type, because one worker can have a different regime on different cert types (the reference file has this pattern).

- [ ] **Step 1: Append the failing test**

Append inside the `describe("parseExcel", ...)` block, after the `"date columns"` describe:

```ts
  it("merges per-cert-type dates across sheets for the same worker", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          // regime 1 on נת״ע
          ["123456789", "כהן", "דוד", "01/06/2025", "01/06/2026"],
        ],
      },
      {
        name: "מאושרי כביש 6",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          // regime 2 on כביש 6
          ["123456789", "כהן", "דוד", "01/12/2027", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    const merged = result.uniqueWorkers.get("123456789")!;
    expect(merged.certTypeNames.sort()).toEqual(["כביש 6", "נת״ע"]);
    expect(merged.certDatesByType["נת״ע"]).toEqual({
      issue_date: "2025-06-01",
      expiry_date: null,
      next_refresh_date: "2026-06-01",
    });
    expect(merged.certDatesByType["כביש 6"]).toEqual({
      issue_date: null,
      expiry_date: "2027-12-01",
      next_refresh_date: null,
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/excel-parser.test.ts -t "per-cert-type dates"`
Expected: fails — `certDatesByType` does not exist on the merged worker.

- [ ] **Step 3: Extend `ParseResult.uniqueWorkers` entry shape**

In `src/lib/excel-parser.ts`, update the `ParseResult` interface:

```ts
export interface ParseResult {
  sheets: ParsedSheet[];
  uniqueWorkers: Map<
    string,
    ParsedWorker & {
      certTypeNames: string[];
      certDatesByType: Record<string, CertDates>;
    }
  >;
  certTypeNames: string[];
  noCertWorkers: ParsedWorker[];
  totalParsed: number;
  totalSkipped: number;
}
```

- [ ] **Step 4: Initialize and merge the `certDatesByType` map in `parseExcel`**

Inside `parseExcel`, inside the per-row loop, replace the existing `uniqueWorkers` merge block (around lines 261–279) with:

```ts
      if (uniqueWorkers.has(empNum)) {
        const existing = uniqueWorkers.get(empNum)!;
        for (const ct of effectiveCertTypes) {
          if (!existing.certTypeNames.includes(ct)) {
            existing.certTypeNames.push(ct);
          }
          // Last writer wins for (empNum, certType) — subsequent same-type row
          // on another sheet overwrites. Previously-seen types are not changed
          // unless the new row has the same cert type.
          existing.certDatesByType[ct] = certDates;
        }
        if (notes && !existing.notes.includes(notes)) {
          existing.notes = existing.notes ? `${existing.notes}\n${notes}` : notes;
        }
      } else {
        const datesByType: Record<string, CertDates> = {};
        for (const ct of effectiveCertTypes) {
          datesByType[ct] = certDates;
        }
        uniqueWorkers.set(empNum, {
          ...worker,
          certTypeNames: [...effectiveCertTypes],
          certDatesByType: datesByType,
        });
        if (effectiveCertTypes.length === 0) {
          noCertWorkers.push(worker);
        }
      }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/excel-parser.test.ts -t "per-cert-type dates"`
Expected: passes.

- [ ] **Step 6: Run full excel-parser test suite**

Run: `npx vitest run src/__tests__/excel-parser.test.ts`
Expected: all tests pass, including the new per-cert-type merge test.

- [ ] **Step 7: Commit**

```bash
git add src/lib/excel-parser.ts src/__tests__/excel-parser.test.ts
git commit -m "feat(parser): track per-cert-type dates on merged unique workers

uniqueWorkers now carries certDatesByType: Record<certTypeName, CertDates>.
Needed because one worker can have different regimes on different cert
types (observed in the reference נת״ע file)."
```

---

## Task 6: Serialize per-cert-type dates through `parseExcelFile`

**Files:**
- Modify: `src/app/dashboard/import/actions.ts` — `SerializedWorker` interface + the serialization loop in `parseExcelFile`.

Propagate the new `certDatesByType` through the server-action serialized form so the review step and `executeBulkImport` can both read it.

No test in this task (it's a data-shape change — coverage comes via the executeBulkImport tests in Task 8 and the manual E2E verification in Task 14).

- [ ] **Step 1: Import `CertDates` type and extend `SerializedWorker`**

In `src/app/dashboard/import/actions.ts`, top of file imports (around line 6), add `CertDates` to the import:

```ts
import { parseExcel, type CertDates } from "@/lib/excel-parser";
```

Then update `SerializedWorker` interface (around line 12):

```ts
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
```

- [ ] **Step 2: Populate `certDatesByType` in the serialization loop**

In `parseExcelFile` function, inside the `serialized` object construction (around line 120), in the `.map` callback, add `certDatesByType`:

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `review-step.tsx` reports "does not have property certDatesByType", ignore — Task 10 covers that file. Only errors originating in `actions.ts` need to be clean here.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/import/actions.ts
git commit -m "feat(import): thread certDatesByType into SerializedWorker

Per-cert-type dates are now carried through the server-action boundary so
the review step and executeBulkImport can see them."
```

---

## Task 7: Pure `decideCertMerge` function with full monotonic merge test coverage

**Files:**
- Create: `src/lib/cert-merge.ts`
- Create: `src/__tests__/cert-merge.test.ts`

Extract the monotonic field-level merge decision into a pure function so it can be unit-tested without a database. `executeBulkImport` (Task 8) becomes a thin orchestration layer on top of this.

- [ ] **Step 1: Write the failing test file**

Create `src/__tests__/cert-merge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decideCertMerge } from "@/lib/cert-merge";
import type { CertDates } from "@/lib/excel-parser";

const EMPTY: CertDates = { issue_date: null, expiry_date: null, next_refresh_date: null };

describe("decideCertMerge", () => {
  describe("insert (no existing row)", () => {
    it("returns insert with file's dates when existing is null", () => {
      const file: CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      expect(decideCertMerge(file, null)).toEqual({ action: "insert", merged: file });
    });

    it("inserts regime-2 dates when existing is null", () => {
      const file: CertDates = { issue_date: null, expiry_date: "2026-12-01", next_refresh_date: null };
      expect(decideCertMerge(file, null)).toEqual({ action: "insert", merged: file });
    });

    it("inserts all-nulls row when existing is null (edge)", () => {
      expect(decideCertMerge(EMPTY, null)).toEqual({ action: "insert", merged: EMPTY });
    });
  });

  describe("skip", () => {
    it("skips when file has no dates at all", () => {
      const db: CertDates = { issue_date: "2024-01-01", expiry_date: null, next_refresh_date: "2025-01-01" };
      expect(decideCertMerge(EMPTY, db)).toEqual({ action: "skip" });
    });

    it("skips when db effective date is later than file", () => {
      const file: CertDates = { issue_date: null, expiry_date: "2025-06-01", next_refresh_date: null };
      const db: CertDates = { issue_date: null, expiry_date: "2026-06-01", next_refresh_date: null };
      expect(decideCertMerge(file, db)).toEqual({ action: "skip" });
    });

    it("skips when effective dates are equal (strict >)", () => {
      const same = "2026-06-01";
      const file: CertDates = { issue_date: null, expiry_date: same, next_refresh_date: null };
      const db: CertDates = { issue_date: null, expiry_date: same, next_refresh_date: null };
      expect(decideCertMerge(file, db)).toEqual({ action: "skip" });
    });
  });

  describe("update — field-level merge", () => {
    it("updates when db has all-null dates and file has data", () => {
      const file: CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      const db = EMPTY;
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" },
      });
    });

    it("updates file-wins, same regime (regime 1 → regime 1)", () => {
      const file: CertDates = { issue_date: "2026-06-01", expiry_date: null, next_refresh_date: "2027-06-01" };
      const db:   CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2026-06-01", expiry_date: null, next_refresh_date: "2027-06-01" },
      });
    });

    it("updates file-wins, cross-regime (regime 1 file, regime 2 db) — preserves db expiry (file null)", () => {
      const file: CertDates = { issue_date: "2026-06-01", expiry_date: null, next_refresh_date: "2027-06-01" };
      const db:   CertDates = { issue_date: null, expiry_date: "2025-12-01", next_refresh_date: null };
      // fileEffective = 2027-06-01, dbEffective = 2025-12-01 → file wins.
      // Merge: file's non-null fields overwrite. file.expiry is null → db.expiry kept.
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2026-06-01", expiry_date: "2025-12-01", next_refresh_date: "2027-06-01" },
      });
    });

    it("updates file-wins, cross-regime (regime 2 file, regime 1 db) — preserves db issue and refresh (both null in file)", () => {
      const file: CertDates = { issue_date: null, expiry_date: "2028-12-01", next_refresh_date: null };
      const db:   CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      // fileEffective = 2028-12-01, dbEffective = 2026-06-01 → file wins.
      // Merge: file.issue and file.refresh are null → db values kept.
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2025-06-01", expiry_date: "2028-12-01", next_refresh_date: "2026-06-01" },
      });
    });

    it("never overwrites a non-null db field with a null file field (invariant)", () => {
      const file: CertDates = { issue_date: "2027-01-01", expiry_date: null, next_refresh_date: null };
      const db:   CertDates = { issue_date: "2024-01-01", expiry_date: "2025-06-01", next_refresh_date: "2026-06-01" };
      // fileEffective = 2027-01-01, dbEffective = 2026-06-01 → file wins.
      // Merge: only issue_date overwrites; expiry and refresh kept from db.
      const result = decideCertMerge(file, db);
      expect(result.action).toBe("update");
      if (result.action === "update") {
        expect(result.merged.issue_date).toBe("2027-01-01");
        expect(result.merged.expiry_date).toBe("2025-06-01");
        expect(result.merged.next_refresh_date).toBe("2026-06-01");
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/cert-merge.test.ts`
Expected: fails — module `@/lib/cert-merge` does not exist.

- [ ] **Step 3: Implement `decideCertMerge`**

Create `src/lib/cert-merge.ts`:

```ts
import type { CertDates } from "./excel-parser";

export type CertMergeDecision =
  | { action: "insert"; merged: CertDates }
  | { action: "update"; merged: CertDates }
  | { action: "skip" };

/**
 * Decide how to merge an incoming file row against an existing DB cert row.
 *
 * Rules (monotonic field-level merge):
 *   1. If no existing row (db is null), INSERT with file's dates.
 *   2. If file has no dates at all, SKIP (nothing to contribute).
 *   3. If DB has no dates at all, UPDATE (any file data wins).
 *   4. If fileEffective > dbEffective (strict), UPDATE with field-level merge:
 *        for each of the 3 fields, file non-null overwrites; file null keeps DB value.
 *   5. Otherwise SKIP.
 *
 * fileEffective / dbEffective = max(populated { issue_date, expiry_date, next_refresh_date }).
 * Date strings are "YYYY-MM-DD" and lexicographically comparable.
 */
export function decideCertMerge(
  file: CertDates,
  db: CertDates | null,
): CertMergeDecision {
  if (db === null) {
    return { action: "insert", merged: file };
  }

  const fileEffective = effectiveMax(file);
  if (fileEffective === null) {
    return { action: "skip" };
  }

  const dbEffective = effectiveMax(db);
  if (dbEffective === null) {
    return { action: "update", merged: mergeFieldLevel(file, db) };
  }

  if (fileEffective > dbEffective) {
    return { action: "update", merged: mergeFieldLevel(file, db) };
  }

  return { action: "skip" };
}

function effectiveMax(d: CertDates): string | null {
  const populated = [d.issue_date, d.expiry_date, d.next_refresh_date].filter(
    (x): x is string => !!x,
  );
  if (populated.length === 0) return null;
  return populated.reduce((a, b) => (a > b ? a : b));
}

function mergeFieldLevel(file: CertDates, db: CertDates): CertDates {
  return {
    issue_date: file.issue_date ?? db.issue_date,
    expiry_date: file.expiry_date ?? db.expiry_date,
    next_refresh_date: file.next_refresh_date ?? db.next_refresh_date,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/cert-merge.test.ts`
Expected: all 10 tests pass.

- [ ] **Step 5: Run full test suite to confirm no regression**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cert-merge.ts src/__tests__/cert-merge.test.ts
git commit -m "feat(import): pure decideCertMerge with monotonic field-level rule

Testable without a DB. Rules: insert when missing, skip when file has no
dates or DB is newer/equal, update with field-level merge when file wins.
Never overwrites non-null DB fields with null."
```

---

## Task 8: Wire `decideCertMerge` into `executeBulkImport` + add `certificationsUpdated` counter

**Files:**
- Modify: `src/app/dashboard/import/actions.ts` — `ImportResponse` shape + `executeBulkImport` body (replace the cert-insertion block with merge logic).

This is the integration task. Coverage is via the pure function tests from Task 7 plus the manual E2E verification in Task 14.

- [ ] **Step 1: Extend `ImportResponse.summary`**

In `src/app/dashboard/import/actions.ts`, update the `ImportResponse` interface (around line 40):

```ts
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
```

- [ ] **Step 2: Replace the cert-creation loop in `executeBulkImport`**

At the top of the file, import the new helper:

```ts
import { decideCertMerge } from "@/lib/cert-merge";
```

Then in `executeBulkImport`, replace the entire cert-creation block (the block that currently starts with `// Step 3: Create certifications (scoped dedup)` around line 303 down through the `for (let i = 0; i < certRows.length; i += 50)` insert batch ending around line 357) with:

```ts
    // Step 3: Create or update certifications (monotonic field-level merge)
    let certificationsUpdated = 0;

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

        const fileDates = worker.certDatesByType[ctName] ?? {
          issue_date: null,
          expiry_date: null,
          next_refresh_date: null,
        };

        const key = `${empId}:${ctId}`;
        const existing = existingCertMap.get(key) ?? null;
        const dbDates = existing
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
```

Then update the `return` statement at the end of the `try` block (around line 363) to include the new counter:

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `actions.ts`.

- [ ] **Step 4: Run test suite**

Run: `npx vitest run`
Expected: all tests green.

- [ ] **Step 5: Grep for `ImportResponse.summary` consumers that need updating**

Run: `grep -rn "certificationsCreated\|certificationsSkipped" src/ --include="*.tsx" --include="*.ts"`
Expected output: identifies any UI that renders the import summary. If a UI file (likely something in `src/app/dashboard/import/` or a result component) destructures `summary`, it needs a `certificationsUpdated` label added. If found, add a Hebrew label like `עודכנו` alongside the existing counters. If nothing renders the summary, skip this step.

(Note to implementer: if you find the summary is rendered, update it with something like `<li>הסמכות עודכנו: {summary.certificationsUpdated}</li>` in the same list that displays the other counters. Keep the styling consistent with siblings.)

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/import/actions.ts
# Also include any summary-renderer file modified in step 5 if applicable.
git commit -m "feat(import): monotonic field-level cert merge in executeBulkImport

Replaces skip-if-exists with decideCertMerge per (employee, cert_type).
Adds certificationsUpdated counter. Re-running the same import now idles;
newer-dated imports overwrite without losing prior non-null fields."
```

---

## Task 9: Cert server actions handle `next_refresh_date` (create + update, guest + supabase)

**Files:**
- Modify: `src/app/dashboard/certifications/actions.ts` — both branches of `createCertification` and `updateCertification`.

The actions currently read `issue_date` and `expiry_date` from FormData in four places (guest create, supabase create, guest update, supabase update). Each needs `next_refresh_date` handling added.

Also: the "existing valid cert" duplicate-check in `createCertification` currently uses `expiry_date > today`. Extend it to treat the cert as "still valid" if EITHER `expiry_date > today` OR `next_refresh_date > today` (matches the unified status concept).

No TDD here — these server actions don't have tests today. Coverage is manual E2E in Task 14.

- [ ] **Step 1: Update the guest-mode create branch**

In `src/app/dashboard/certifications/actions.ts`, inside `createCertification` guest branch (around lines 32–67), add a `next_refresh_date` FormData read and wire it through the duplicate check and insert:

```ts
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const employee_id = formData.get("employee_id") as string;
    const cert_type_id = formData.get("cert_type_id") as string;
    const issue_date = formData.get("issue_date") as string;
    const expiry_date = formData.get("expiry_date") as string;
    const next_refresh_date = formData.get("next_refresh_date") as string;
    const image_url = formData.get("image_url") as string | null;
    const notes = formData.get("notes") as string | null;

    if (issue_date && expiry_date && expiry_date < issue_date) {
      throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
    }

    // Check for existing valid certification with same employee_id + cert_type_id.
    // "Valid" means either expiry or next_refresh is still in the future.
    const guestData = getGuestData(guestSid);
    const today = new Date().toISOString().split("T")[0];
    const existingCert = guestData.certifications.find(
      (c) =>
        c.employee_id === employee_id &&
        c.cert_type_id === cert_type_id &&
        ((c.expiry_date && c.expiry_date > today) ||
         (c.next_refresh_date && c.next_refresh_date > today))
    );
    if (existingCert) {
      throw new Error("לעובד זה כבר יש הסמכה בתוקף מסוג זה");
    }

    await guestCreateCertification(guestSid, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: next_refresh_date || null,
      image_url: image_url || null,
      notes: notes || null,
    });

    revalidatePath("/dashboard/certifications");
    redirect("/dashboard/certifications");
  }
```

- [ ] **Step 2: Update the supabase create branch**

Still in `createCertification`, after the guest branch (around lines 70–133), update the supabase branch:

```ts
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const employee_id = formData.get("employee_id") as string;
  const cert_type_id = formData.get("cert_type_id") as string;
  const issue_date = formData.get("issue_date") as string;
  const expiry_date = formData.get("expiry_date") as string;
  const next_refresh_date = formData.get("next_refresh_date") as string;
  const image_url = formData.get("image_url") as string | null;
  const notes = formData.get("notes") as string | null;

  if (issue_date && expiry_date && expiry_date < issue_date) {
    throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
  }

  // Verify employee belongs to the current manager before doing anything else
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employee_id)
    .eq("manager_id", user.id)
    .single();
  if (!emp) throw new Error("Unauthorized");

  // Verify cert type belongs to the current manager
  const { data: ct } = await supabase
    .from("cert_types")
    .select("id")
    .eq("id", cert_type_id)
    .eq("manager_id", user.id)
    .single();
  if (!ct) throw new Error("Unauthorized");

  // Check for existing valid certification — "valid" means either expiry or
  // next_refresh is still in the future.
  const today = new Date().toISOString().split("T")[0];
  const { data: existingCerts } = await supabase
    .from("certifications")
    .select("id")
    .eq("employee_id", employee_id)
    .eq("cert_type_id", cert_type_id)
    .or(`expiry_date.gt.${today},next_refresh_date.gt.${today}`)
    .limit(1);

  if (existingCerts && existingCerts.length > 0) {
    throw new Error("לעובד זה כבר יש הסמכה בתוקף מסוג זה");
  }

  const { error } = await supabase.from("certifications").insert({
    employee_id,
    cert_type_id,
    issue_date: issue_date || null,
    expiry_date: expiry_date || null,
    next_refresh_date: next_refresh_date || null,
    image_url: image_url || null,
    notes: notes || null,
  });

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}
```

- [ ] **Step 3: Update the guest-mode update branch**

In `updateCertification` guest branch (around lines 137–165):

```ts
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    const employee_id = formData.get("employee_id") as string;
    const cert_type_id = formData.get("cert_type_id") as string;
    const issue_date = formData.get("issue_date") as string;
    const expiry_date = formData.get("expiry_date") as string;
    const next_refresh_date = formData.get("next_refresh_date") as string;
    const image_url = formData.get("image_url") as string | null;
    const notes = formData.get("notes") as string | null;

    if (issue_date && expiry_date && expiry_date < issue_date) {
      throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
    }

    const success = await guestUpdateCertification(guestSid, id, {
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: next_refresh_date || null,
      image_url: image_url || null,
      notes: notes || null,
    });

    if (!success) {
      throw new Error("Failed to update certification in guest mode");
    }

    revalidatePath("/dashboard/certifications");
    redirect("/dashboard/certifications");
  }
```

- [ ] **Step 4: Update the supabase update branch**

Still in `updateCertification`, after the guest branch (around lines 167–229), in the supabase branch:

```ts
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cert } = await supabase
    .from("certifications")
    .select("employee_id, employees!inner(manager_id)")
    .eq("id", id)
    .single();

  if (!cert || (cert.employees as any).manager_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const employee_id = formData.get("employee_id") as string;
  const cert_type_id = formData.get("cert_type_id") as string;
  const issue_date = formData.get("issue_date") as string;
  const expiry_date = formData.get("expiry_date") as string;
  const next_refresh_date = formData.get("next_refresh_date") as string;
  const image_url = formData.get("image_url") as string | null;
  const notes = formData.get("notes") as string | null;

  if (issue_date && expiry_date && expiry_date < issue_date) {
    throw new Error("תאריך תפוגה חייב להיות אחרי תאריך הנפקה");
  }

  // Verify new employee belongs to the current manager
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employee_id)
    .eq("manager_id", user.id)
    .single();
  if (!emp) throw new Error("Unauthorized");

  // Verify new cert type belongs to the current manager
  const { data: ct } = await supabase
    .from("cert_types")
    .select("id")
    .eq("id", cert_type_id)
    .eq("manager_id", user.id)
    .single();
  if (!ct) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("certifications")
    .update({
      employee_id,
      cert_type_id,
      issue_date: issue_date || null,
      expiry_date: expiry_date || null,
      next_refresh_date: next_refresh_date || null,
      image_url: image_url || null,
      notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(mapSupabaseError(error.message));
  }

  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean on `actions.ts`. Form-submission errors from `certification-form.tsx` (which hasn't been updated yet) are not yet expected — the form still sends what it sends; reading an absent FormData key just returns `""` which becomes `null` via `|| null`. Safe.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/certifications/actions.ts
git commit -m "feat(actions): persist next_refresh_date in cert create/update

Both guest and supabase branches now read next_refresh_date from FormData
and write it. The 'existing valid cert' duplicate check now treats a cert
as valid if either expiry_date or next_refresh_date is still in the future."
```

---

## Task 10: Certification form — remove `required`, add new input

**Files:**
- Modify: `src/components/certifications/certification-form.tsx`

Remove HTML `required` from all three date inputs and add a `next_refresh_date` input. Keep the existing `issue_date → expiry_date` auto-calc untouched.

- [ ] **Step 1: Add state for the new field**

In `src/components/certifications/certification-form.tsx`, after the `expiryDate` state declaration (around line 63), add:

```tsx
  const [nextRefreshDate, setNextRefreshDate] = useState(
    certification?.next_refresh_date || ""
  );
```

- [ ] **Step 2: Submit the new field in FormData**

In the `handleSubmit` function, after `formData.set("expiry_date", expiryDate);` (around line 203), add:

```tsx
      formData.set("next_refresh_date", nextRefreshDate);
```

- [ ] **Step 3: Remove `required` from both existing date inputs and add the new field**

In the JSX `{/* Dates */}` block (around lines 285–321), replace the two-column grid with a three-column grid containing all three inputs and no `required`:

```tsx
      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="issue_date"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            תאריך הנפקה
          </label>
          <input
            type="date"
            id="issue_date"
            name="issue_date"
            value={issueDate}
            onChange={(e) => handleIssueDateChange(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label
            htmlFor="expiry_date"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            תאריך תפוגה
          </label>
          <input
            type="date"
            id="expiry_date"
            name="expiry_date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label
            htmlFor="next_refresh_date"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            מועד רענון הבא
          </label>
          <input
            type="date"
            id="next_refresh_date"
            name="next_refresh_date"
            value={nextRefreshDate}
            onChange={(e) => setNextRefreshDate(e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the test suite**

Run: `npx vitest run`
Expected: all tests still pass. No cert-form tests exist today; no regression expected elsewhere.

- [ ] **Step 6: Commit**

```bash
git add src/components/certifications/certification-form.tsx
git commit -m "feat(form): optional dates + add 'מועד רענון הבא' input

Drops HTML required from issue_date and expiry_date — they may legitimately
be null for imported certs (two-regime import). Adds a third date input
for next_refresh_date. Auto-calc (issue → expiry) is preserved."
```

---

## Task 11: Cert list page — query, column, mobile line, unified status

**Files:**
- Modify: `src/app/dashboard/certifications/page.tsx`

The page has two renderings: a mobile card list and a desktop table. Both need the new field shown and the status computed with both dates.

- [ ] **Step 1: Select the new column in the query**

Find the supabase select block (around lines 77–92). Add `next_refresh_date`:

```ts
      .select(`
        id,
        issue_date,
        expiry_date,
        next_refresh_date,
        image_url,
        notes,
        created_at,
        updated_at,
        employee_id,
        employees!inner(id, first_name, last_name, manager_id),
        cert_type_id,
        cert_types!inner(id, name)
      `)
```

(Keep the rest of the select exactly as-is; this only adds the one field between `expiry_date` and `image_url`.)

- [ ] **Step 2: Pass both dates to `getCertStatus`**

Find the `.map` or similar transformation that computes `status` (around line 114):

```ts
    status: getCertStatus(cert.expiry_date, cert.next_refresh_date),
```

- [ ] **Step 3: Render the new field in the mobile card (first instance)**

Find the mobile card block around line 319 where `formatDateHe(cert.issue_date)` and `formatDateHe(cert.expiry_date)` render. Add a third labeled line for `next_refresh_date` immediately after `expiry_date`, rendered ONLY when non-null:

```tsx
                        {formatDateHe(cert.issue_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>תאריך תפוגה:</span>
                      <span className="font-medium text-gray-700">
                        {formatDateHe(cert.expiry_date)}
                      </span>
                    </div>
                    {cert.next_refresh_date && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span>מועד רענון הבא:</span>
                        <span className="font-medium text-gray-700">
                          {formatDateHe(cert.next_refresh_date)}
                        </span>
                      </div>
                    )}
```

(Match the exact markup pattern of the existing two lines — same classes, same wrapper. The above is illustrative; check the actual markup at the referenced line and mirror it for the new line.)

- [ ] **Step 4: Render the new field in the desktop table (second instance)**

Find the desktop table block around lines 391 and 397 where the two date `<td>` cells render. Add a new `<th>` to the header row and a new `<td>` to each body row for `next_refresh_date`. Exact placement is between the existing expiry column and the next column (likely status or actions). The header line and cell to add:

```tsx
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      מועד רענון הבא
                    </th>
```

And in each body row, alongside the existing two date cells:

```tsx
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {formatDateHe(cert.next_refresh_date)}
                      </td>
```

(`formatDateHe` already returns `"—"` for null, so the cell renders clean for regime-2 certs.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Visual check via preview dev server**

Start the preview dev server, navigate to `/dashboard/certifications`, and confirm:
- The new column header `מועד רענון הבא` appears between expiry and status/actions on desktop.
- Mobile cards show the `מועד רענון הבא:` line for certs that have the value.
- No layout regression on existing certs (which have `next_refresh_date = null`).

Use `mcp__Claude_Preview__preview_start` with `name: "dev"` assuming `.claude/launch.json` has a `dev` config. If it doesn't, create one first with `runtimeExecutable: "npm"`, `runtimeArgs: ["run", "dev"]`, `port: 3000`.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/certifications/page.tsx
git commit -m "feat(cert-list): show next_refresh_date column + unified status

Desktop gets a third date column. Mobile cards add a labeled line,
rendered only when populated. Status badge now uses min(expiry, refresh)
via the extended getCertStatus signature."
```

---

## Task 12: Employee detail page — inline refresh line + unified status

**Files:**
- Modify: `src/app/dashboard/employees/[id]/page.tsx`

- [ ] **Step 1: Select the new column in the query**

Find the cert query's `.select(...)` block (the one that orders by `expiry_date`, around line 45). Add `next_refresh_date` to the select list. Example:

```ts
    .select("id, issue_date, expiry_date, next_refresh_date, image_url, cert_type_id, cert_types!inner(id, name)")
    .order("expiry_date", { ascending: true });
```

(Adjust to exactly match the current select's other fields — only add `next_refresh_date` between `expiry_date` and the next field.)

- [ ] **Step 2: Pass both dates to `getCertStatus`**

Find the line (around line 197):

```ts
              const status = getCertStatus(cert.expiry_date);
```

Change to:

```ts
              const status = getCertStatus(cert.expiry_date, cert.next_refresh_date);
```

- [ ] **Step 3: Add the refresh segment to the inline date summary**

Find the rendered line (around lines 218–219):

```tsx
                        הונפקה: {formatDateHe(cert.issue_date)} | פג תוקף:{" "}
                        {formatDateHe(cert.expiry_date)}
```

Replace with a small helper that only shows populated segments:

```tsx
                        {[
                          cert.issue_date && `הונפקה: ${formatDateHe(cert.issue_date)}`,
                          cert.expiry_date && `פג תוקף: ${formatDateHe(cert.expiry_date)}`,
                          cert.next_refresh_date && `מועד רענון הבא: ${formatDateHe(cert.next_refresh_date)}`,
                        ].filter(Boolean).join(" | ")}
```

(Hebrew RTL text with the `|` separator should render correctly inside the existing `<span>` / wrapper.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Visual check via preview dev server**

Navigate to an employee detail page with certs and confirm:
- A cert with all three dates shows all three segments joined by `|`.
- A cert with only `expiry_date` shows only `פג תוקף: ...`.
- A cert with all-null dates shows an empty string (or hyphen if `formatDateHe` produces one) and doesn't crash.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/employees/[id]/page.tsx
git commit -m "feat(employee-detail): show refresh inline + unified status

Cert summary line now includes 'מועד רענון הבא' when populated. Segments
are filtered so rows with missing dates don't render empty labels."
```

---

## Task 13: Import review step — show per-cert-type dates under each worker row

**Files:**
- Modify: `src/components/import/review-step.tsx`

Render a small secondary line under each cert-type pill showing the dates that worker+cert will be imported with. Omit the line when there are no dates (all three null).

- [ ] **Step 1: Update the cert-pill rendering**

In `src/components/import/review-step.tsx`, find the block that renders cert-type pills (around line 103, inside the per-worker `<td className="px-3 py-2">` that maps `worker.certTypeNames`). Replace that block with:

```tsx
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {worker.certTypeNames.map((ct) => {
                      const isExisting = worker.existingCertTypes.includes(ct);
                      const dates = worker.certDatesByType[ct];
                      const dateLine = dates
                        ? [
                            dates.issue_date && `הונפקה ${dates.issue_date}`,
                            dates.expiry_date && `פג תוקף ${dates.expiry_date}`,
                            dates.next_refresh_date && `רענון ${dates.next_refresh_date}`,
                          ]
                            .filter(Boolean)
                            .join(", ")
                        : "";
                      return (
                        <div key={ct} className="flex flex-col">
                          <span
                            className={
                              isExisting
                                ? "rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-500 line-through"
                                : "rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                            }
                          >
                            {ct}
                          </span>
                          {dateLine && (
                            <span className="mt-0.5 text-[10px] text-gray-500">
                              {dateLine}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {worker.certTypeNames.length === 0 && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </td>
```

(The exact class names for the existing pill markup should be kept — the diff is: wrap each pill in a `flex-col` div and append an optional dates line below. Keep the existing colors/padding for the pill; only the wrapper structure and the new `<span>` are additions.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Visual check via preview dev server**

Upload a small test xlsx (can be the reference file trimmed to 2–3 rows) at `/dashboard/import`. Confirm:
- Regime-1 rows show `הונפקה YYYY-MM-DD, רענון YYYY-MM-DD` under the cert-type pill.
- Regime-2 rows show `פג תוקף YYYY-MM-DD` under the pill.
- Rows with no dates (or no cert type) show no secondary line.
- A worker with two cert types with different regimes displays the correct per-type dates.

- [ ] **Step 4: Commit**

```bash
git add src/components/import/review-step.tsx
git commit -m "feat(review): show captured dates per cert type in review table

Each cert-type pill now has a small dates line beneath it showing the
file's interpreted dates (issue/expiry/refresh) that will be imported."
```

---

## Task 14: Final verification — full test suite + preview server + reference-file end-to-end

**Files:** none modified — this is a verification-only task, but it concludes the plan.

This task uses the `superpowers:verification-before-completion` mindset: evidence before assertions. No step of this task says "it works" without showing the evidence.

- [ ] **Step 1: Run the full test suite and confirm green**

Run: `npm test`
Expected: all tests pass. If any fail, fix the underlying cause — do not skip or modify tests to make them pass.

- [ ] **Step 2: Run TypeScript build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Apply the migration to the local/staging Supabase**

The migration is in `supabase/migration_next_refresh_date.sql`. Applying it is a deployment step — either run the SQL directly against the Supabase project via the dashboard's SQL editor, or via the Supabase CLI if configured. The ALTER is `IF NOT EXISTS`-safe, idempotent.

Ask the user to confirm the migration has been applied to the Supabase instance they'll use for verification.

- [ ] **Step 4: Start the preview dev server**

Ensure `.claude/launch.json` has a `dev` server entry:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

Start via `mcp__Claude_Preview__preview_start` with `name: "dev"`.

- [ ] **Step 5: End-to-end import verification**

Ask the user to re-attach the reference file `עותק של מאושרי_נתע_לשיבוץ_מעודכן.xlsx` via the import UI at `/dashboard/import`. Expected outcomes:

1. Review step displays regime-1 rows (1–45) with `הונפקה + רענון` under the cert type, and regime-2 rows (46–71) with `פג תוקף`.
2. Rows 58 ("left") and 64 ("no information") appear in the skipped-rows list at the bottom.
3. After confirming import, the summary reports the expected `certificationsCreated` count. For a first-time import of this file, `certificationsUpdated` and `certificationsSkipped` should be 0.
4. On the cert list page (`/dashboard/certifications`), the new `מועד רענון הבא` column has values for regime-1 certs and `—` for regime-2 certs.
5. On an employee detail page, opening a regime-1 cert shows `הונפקה: ... | מועד רענון הבא: ...` without a `פג תוקף` segment. Regime-2 shows only `פג תוקף: ...`.
6. Re-run the exact same import. `certificationsSkipped` should equal the total count; `certificationsCreated` and `certificationsUpdated` should be 0.
7. Edit a regime-1 cert in the form — it opens without errors, the dates populate correctly (all three fields), and saving without any changes does not throw `required`-field errors.

- [ ] **Step 6: Stop the preview server**

Stop via `mcp__Claude_Preview__preview_stop` with the server id.

- [ ] **Step 7: Final commit if verification revealed small polish items**

If any verification step revealed a small polish issue that needed fixing (e.g., a class name typo, a missing null check), commit the fix. Otherwise skip this step — the previous task commits stand on their own.

- [ ] **Step 8: Summary message to the user**

Provide a short summary of:
- What changed (capture + merge + UI).
- That the migration needs to be applied to production once the PR is ready.
- The expected import behavior going forward.

This completes the feature. Any follow-up polish (e.g., refactoring the auto-calc, adding a "refresh due" filter) is out of scope per the spec.
