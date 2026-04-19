# Journey 03 — Import: happy-path Pikoh file

**Goal:** Import a clean 10-row Pikoh xlsx and verify 10 employees + the expected certs are created, statuses are correct.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001. Fixture file at `tests/agents/fixtures/pikoh-happy.xlsx` exists.

**Persona:** `dina-manager.md`

**Steps:**
1. Log in.
2. Navigate to `/dashboard/import`.
3. Click the file picker. Select `tests/agents/fixtures/pikoh-happy.xlsx`.
4. On the review step, verify: 10 employee rows, each with their employee number, each with the expected cert type and dates.
5. Click "המשך" / "סיים" to commit.
6. Navigate to `/dashboard/employees`. Verify count increased by 10 (seed has 5 → now 15).
7. Navigate to `/dashboard/certifications`. Verify new certs appear with correct `הנפקה` / `תפוגה` / `מועד רענון הבא` values.
8. Pick one imported employee, open detail, verify the cert shown matches the xlsx row.

**Acceptance:**
- 15 employees total after import.
- Every new cert has at least one populated date.
- No cert shows status `לא ידוע` unless ALL three of its dates are missing.
- The review step table matches the xlsx contents row-for-row.

**Explore:**
- Click Back after the file picker — does the flow recover?
- Re-upload the same file a second time — is there de-duplication or does it double-insert?
