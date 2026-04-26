# Bulk Delete — הסמכות + משימות (Certifications & Tasks)

**Date:** 2026-04-21
**Scope:** Add multi-row selection + bulk delete to the Certifications and Tasks tabs, matching the UX pattern already in the Candidates tab.
**Status:** Design approved, ready for implementation planning.

---

## Problem

Managers can only delete one certification or one task at a time. The Candidates tab has had multi-select + bulk delete for a while and users rely on it. The other two list-oriented tabs (הסמכות, משימות) are inconsistent and force tedious one-by-one deletion.

## Goal

Ship bulk delete on both tabs using the same UX the Candidates tab uses, so managers have a consistent, predictable selection-and-bulk-action experience across the app.

## Non-goals

- Bulk actions other than delete (export, status change, reassign, date changes) — deferred.
- A shared `useBulkSelection` hook or bulk-action primitive — deferred until a third use case appears.
- Guest-mode support for bulk delete — deferred; guest sessions will not see checkboxes or the bulk bar in certifications.
- Keyboard shortcuts (Cmd/Ctrl-A, Shift-click ranges) — deferred.
- Select-across-pagination semantics — irrelevant for current data sizes (no pagination on certifications; single-page listing on tasks today).
- Multi-select in the Candidates tab — already exists; we mirror, not rebuild.

## Users & context

- **Primary user:** the manager using CertiManager to maintain ~150 employees' certifications and tasks.
- **Environment:** Hebrew UI, RTL, mobile-first. Desktop table → mobile card layout per existing conventions.
- **Existing pattern:** `src/components/candidates/candidates-table.tsx` and `src/app/dashboard/candidates/actions.ts` are the reference. Both were shipped in PR #16 and are live in production.

---

## UX Design

### Pattern: always-visible checkbox column (Pattern "A")

Checkboxes are rendered persistently, not behind a "select mode" toggle or long-press. This matches the Candidates pattern and minimizes cognitive load — users don't need to remember to "enter" a mode.

### Desktop (table view)

- Leading column of the table is a checkbox column (width ~40px).
- Header cell contains a **select-all** checkbox. Its state reflects the currently-visible rows:
  - Unchecked → none selected.
  - Checked → all visible rows selected.
  - (Indeterminate state is nice-to-have but not required for Phase 1.)
- Each body row contains a per-row checkbox with `aria-label` describing the row (e.g. `"בחר הסמכה של יוסי לוי"` / `"בחר משימה של דינה כהן"`).
- Clicking a checkbox updates selection state only; does not navigate or trigger any server call.

### Mobile (card view)

- Each card has a checkbox rendered inline at the top-start corner, adjacent to the employee name.
- The existing card layout stays intact. We do **not** convert mobile to a table.
- Checkbox tap target is ≥44×44 px to meet touch-accessibility standards.

### Bulk action bar

Rendered when `selected.size > 0`, anchored above the list (not sticky for Phase 1 — simpler). Contains:

- Left (start, RTL): `"{N} נבחרו"` count label.
- Right (end, RTL): `"מחק נבחרים"` danger button with `Trash2` icon.

Bar is hidden when nothing is selected. No extra affordances (no "clear selection", no select-all button outside the table header) in Phase 1 — the user can uncheck manually.

### Delete confirmation

Reuse the existing `DeleteDialog` component (moved from `src/components/candidates/` to `src/components/ui/` and generalized — see Architecture).

- Title: `"מחיקת {N} {nounPlural}"` (bulk) or `"מחיקת {noun}"` (single, if a user happens to select only one before clicking the bulk button).
- Body text: `"האם למחוק {N} {nounPlural}? פעולה זו אינה ניתנת לביטול."`
- Bulk body includes a scrollable list of selected items (cert: `{employee_name} — {cert_type_name}`; task: `{employee_name} — {first 40 chars of description}`).
- Confirm button: red "מחק" with loading spinner while the action runs.
- Cancel: closes dialog, selection is preserved (so the user can retry or adjust).

### Success / error feedback

Same banner pattern as Candidates:

- Success: green banner `"נמחקו {N} הסמכות"` / `"נמחקו {N} משימות"` with auto-dismiss after 7 seconds and a manual close (×) button.
- Partial failure: red banner `"נמחקו {N}. שגיאות: ..."` listing item identifiers that failed. Successful rows are already gone; failures remain selected so the user can retry.
- Full failure: red banner with the underlying error message.

