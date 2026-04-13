# Certification Types Update & Course Candidates Module — Design Spec

**Date:** 2026-04-13  
**Project:** CertiManager  
**Status:** Approved

---

## Overview

Three tasks:
1. Update certification types from 3 to 5 (add 2 new, rename 1)
2. Build a new Course Candidates management module
3. Cross-validate employee counts against source Excel files

---

## Task 1: Certification Types Update

### Current State
3 cert types: `נת״ע`, `כביש 6`, `PFI`

### Target State
5 cert types:
1. `נת״ע` — no change
2. `כביש 6` — no change
3. `חוצה ישראל` — **new**
4. `נתיבי ישראל` — **new**
5. `חוצה צפון (PFI)` — **renamed** from `PFI`

### Changes Required

| File | Change | Risk |
|------|--------|------|
| `src/lib/excel-parser.ts` | Update `CANONICAL_CERT_TYPES` to 5 items, update `normalizeCertTypeName()` to handle new names | Medium |
| Supabase DB | INSERT 2 new cert_types, UPDATE "PFI" → "חוצה צפון (PFI)" | Medium |
| `supabase/migration_cert_types_v2.sql` | New migration file documenting changes | Low |

### Migration: Manager-Scoped Cert Types
The `cert_types` table is scoped per `manager_id`. The migration must iterate over ALL existing managers and INSERT/UPDATE for each one. Pattern:
```sql
INSERT INTO cert_types (manager_id, name)
SELECT m.id, 'חוצה ישראל' FROM managers m
WHERE NOT EXISTS (SELECT 1 FROM cert_types ct WHERE ct.manager_id = m.id AND ct.name = 'חוצה ישראל');
-- Repeat for נתיבי ישראל
-- UPDATE PFI → חוצה צפון (PFI) for all managers
UPDATE cert_types SET name = 'חוצה צפון (PFI)' WHERE name = 'PFI';
```

### Normalization Rules (excel-parser.ts)
- `"חוצה ישראל"` → `"חוצה ישראל"`
- `"נתיבי ישראל"` → `"נתיבי ישראל"`
- `"PFI"` / `"pfi"` / `"חוצה צפון"` / `"חוצה צפון (PFI)"` → `"חוצה צפון (PFI)"`
- Existing normalizations for נת״ע and כביש 6 remain unchanged

### Constraints
- No deletion of existing cert types or employee data
- Rename is an UPDATE on the existing PFI row (preserves FK references)
- All existing certifications linked to PFI remain valid after rename

---

## Task 2: Course Candidates Module

### Architecture Decision
**Separate Table + Soft Link** — `course_candidates` is a standalone table linked to `employees` via `id_number` = `employee_number` (ת.ז) and to `cert_types` via `cert_type_id` FK.

### Data Model

```sql
CREATE TABLE course_candidates (
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

-- Indexes for query performance
CREATE INDEX idx_candidates_manager ON course_candidates(manager_id);
CREATE INDEX idx_candidates_manager_status ON course_candidates(manager_id, status);
CREATE INDEX idx_candidates_id_number ON course_candidates(id_number);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON course_candidates
FOR EACH ROW EXECUTE FUNCTION update_candidates_updated_at();

ALTER TABLE course_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_own" ON course_candidates FOR ALL
  USING (manager_id = auth.uid());

-- Also add missing unique constraint on certifications for promotion dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_employee_cert_type
  ON certifications(employee_id, cert_type_id);
```

**Unique constraint:** `(manager_id, id_number, cert_type_id)` — same person can be a candidate for multiple cert type courses.

**Certifications dedup:** Added unique index on `certifications(employee_id, cert_type_id)` to support the promotion flow's "find or create" pattern and prevent duplicate certification records.

### Status Values
`ממתין` → `נרשם` → `השלים` → `הוסמך`

