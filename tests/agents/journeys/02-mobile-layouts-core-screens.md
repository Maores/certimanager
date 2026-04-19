# Journey 02 — Mobile Layouts: core screens at 375px

**Goal:** Verify `/dashboard`, `/dashboard/employees`, `/dashboard/certifications`, and an employee detail page render cleanly at 375×812.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001.

**Persona:** `sarah-mobile.md`

**Steps:**
1. Log in (see Journey 01 steps 1-3).
2. Navigate to `/dashboard`. Screenshot. Check: no horizontal scroll, no element clipped at the right edge, all text readable.
3. Navigate to `/dashboard/employees`. Screenshot. Check: employee cards/rows fit the viewport, names and employee numbers fully visible, tap targets reachable.
4. Tap any employee row to open detail page. Screenshot. Check: cert list fits, dates readable, "עריכה" and "מחיקה" buttons both reachable with one thumb.
5. Back to list. Navigate to `/dashboard/certifications`. Screenshot. Check: each cert card shows the correct date labels (הנפקה, תפוגה, מועד רענון הבא) when present, `—` when absent, status badge visible.
6. Open the filter/sort controls. Try changing a filter. Verify the list updates without overflowing.

**Acceptance:**
- Zero horizontal scrollbars on any of these four screens.
- Zero elements clipped at the right or bottom edge of the viewport.
- All Hebrew text renders RTL correctly (first character on the right).
- Status badges visible on every cert card where status applies.
- All tap targets ≥40px on the smallest dimension.

**Explore:**
- Pull down to refresh on each list — does it work, or is it a browser-level overscroll?
- Long-press an employee row — does anything happen, and is it intentional?