---

## Architecture

### PR 1 — Certifications bulk delete (`feat/certifications-bulk-delete`)

**New files:**
- `src/components/certifications/certifications-list.tsx` (client component)
  - Props: `{ certifications: CertificationRow[] }`.
  - Owns `selected: Set<string>` state via `useState`.
  - Renders the desktop table and mobile card list inline (moved from `page.tsx`).
  - Renders the bulk action bar + DeleteDialog.
  - Copy-pastes the ~20 lines of selection logic (`toggleSelect`, `toggleAll`, bulk handlers) from `candidates-table.tsx`.
- `src/components/ui/delete-dialog.tsx` — relocated and generalized (see below).
- `src/__tests__/certifications-delete-actions.test.ts` — server-action unit tests.
- `src/__tests__/certifications-list.test.tsx` — component tests.

**Modified files:**
- `src/app/dashboard/certifications/page.tsx`
  - Continues to fetch data server-side.
  - Transforms certifications as today, then passes the array to `<CertificationsList>`.
  - No longer renders the table/cards inline.
- `src/app/dashboard/certifications/actions.ts`
  - Adds `export async function deleteCertifications(ids: string[]): Promise<{ deleted: number; errors: string[] }>`.
  - Signature and behavior mirror `deleteCandidates`.
  - Additionally loops through results and removes associated `image_url` files from the `cert-images` storage bucket in one `storage.remove([...paths])` call after DB deletion.
  - Guest-mode path: not supported in Phase 1; called from a guest session, the action returns `{ deleted: 0, errors: ["bulk delete not available in guest mode"] }` (defensive — the UI hides the bulk bar for guests anyway).
- `src/components/candidates/candidates-table.tsx` — updates import path for the moved `DeleteDialog`.
- (No other candidate changes — PromoteDialog stays where it is.)

**Shared refactor (ships in PR 1):**
- Move `src/components/candidates/delete-dialog.tsx` → `src/components/ui/delete-dialog.tsx`.
- Rename prop `candidateNames` → `itemNames`.
- Add props `noun: string` and `nounPlural: string`.
- Update title/body strings to interpolate `{noun}` / `{nounPlural}`.
- Update the two call sites (candidates-table.tsx for this release; certifications-list.tsx uses it fresh).

### PR 2 — Tasks bulk delete (`feat/tasks-bulk-delete`)

Ships after PR 1 is merged. Dialog is already generalized.

**Modified files:**
- `src/app/dashboard/tasks/tasks-client.tsx` (already a client component)
  - Adds `selected: Set<string>` state, select-all/per-row checkboxes, bulk action bar, DeleteDialog integration.
  - Keeps existing per-row delete + status-change controls unchanged.
- `src/app/dashboard/tasks/actions.ts`
  - Adds `export async function deleteTasks(ids: string[]): Promise<{ deleted: number; errors: string[] }>`.
  - Verifies ownership via the `employees.manager_id` join, same as the existing single-task `deleteTask` does.

**New files:**
- `src/__tests__/tasks-delete-actions.test.ts`
- `src/__tests__/tasks-client-bulk.test.tsx` (or extend an existing tasks-client test file if one exists).

---

## Data flow

1. Page loads → server component fetches rows → passes to client list component. No change from today.
2. User checks a row → client state updates (`selected: Set<string>`). No network call.
3. `selected.size > 0` → bulk action bar renders. Count reflects `selected.size`.
4. User clicks `"מחק נבחרים"` → `DeleteDialog` opens with `itemNames` = names of selected rows.
5. User confirms → client calls `deleteCertifications(Array.from(selected))` or `deleteTasks(...)`.
6. Server action:
   - Iterates ids. For each: scoped delete `WHERE id = $1 AND manager_id = $userId` (certifications uses the `employees.manager_id` join). Collect errors into an array.
   - Certifications only: after the DB loop, gather the `image_url`s of successfully deleted rows and call `supabase.storage.from("cert-images").remove([...])`.
   - Returns `{ deleted: number, errors: string[] }`.
7. Client:
   - On full success → green banner, auto-dismiss after 7s, clears `selected`, calls `router.refresh()`.
   - On partial failure → red banner listing errors; successfully deleted rows still re-fetched; failing rows stay selected.
   - On thrown error (network, auth) → red banner with the error message.

