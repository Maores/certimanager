# Journey 01 — Mobile Nav: all tabs reachable

**Goal:** Verify every item in the mobile bottom nav (including items in the "עוד" sheet) is reachable and leads to a working page.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001.

**Persona:** `sarah-mobile.md` (375×812 viewport)

**Steps:**
1. Open `http://localhost:3001/`.
2. Log in with `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`.
3. Confirm you land on `/dashboard`.
4. In the bottom nav, identify all primary tabs (expect: לוח בקרה, עובדים, הסמכות, משימות, עוד).
5. Tap each primary tab, one at a time. After each tap:
   - Wait up to 3s for navigation.
   - Take a screenshot.
   - Verify the main heading reflects the section.
6. Tap "עוד" to open the sheet. Identify every link inside it.
7. Tap each link in "עוד" one at a time, returning to "עוד" between taps if the sheet auto-closes.
8. For any link that does NOT navigate, produces an error, or leaves the user stranded, record a finding.

**Acceptance:**
- All 4 primary tabs navigate and render a heading.
- The "עוד" sheet opens on tap.
- Every link inside "עוד" navigates to a page that renders without error.
- No horizontal scrollbar appears on any of these pages at 375px.

**Explore:**
- Tap the current tab twice in quick succession — does it scroll to top or reload?
- Rotate to landscape (667×375) — does the nav still work?
