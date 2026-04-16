# Spec: Import captures dates + next_refresh

**Date:** 2026-04-16
**Owner:** Maor
**Status:** Approved design, pending implementation plan

## 1. Problem

The April 2026 `נת״ע` Excel export contains two date columns that the current importer discards:

- `תוקף תעודה` — certificate validity date
- `מועד רענון הבא` — next refresh date

Today, `executeBulkImport` writes `issue_date: null, expiry_date: null` for every certification, and the dedup rule "skip if `(employee, cert_type)` already exists" silently drops every date in every subsequent import. Managers lose their live cert-expiration tracking every time they re-run an import.

## 2. Scope

Capture the two date columns during import, store them in the `certifications` table, and surface them in the UI. Certification data may arrive in one of two **regimes** depending on which columns the file populates:

| Regime | `מועד רענון הבא` | `תוקף תעודה` means | DB fields populated |
|--------|-----------------|---------------------|----------------------|
| 1 | present | `issue_date` | `issue_date` + `next_refresh_date` |
| 2 | absent | `expiry_date` | `expiry_date` only |

In the reference file `עותק של מאושרי_נתע_לשיבוץ_מעודכן.xlsx`, rows 1–45 are regime 1 and rows 46–71 are regime 2 (rows 58 "left" and 64 "no information" are exception rows that are skipped).

## 3. Non-goals

- No new "refresh due" list filter (unified status already surfaces refreshes).
- No tightening or restructuring of the form's existing `issue_date → expiry_date` auto-calc.
- No DB index on `next_refresh_date` (add when list-sort performance requires it).
- No change to the status-column handling of `"מאומת"` (current warning behavior is kept).
- No changes to email/notification logic.
- No backfill of existing null-date certifications (subsequent imports will populate them via the monotonic merge rule).

## 4. Decisions (locked)

### 4.1 Storage

Add a nullable `next_refresh_date DATE` column to the `certifications` table.

Migration is a standalone flat file (the project has no `migrations/` directory; it follows the pattern of `migration_tasks.sql`, `migration_cert_types_v2.sql`).

### 4.2 Parse rule

`מועד רענון הבא` disambiguates what `תוקף תעודה` means:

```
if parseExcelDate(moedRenoonRaw) is not null:
    issue_date        ← parseExcelDate(tokefTeudaRaw)
    next_refresh_date ← parseExcelDate(moedRenoonRaw)
    expiry_date       ← null
else:
    expiry_date       ← parseExcelDate(tokefTeudaRaw)
    issue_date        ← null
    next_refresh_date ← null
```

Dates in the file may appear as Excel date serials (numeric) or as formatted strings. The parser must handle both via a shared helper, returning `null` for any value that cannot be interpreted as a calendar date.

### 4.3 Dedup rule — monotonic, field-level merge

For each `(employee_number, cert_type_name)` pair in the import:

1. If no existing certification row matches, INSERT with the file's three date fields (any mix of nulls is fine).
2. If an existing row matches, compute:
   - `fileEffectiveDate = max of populated { issue_date, expiry_date, next_refresh_date }` from the file row (null if file has no dates).
   - `dbEffectiveDate   = max of populated { issue_date, expiry_date, next_refresh_date }` from the DB row (null if DB has no dates).
3. Decide action:
   - If `fileEffectiveDate` is null: **skip** (file has no data to contribute).
   - Else if `dbEffectiveDate` is null: **update** (DB has no data; any file data wins).
   - Else if `fileEffectiveDate > dbEffectiveDate` (strict): **update**.
   - Else: **skip**.
4. On update, apply field-level merge: for each of the three date fields, if the file has a non-null value, overwrite the DB field; if the file has a null value for a field, preserve the DB value.

**Invariants this rule preserves:**

- Never overwrite a non-null DB field with `null`.
- Never skip an update that would bring in real date data to a null DB field.
- Effective-date comparison is symmetric across regimes (compares on the forward-most populated date, whichever field it lives in).

**Edge behavior:**

