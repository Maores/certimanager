# Journey 05 — Cert CRUD: partial dates

**Goal:** Verify creating, editing, and deleting a certification with every combination of date fields populated/empty works end-to-end.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001.

**Persona:** `yossi-power.md`

**Steps:**
1. Log in. Navigate to `/dashboard/certifications`. Note the current total (expect 3 from seed).
2. Click "הוסף הסמכה". Fill in: employee = "רונית אברהם", cert type = "נת״ע", issue date empty, expiry empty, next refresh = `2027-01-15`. Submit.
3. Verify the new cert appears in the list with status `בתוקף` (valid).
4. Click edit on that new cert. Change: add issue date `2025-01-15`. Save.
5. Verify the cert list shows both dates, status unchanged.
6. Click edit again. Clear the next-refresh date. Set expiry = `2026-01-01` (past). Save.
7. Verify status is now `פג תוקף` (expired).
8. Click edit again. Clear ALL date fields. Save.
9. Verify status is now `לא ידוע` (unknown).
10. Click delete. Confirm. Verify the cert is gone and the list total is back to 3.

**Acceptance:**
- Create-with-refresh-only works and renders status `בתוקף`.
- Editing one date field at a time persists correctly.
- Status recomputes on every save based on the effective deadline (earliest of expiry / next_refresh).
- Delete removes the row and updates the list without refresh.

**Explore:**
- What happens if you enter next-refresh earlier than issue-date? Is it allowed? If yes, is that a bug?
- Open the edit form in two tabs, save in one, then save in the other — which wins?
