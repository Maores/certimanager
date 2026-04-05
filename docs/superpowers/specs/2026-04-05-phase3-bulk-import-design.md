# Phase 3: Bulk Import from Excel - Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Scope:** Bulk import of employees and certifications from `.xlsx` files

---

## 1. Problem

CertiManager currently requires manual entry of each employee and certification. The user has an existing Excel spreadsheet with ~148 workers across 11 sheets that needs to be imported. Manual entry of 148 workers is impractical.

## 2. Architecture

### 2.1 New Route

`/dashboard/import` — A 3-step wizard flow:

1. **Upload** — User uploads `.xlsx` file, server parses it
2. **Review** — Preview parsed data with duplicates highlighted, cert type mapping shown
3. **Import** — Execute bulk insert, display summary report

### 2.2 Components

| Component | Type | Purpose |
|-----------|------|---------|
| `/dashboard/import/page.tsx` | Server component | Entry point, renders ImportWizard |
| `ImportWizard` | Client component | Multi-step wizard with local state |
| `/dashboard/import/actions.ts` | Server actions | `parseExcelFile()`, `executeBulkImport()` |
| `/lib/excel-parser.ts` | Utility | Parse xlsx, extract workers, detect duplicates |

### 2.3 Data Flow

All server actions authenticate the user and scope all DB queries by `manager_id = auth.uid()`.

```
User uploads .xlsx (via FormData)
  -> parseExcelFile() server action
     -> Authenticates user (redirect to /login if not logged in)
     -> Validates file server-side (type, size, extension)
     -> xlsx (SheetJS) package reads all sheets
     -> excel-parser.ts extracts structured data
     -> Normalizes employee_number values (trim, strip non-alphanumeric)
     -> Queries existing employees by (manager_id, employee_number) for dedup
     -> Queries existing certifications by (employee_id, cert_type_id) for cert dedup
     -> Returns: { workers[], certTypes[], duplicates[], noCertWorkers[], existingInDb[], existingCerts[] }
  -> Client renders preview table
  -> User confirms import
  -> executeBulkImport() server action
     -> Authenticates user
     -> Insert order: (1) cert_types via upsert, (2) employees via upsert, (3) certifications (skip existing)
     -> All inserts include manager_id
     -> Batch size: 50 rows per Supabase call
     -> revalidatePath for /dashboard/employees, /dashboard/certifications, /dashboard/cert-types
     -> Returns: { created, skipped, certsAdded, certTypesCreated, errors[] }
  -> Client renders summary report
```

### 2.4 Next.js Configuration

Server actions have a default body size limit of 1MB. For 10MB xlsx files, configure in `next.config.ts`:

```ts
serverActions: {
  bodySizeLimit: '12mb',
}
```

### 2.5 Navigation

Add a sidebar link to `/dashboard/import` labeled "ייבוא מאקסל" in the existing dashboard navigation.

## 3. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Certification dates | Nullable (leave blank) | Excel has no date data; user will fill in later |
| Status values | Hebrew (`פעיל`, `חל"ת`, `מחלה`) | Matches source data, UI is Hebrew. Accept `חלת` as alias for `חל"ת` |
| Sheet-to-field mapping | Sheets = certification categories | Sheets represent authorization types, not org departments |
| Workers without certs | Import as employees, flag in summary | Sheets like `ללא הסמכה - לבירור` have workers that still need tracking |
| Dedup key | `employee_number` (מספר זהות/דרכון) | Unique identifier present in all sheets |
| File format | `.xlsx` only (no `.xls`) | Source file is .xlsx; binary .xls parsing is unreliable |
| Auto-created cert type validity | `default_validity_months = 12` | Sensible default; user can edit cert types after import |
| Atomicity | Insert in order, continue on error, report failures | Acceptable for this scale; orphan employees without certs are still useful data |
| Employee insert strategy | Supabase `upsert` with `ignoreDuplicates: true` on `(manager_id, employee_number)` | Cleanly skips existing employees without throwing constraint violations |
| Cert type insert strategy | Supabase `upsert` on `(manager_id, name)` | Reuses existing cert types, creates new ones |
| Certification dedup | Check `(employee_id, cert_type_id)` before insert, skip if exists | Prevents duplicate certifications on retry |
| xlsx package | `xlsx` (SheetJS) community edition, Apache 2.0 | Already installed in project |

## 4. Excel Parsing Logic

### 4.1 Sheet Classification

The parser categorizes sheets into:

- **Worker sheets** (contain employee rows): מאושרי נת״ע, מאושרי כביש 6, מאושרי כביש 6 + נת״ע, PFI, פעיל - ללא הסמכה מוגדרת, חלת - מחלה, ללא הסמכה - לבירור
- **Task/summary sheets** (skip during import): ריכוז כל המשימות, משימות לפי אחראי, סיכום כללי, משימות להמשך טיפול

### 4.2 Column Mapping

| Excel Column (Hebrew) | DB Field | Notes |
|----------------------|----------|-------|
| מספר זהות / דרכון | `employee_number` | Unique key for dedup, normalized (trimmed, stripped) |
| שם משפחה | `last_name` | Required |
| שם פרטי | `first_name` | Required |
| סטטוס | `status` | Maps to: פעיל, חל"ת, מחלה. Default: פעיל |
| הסמכה | Creates `cert_type` | Auto-creates cert type if not exists |
| הערות / משימות | `notes` | Appended to employee notes |
| אחראי | `notes` | Appended as "אחראי: [name]" |

### 4.3 Employee Number Normalization

Before any dedup comparison:
1. Trim leading/trailing whitespace
2. Strip dashes, spaces, and non-alphanumeric characters
3. Rows with empty or invalid `employee_number` (less than 5 chars after normalization) are skipped and reported