| Status | Hebrew | Color | Meaning |
|--------|--------|-------|---------|
| waiting | ממתין | Yellow (#fef3c7) | Candidate registered, waiting for course |
| registered | נרשם | Blue (#dbeafe) | Enrolled in course |
| completed | השלים | Green (#d1fae5) | Completed course |
| certified | הוסמך | Purple (#c7d2fe) | Certified, eligible for promotion to employee |

### UI Pages

#### 1. Candidates List (`/dashboard/candidates`)
- Table showing all candidates with columns: checkbox, שם מלא, ת.ז, טלפון, עיר, סוג הסמכה, סטטוס, עובד?, פעולות
- Search by name or ת.ז
- Filter by cert type and status (AutoSubmitSelect dropdowns)
- Inline status change dropdown per row
- "עובד?" column: green badge if ת.ז matches existing employee, gray "לא" otherwise
- Bulk selection with "קדם לעובדים" action bar
- "הוסף מועמד" button → navigates to /dashboard/candidates/new
- "ייבוא מקובץ" button → navigates to /dashboard/candidates/import
- Pagination (25 per page)

#### 2. Add Candidate Form (`/dashboard/candidates/new`)
- Fields: שם פרטי, שם משפחה, ת.ז, מס׳ טלפון, מקום מגורים, סוג הסמכה (dropdown from cert_types), סטטוס (dropdown, default ממתין), הערות (textarea)
- If ת.ז matches existing employee → show info badge with employee name
- Save & Cancel buttons
- Server action: `createCandidate(formData)`

#### 3. Import Candidates (`/dashboard/candidates/import`)
- 3-step wizard matching existing employee import pattern:
  - Step 1: Upload .xlsx file (drag-and-drop + file picker, .xlsx only — matching employee import)
  - Step 2: Review parsed candidates with stat cards and table preview
  - Step 3: Summary with counts (created, skipped, errors)
- Expected columns: שם פרטי, שם משפחה, ת.ז, טלפון, עיר, סוג הסמכה, סטטוס
- Phone and city are optional — rows missing them are accepted without warnings
- Auto-match cert type names using `normalizeCertTypeName()`
- Deduplication by (manager_id, id_number, cert_type_id)
- Empty state, error state, and loading state follow existing employee import patterns

### Sidebar Navigation
New item "מועמדים לקורסים" placed between "סוגי הסמכות" and "משימות" in the sidebar. Icon: `GraduationCap` from lucide-react.
- Add `"candidates": GraduationCap` to `iconMap` in `src/components/layout/sidebar.tsx`
- Exclude `/dashboard/candidates` from guest-mode navigation filter

### Promotion Flow

Three paths to promote a candidate to an employee:

#### Manual Promote
1. "הוסף כעובד" button appears on all rows regardless of status
2. Click button → confirmation dialog shows candidate details
3. Upsert employee by ת.ז (create if new, update if exists)
4. Create certification record linking employee to cert_type (uses DB unique index, no duplicates)
5. Update candidate status → הוסמך (force-set regardless of previous status)

#### Auto Promote
1. When status is changed to הוסמך via inline dropdown
2. Confirmation dialog: "האם לקדם לעובד?"
3. If confirmed → upsert employee + create certification
4. If declined → only update status, no employee/cert changes

#### Bulk Promote
1. Select multiple candidates via checkboxes (any status allowed)
2. Click "קדם לעובדים" in bulk action bar
3. Confirmation dialog listing all selected candidates with their current statuses
4. Upsert all as employees + create certifications
5. Update all statuses → הוסמך

### Promotion Logic (shared)
```
function promoteCandidate(candidate):
  1. Find or create employee by (manager_id, id_number as employee_number)
     - If exists: update name, phone if blank
     - If new: create with first_name, last_name, employee_number=id_number, phone, status=פעיל
  2. Find or create certification by (employee_id, cert_type_id)
     - If exists: skip (no duplicate certs)
     - If new: create with issue_date=today, expiry_date=null
  3. Update candidate status → הוסמך
```

### Server Actions
- `createCandidate(formData)` — insert new candidate → revalidate `/dashboard/candidates`
- `updateCandidateStatus(id, status)` — update status, trigger promotion dialog if הוסמך → revalidate `/dashboard/candidates`
- `promoteCandidate(id)` — single candidate promotion → revalidate `/dashboard/candidates` + `/dashboard/employees`
- `promoteCandidates(ids)` — bulk promotion → revalidate `/dashboard/candidates` + `/dashboard/employees`
- `deleteCandidate(id)` — remove candidate → revalidate `/dashboard/candidates`
- `parseCandidateFile(formData)` — parse uploaded .xlsx file
- `executeCandidateImport(candidates)` — bulk insert parsed candidates → revalidate `/dashboard/candidates`

### Guest Mode
Course candidates module will NOT support guest mode — it requires authenticated access since it writes to the database and links to real employee/cert data.

---

## Task 3: Cross-Validation

### Process
1. Read both Excel source files:
   - `כ״א +משימות.xlsx` — HR + tasks
   - `עותק של מאושרי_נתע_לשיבוץ_מעודכן.xlsx` — source of truth
2. Count employees per certification type in each file
3. Query app database for employee counts per cert type
4. Compare counts and report discrepancies
5. Verify unique employee count (no double-counting employees with multiple certs)
6. Fix mismatches using the most recent Excel as source of truth:
   - Missing employees → add them via existing import logic
   - Extra employees not in Excel → report but do NOT delete (manual review needed)
   - This is a one-time manual verification, not an automated recurring check

### Output Format
| Certification Type | Excel Count | App Count | Match? |
|--------------------|-------------|-----------|--------|
| נת״ע               | ?           | ?         | ?      |
| כביש 6             | ?           | ?         | ?      |
| חוצה ישראל         | ?           | ?         | ?      |
| נתיבי ישראל        | ?           | ?         | ?      |
| חוצה צפון (PFI)    | ?           | ?         | ?      |
| **Total unique**   | ?           | ?         | ?      |

---

## Out of Scope
- Editing existing employee import flow
- Dashboard stat cards for candidates (future enhancement)
- Email/SMS notifications for status changes
- Course scheduling or calendar integration
