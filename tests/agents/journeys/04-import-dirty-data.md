# Journey 04 — Import: dirty data edge cases

**Goal:** Verify the import wizard handles malformed xlsx files without crashing, with useful error messages.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001. Fixtures `pikoh-dirty.xlsx` and `pikoh-empty.xlsx` exist.

**Persona:** `adversarial.md`

**Steps:**
1. Log in. Navigate to `/dashboard/import`.
2. Upload `pikoh-empty.xlsx` (0 data rows). Observe: does the app crash, show an empty review step, or display a specific error?
3. Click Back / Cancel. Upload `pikoh-dirty.xlsx`. Observe the review step — rows with problems should be flagged visually or omitted.
4. Attempt to commit the dirty import. Observe what gets inserted vs rejected.
5. After commit, navigate to `/dashboard/employees` and `/dashboard/certifications`. Verify: only valid rows landed; no corrupted rows in the DB.
6. Try uploading a non-xlsx file (e.g., a .txt renamed to .xlsx).

**Acceptance:**
- No 500 page, no white-screen crash.
- Empty file → friendly message, no ghost rows.
- Dirty file → problematic rows clearly flagged; committing does not corrupt DB.
- Non-xlsx file → clear rejection, no silent acceptance.

**Explore:**
- What happens if you navigate away mid-upload?
- Does the review step handle >100 rows? (Use the happy file concatenated with itself if needed.)