### 4.4 Deduplication Strategy

All dedup queries are scoped by `manager_id = auth.uid()`.

**Employee dedup:**
1. Parse all worker sheets into a flat list
2. Group by normalized `employee_number`
3. First occurrence sets employee fields (name, status, notes)
4. Each sheet appearance creates a certification record linking the employee to the cert type derived from the sheet name
5. Before import, check existing DB employees by `(manager_id, employee_number)` — flag matches as "already exists"
6. Use Supabase `upsert` with `ignoreDuplicates: true` — existing employees are skipped, only new certifications are added

**Certification dedup:**
7. Before creating a certification, check if `(employee_id, cert_type_id)` already exists in DB
8. If it exists, skip (do not create duplicate). Flag in summary as "certification already exists"
9. This also handles retry safety — re-running import after a partial failure won't create duplicate certs

### 4.5 Certification Type Auto-Creation

Sheet names that represent certifications are mapped to cert type names:

| Sheet Name | Cert Type Created |
|------------|-------------------|
| מאושרי נת״ע | נת״ע |
| מאושרי כביש 6 | כביש 6 |
| מאושרי כביש 6 + נת״ע | כביש 6 + נת״ע |
| PFI | PFI |

Sheets like `פעיל - ללא הסמכה מוגדרת` and `ללא הסמכה - לבירור` do NOT create cert types — workers from these sheets are imported as employees only.

**Cert type dedup:** Use Supabase `upsert` on `(manager_id, name)` — reuses existing cert types, creates new ones. Auto-created cert types use `default_validity_months = 12`.

### 4.6 Status Value Validation

Accepted status values (with aliases):

| Excel Value | DB Value |
|-------------|----------|
| `פעיל` | `פעיל` |
| `חלת`, `חל"ת`, `חל״ת` | `חל"ת` |
| `מחלה` | `מחלה` |
| `לא פעיל` | `לא פעיל` |

If the Excel contains an unrecognized status value (typo, empty, different spelling):
- Default to `פעיל`
- Flag the row in the review step with a warning indicator

## 5. Schema Changes

Migration SQL at `supabase/migration_phase3.sql`:

```sql
-- Add status field to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'פעיל';

-- Make certification dates nullable
ALTER TABLE certifications ALTER COLUMN issue_date DROP NOT NULL;
ALTER TABLE certifications ALTER COLUMN expiry_date DROP NOT NULL;

-- Unique constraint for employee dedup per manager
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_manager_number
  ON employees(manager_id, employee_number);

-- Unique constraint for cert type dedup per manager
CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_types_manager_name
  ON cert_types(manager_id, name);
```

TypeScript types updated:
- `Employee.status: string` added
- `Certification.issue_date` and `expiry_date` now `string | null`
- `getCertStatus()` returns `"unknown"` for null dates
- `formatDateHe()` returns `"—"` for null dates
- `daysUntilExpiry()` returns `null` for null dates

## 6. Pre-requisite: Harden Existing Actions

Before building the import feature, fix `manager_id` scoping in existing actions:

- `certifications/actions.ts`: Add `.eq("manager_id", user.id)` guard on update/delete (currently relies only on RLS)
- `cert-types/actions.ts`: Add `.eq("manager_id", user.id)` guard on update/delete

This prevents the bulk import from creating rows that existing action endpoints can't properly protect.

## 7. UI Design

### 7.1 Step 1: Upload

- Drag-and-drop zone (reuse existing dropzone pattern)
- Accept `.xlsx` files only
- Max file size: 10MB
- Hebrew instructions and error messages
- Loading spinner during parse

### 7.2 Step 2: Review

- Tab or accordion per sheet showing parsed workers
- Summary stats at top: X workers found, Y unique, Z duplicates, W without certs
- Color coding: green = new, yellow = duplicate (will merge), gray = already in DB
- Warning indicators on rows with unrecognized status values
- List of cert types that will be auto-created
- "No certification" workers listed separately with note explaining they'll be imported without certs
- Back button to re-upload, Confirm button to proceed

### 7.3 Step 3: Summary

- Import results: employees created, certifications added, cert types created
- Any errors listed with row details
- Progress indicator during import execution
- Link back to employees list and certifications list

## 8. Error Handling & Security

### 8.1 Server-Side File Validation

`parseExcelFile()` receives `FormData` (consistent with existing action patterns) and must validate before parsing:
- File extension must be `.xlsx`
- MIME type must be `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File size must be <= 10MB
- Reject with Hebrew error message if validation fails

### 8.2 Error Table

| Error | Handling |
|-------|----------|
| Invalid file type/extension | Hebrew error, reject upload |
| File too large (>10MB) | Hebrew error, reject upload |
| Corrupt/empty file | Hebrew error, reject upload |
| Missing required fields (name, ID) | Skip row, report in summary |
| Invalid employee_number (< 5 chars) | Skip row, report in summary |
| Supabase insert failure | Report failed rows, continue with rest |
| Network error mid-import | Show partial results, retry is safe (dedup prevents duplicates) |
| Unauthenticated user | Redirect to /login |

### 8.3 Import Order, Batching & Cache Invalidation

Insert order: (1) cert_types via upsert, (2) employees via upsert, (3) certifications (skip existing).

Batch size: 50 rows per Supabase `.insert()`/`.upsert()` call to avoid timeouts.

After import completes, call:
- `revalidatePath("/dashboard/employees")`
- `revalidatePath("/dashboard/certifications")`
- `revalidatePath("/dashboard/cert-types")`

## 9. Future Scope (not in this phase)

- Export current data to Excel
- Advanced search filters (by status, department)
- Edit mapping before import (manual column assignment)
- Recurring import / sync with updated spreadsheets