- Existing cert with all three dates null: any file data wins (per rule 3's null-DB branch).
- File row with all three dates null (should not occur in practice): skip — no data to contribute.
- Equal effective dates: skip (monotonic is strict).

### 4.4 Status logic

`getCertStatus(expiryDate, nextRefreshDate)` returns `"valid" | "expiring_soon" | "expired" | "unknown"` using the earliest populated deadline:

- `effectiveDeadline = min of populated { expiryDate, nextRefreshDate }`.
- If both are `null`, return `"unknown"`.
- Otherwise apply the existing 30-day window logic on `effectiveDeadline`.

Every call site — cert list page, employee detail page, guest-mode — passes both arguments. Callers that do not have `nextRefreshDate` handy (for pre-existing code paths) pass `null`; behaviour is identical to today for those paths.

### 4.5 Form required

The cert form (`certification-form.tsx`) drops HTML `required` from all three date inputs. No server-side "at least one date" validation. The schema and import already permit all-null date rows; the form simply aligns with that.

The existing `issue_date → expiry_date` auto-calc (based on `cert_type.default_validity_months`) is preserved unchanged.

### 4.6 Hebrew label

The new field uses the label `מועד רענון הבא` in the form, the cert list (desktop column header + mobile label), the employee detail view, and the import review step.

### 4.7 Cert list layout

Desktop table: add a third date column with header `מועד רענון הבא` alongside the existing `תאריך הנפקה` and `תאריך תפוגה` columns. Empty values render as `—`.

Mobile card: add an additional labeled line `מועד רענון הבא: ...` below the existing lines. Only rendered when the value is non-null.

Query select in `src/app/dashboard/certifications/page.tsx` is extended to include `next_refresh_date`.

### 4.8 Review step (import)

The review table shows, for each worker, which cert types will be created with which dates. Because one worker can have multiple cert types with different dates per type, dates are displayed as a small secondary line under the cert-type pill(s) — e.g., `נת״ע: הונפקה 2025-06-01, רענון 2026-06-01`. Regime-2 rows show just `פג תוקף 2026-12-01`. Workers with no cert-date data render only the cert-type pills as today.

## 5. Components and data flow

### 5.1 Changed files

| File | Change |
|------|--------|
| `supabase/schema.sql` | Add `next_refresh_date DATE` column to `certifications` table definition. |
| `supabase/migration_next_refresh_date.sql` | New migration: `ALTER TABLE certifications ADD COLUMN next_refresh_date DATE;` |
| `src/types/database.ts` | Add `next_refresh_date` to `Certification` interface. Change `getCertStatus` signature to `(expiry, nextRefresh)`. |
| `src/lib/guest-store.ts` | Default `next_refresh_date: null` on seeded guest certs. Update `guestCreateCertification` and `guestUpdateCertification` to handle the new field. |
| `src/lib/excel-parser.ts` | New `parseExcelDate` helper. Read `תוקף תעודה` and `מועד רענון הבא` columns. Apply disambiguation rule. Thread `certDatesByType` onto each `ParsedWorker` via `uniqueWorkers` merge. |
| `src/app/dashboard/import/actions.ts` | `parseExcelFile` serializes per-cert dates. `executeBulkImport` implements monotonic field-level merge. `ImportResponse.summary` gains `certificationsUpdated`. |
| `src/components/import/review-step.tsx` | Show per-cert-type dates under each worker row when available. |
| `src/components/certifications/certification-form.tsx` | Remove `required` from `issue_date`, `expiry_date`. Add `next_refresh_date` input. Submit via FormData. |
| `src/app/dashboard/certifications/page.tsx` | Select `next_refresh_date`. New column (desktop) and labeled line (mobile). Pass both dates to `getCertStatus`. |
| `src/app/dashboard/certifications/[id]/edit/page.tsx` | Include `next_refresh_date` in the fetched cert row so the form's initial value is correct. |
| `src/app/dashboard/certifications/new/page.tsx` | No-op beyond ensuring the form renders the new field (no defaults). |
| `src/app/dashboard/employees/[id]/page.tsx` | Select `next_refresh_date`. Extend the inline date summary to include `רענון: ...` when populated. Pass both dates to `getCertStatus`. |
| `src/app/dashboard/certifications/actions.ts` (or wherever `createCertification` / `updateCertification` live) | Read `next_refresh_date` from FormData and persist it. If the file does not exist at the expected path, confirm the correct location during the plan phase. |

### 5.2 Data-flow summary

```
XLSX row
  → excel-parser.ts: parseExcel
     → parseExcelDate + disambiguation
     → ParsedWorker with certDatesByType
  → import/actions.ts: parseExcelFile
     → SerializedWorker with certDatesByType
  → review-step.tsx: render per-cert dates
  → user confirms
  → import/actions.ts: executeBulkImport
     → monotonic field-level merge vs existing certifications rows
     → INSERT or UPDATE each certification
  → certifications table: next_refresh_date populated where appropriate
```

## 6. Testing (TDD)

All new behavior is covered by tests written before implementation.

### 6.1 Unit tests

- `parseExcelDate()`:
  - Excel date serial (e.g., `45292` → `"2024-01-01"`).
  - ISO-like string (`"2025-06-01"`).
  - Hebrew-formatted date string (if present in source files).
  - Empty string, `"-"`, `null`, `undefined` → `null`.
  - Garbage string → `null`.
- `parseExcel` disambiguation:
  - Regime-1 row (both columns populated) → `issue` + `refresh` set, `expiry` null.
  - Regime-2 row (only `תוקף תעודה`) → `expiry` set, `issue` + `refresh` null.
  - Both columns empty → all three null (row still accepted, no dates).
  - A worker appearing in two sheets with different regimes → `certDatesByType` stores both cert-type entries independently.
- `getCertStatus(expiry, refresh)`:
  - Both null → `"unknown"`.
  - Only expiry → behaves like today.
  - Only refresh → same thresholds applied against refresh.
  - Both populated, refresh earlier → refresh drives status.
  - Both populated, expiry earlier → expiry drives status.

### 6.2 Server-action tests

`executeBulkImport` covering the monotonic merge:

- New employee + new cert, regime 1: row inserted with `(issue, null, refresh)`.
- New employee + new cert, regime 2: row inserted with `(null, expiry, null)`.
- Existing cert with all three dates null: file wins, all non-null file fields written.
- Existing cert, file strictly newer, same regime: all file fields overwrite DB.
- Existing cert, file strictly newer, regime 1 → regime 2: file's `expiry` overwrites DB; DB's `issue` and `refresh` preserved (file is null there).
- Existing cert, file strictly newer, regime 2 → regime 1: file's `issue` and `refresh` overwrite DB; DB's `expiry` preserved (file is null there).
- Existing cert, DB effective date ≥ file effective date: skip; `certificationsSkipped` increments.
- Existing cert, file has no dates at all: skip.
- Counter accounting: `certificationsCreated`, `certificationsUpdated`, `certificationsSkipped` sum to the total cert-per-worker-per-type count.

### 6.3 Component tests (best-effort given current test stack)

- `review-step.tsx` renders per-cert dates when present and no dates line when absent.
- `certification-form.tsx` no longer fails HTML validation on empty `issue_date` or `expiry_date`; submits `next_refresh_date` value.
- Cert list page renders the new column (desktop) and line (mobile).

### 6.4 End-to-end verification (manual)

After tests pass, the user re-attaches `עותק של מאושרי_נתע_לשיבוץ_מעודכן.xlsx` and runs the import through the preview dev server. Expected outcome:

- Rows 1–45 produce certifications with `issue_date` + `next_refresh_date`, `expiry_date` null.
- Rows 46–71 produce certifications with `expiry_date` only.
- Re-running the same import a second time shows `certificationsSkipped` equal to the total number of certifications (monotonic check holds).
- The cert list page shows the three columns / three lines correctly.
- Editing one of the imported certs in the form works without forcing the user to fill in a date they don't have.

## 7. Open risks and mitigations

- **Excel date parsing quirks**: dates exported as strings in Hebrew locale may need a specific parser path. Mitigation: `parseExcelDate` is a pure helper with dedicated unit tests covering the formats observed in the reference file.
- **Form auto-calc semantics drift**: the existing `issue → expiry` auto-calc uses `default_validity_months`. For regime-1 certs, the manager may eventually want `issue → refresh` auto-calc. Out of scope here; keep current behavior to avoid surprise.
- **Review step density**: adding per-cert dates increases the review table's vertical footprint. If it becomes visually noisy in end-to-end verification, collapse behind a small "?" tooltip in a follow-up.
- **Counter wording in Hebrew**: the new `certificationsUpdated` counter needs a label in the import summary UI. Use `עודכנו` (updated) with count. Included in the UI change for `executeBulkImport` return-value consumers.

## 8. Rollout

- Migration is a single `ALTER TABLE ADD COLUMN`. Idempotent if re-run (use `IF NOT EXISTS` safely: Supabase Postgres supports it).
- Branch `feat/import-captures-dates-and-refresh` branched from the latest `master` after `git fetch`.
- Merge path: PR → master → auto-deploy to Render (per existing CertiManager deployment config).
- Post-deploy: user runs the `ALTER TABLE` migration once in Supabase, then re-imports the reference file to validate end-to-end.