---

## Error handling & edge cases

- **Partial failure:** handled per above — mixed result banner, retain failed selections.
- **Empty selection:** bulk bar never renders; `"מחק נבחרים"` cannot be reached.
- **Stale selection** (another tab deleted the row first): `DELETE ... WHERE id = $1 AND manager_id = $userId` affects 0 rows but doesn't error. We count it as `deleted` (silent success) — the row is gone, which is what the user wanted.
- **Auth expired mid-action:** existing pattern — the server action's `requireUser` redirects to `/login`; the client follows the redirect. In-progress selection is lost (acceptable for Phase 1).
- **Concurrency (two tabs):** first delete wins; second sees 0-rows-affected → silent success. Not worth further hardening at current scale.
- **Huge selection:** no hard cap. Target scale is ~150 employees, so even selecting every cert at once is fine. We revisit if this ever matters.
- **Guest mode (certifications):** checkboxes and bulk bar are hidden when the page detects a guest session. Defensive: server action refuses with `{ deleted: 0, errors: [...] }` if called in a guest session.

---

## Testing (TDD)

Tests are written **before** implementation for each PR.

### PR 1 tests

**`src/__tests__/certifications-delete-actions.test.ts`:**
- Deletes multiple owned certs → `{ deleted: N, errors: [] }`.
- Cross-manager isolation: attempting to delete another manager's cert id affects 0 rows, does not expose or modify the other manager's data, and returns in `deleted` count as silent success (matches `deleteCandidates` behavior).
- Cleans up `cert-images` storage bucket for deleted certs with `image_url` (storage cleanup only for rows the DB actually deleted).
- Storage cleanup failure does not fail the whole action — DB delete is authoritative; orphaned file is acceptable and logged.
- Empty `ids` array → `{ deleted: 0, errors: [] }`.
- Guest session path → refuses with `{ deleted: 0, errors: [...] }`.

**`src/__tests__/certifications-list.test.tsx`:**
- Renders checkbox column on desktop table.
- Renders checkbox inside each mobile card.
- Select-all checkbox toggles all visible rows.
- Individual checkbox toggles one row.
- Bulk bar hidden when `selected.size === 0`.
- Bulk bar shows correct count and "מחק נבחרים" button when ≥1 selected.
- Clicking "מחק נבחרים" opens DeleteDialog with correct names.
- Successful bulk-delete path shows green banner with auto-dismiss.
- Partial failure shows red banner preserving failed selections.

### PR 2 tests

Symmetric to PR 1, targeting `deleteTasks` and the tasks-client bulk UI. Existing single-delete tests stay green (regression guard).

### Browser verification (per project convention)

Before opening each PR:
1. Log in as admin in Chrome via Claude-in-Chrome MCP.
2. Navigate to the tab under test.
3. Tick 3 rows, confirm bulk bar shows `"3 נבחרו"` and the dialog lists the correct names.
4. Confirm delete → green banner → list refreshes → rows are gone.
5. Deselect-all via select-all toggle.
6. Resize to mobile viewport, repeat at least the tick-and-delete path.
7. (Certifications only) Confirm an uploaded file is removed from storage after its cert is bulk-deleted.

### Out of scope

- No E2E (no Playwright in the project today).
- No visual-regression snapshots.
- No performance tests for large selections.

---

## Scope split

**PR 1 — `feat/certifications-bulk-delete`** (ships first)
- New `<CertificationsList>` component.
- `deleteCertifications` server action.
- DeleteDialog relocation + generalization.
- All associated tests.
- Estimated diff: ~450-600 lines.

**PR 2 — `feat/tasks-bulk-delete`** (ships after PR 1 merged)
- Selection state + bulk UI in existing `tasks-client.tsx`.
- `deleteTasks` server action.
- Associated tests.
- Estimated diff: ~300-400 lines.

Each PR ships independently, with its own browser verification and PR description. PR 2 benefits from the dialog refactor done in PR 1.

---

## Open questions / deferred decisions

- None blocking. Everything else (other bulk actions, primitive extraction, guest support, keyboard shortcuts) is explicitly deferred.

## Next step

After spec approval: run `superpowers:writing-plans` to produce a detailed implementation plan for **PR 1 only**. PR 2 gets its own plan after PR 1 merges.
