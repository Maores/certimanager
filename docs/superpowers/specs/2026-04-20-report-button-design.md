# Report Button ("דווח") — Design

**Status:** Approved 2026-04-20
**Author:** pairing session with Maor

## Overview

A global "דווח" (report) button in the dashboard header lets the manager leave commented bug reports, suggestions, and questions directly from the app. Reports land in a new `public.feedback` table and are readable on a new admin page at `/dashboard/feedback`. Complements Sentry — Sentry catches code-level crashes, this catches "this looks wrong" feedback where the code didn't throw.

## User story

As a manager using CertiManager day-to-day, I want to leave a quick comment whenever I notice a bug or have a suggestion, without leaving the app, so that the developer (me) can triage these issues alongside automated crash reports.

## Decisions locked in brainstorming

| # | Decision | Chosen | Alternative rejected |
|---|---|---|---|
| 1 | What does the user see when they click "דווח"? | Category dropdown + textarea (no screenshot) | Screenshot attachment (adds html2canvas + Storage — ship later if needed) |
| 2 | Where does the button live? | Icon button in the top header, next to logout | FAB, overflow sheet (conflict with bottom-nav; two taps on mobile) |
| 3 | Where do reports land? | DB + tiny admin page at `/dashboard/feedback` | Email (needs another external account — can layer on later) |
| 4 | Read / unread state? | Yes, `is_read` boolean + "סמן כנקרא" button | No state (would re-read the same reports every visit) |
| 5 | Modal vs popover? | **Popover** anchored under the button, 150ms fade+slide+scale animation | Centered modal (felt heavyweight for a simple report) |

## Schema

New file: `supabase/migration_feedback.sql`.

```sql
CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  uuid NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  category    text NOT NULL CHECK (category IN ('bug','suggestion','question','other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  route       text NOT NULL,
  viewport    text,
  user_agent  text,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_manager_created
  ON public.feedback (manager_id, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_select_own ON public.feedback
  FOR SELECT USING (manager_id = auth.uid());

CREATE POLICY feedback_insert_own ON public.feedback
  FOR INSERT WITH CHECK (manager_id = auth.uid());

CREATE POLICY feedback_update_own ON public.feedback
  FOR UPDATE USING (manager_id = auth.uid());
-- No DELETE policy: audit trail.
```

The DDL is also mirrored in `tests/agents/fixtures/seed.sql` under the self-heal block so the harness works against any staging project state.

## Server actions

File: `src/app/dashboard/feedback/actions.ts`.

```ts
"use server";
export async function submitFeedback(formData: FormData):
  Promise<{ ok: true } | { error: string }>;

export async function markFeedbackRead(id: string):
  Promise<{ ok: true } | { error: string }>;
```

Both use `requireUser()` and insert/update via the row-level-secured client (RLS enforces `manager_id = auth.uid()`).

## UI components

All in `src/components/feedback/report-modal.tsx` and `src/app/dashboard/feedback/page.tsx` (already drafted as a working prototype against mocked data).

1. **`<ReportButton />`** — client component, drops into `src/app/dashboard/layout.tsx` header (next to logout). Uses lucide `MessageSquareWarning`. 44px tap target. Icon-only on mobile, icon+label on desktop. Hidden in guest mode.
2. **Popover dialog** — anchored `absolute top-full left-0 mt-2 w-96 max-w-[calc(100vw-5rem)]`, rendered inside the button's `relative` wrapper. Transitions: `opacity + translate-y + scale`, 150ms ease-out. Click-outside and Escape close.
3. **Form fields** — category `<select>` (באג / הצעה / שאלה / אחר) + textarea with live 0/2000 counter + submit/cancel footer.
4. **Success toast** — fixed bottom, auto-dismiss after 5s, "תודה! הדיווח נשלח".
5. **`/dashboard/feedback` admin page** — desktop table + mobile cards. Columns: unread-dot · date · category badge · route · description · "סמן כנקרא" action (only on unread rows). Unread-count badge in the header. Empty state with inbox icon.
6. **Sidebar nav item** — `{ label: "דיווחים", href: "/dashboard/feedback", icon: "feedback" }` with lucide `Inbox` in the iconMap. Visible to authenticated managers only.

## Data captured at submit time

Client gathers and passes with formData:
- `category` — from the dropdown
- `description` — from the textarea
- `route` — `location.pathname + location.search`
- `viewport` — `"${innerWidth}x${innerHeight}"`
- `user_agent` — `navigator.userAgent`

Server adds: `manager_id = auth.uid()`, `created_at = now()`, `is_read = false`.

## Error handling

- Empty description → HTML5 `required` + client-side check; never hits the server.
- >2000 chars → `maxLength` on textarea hard-blocks; DB check as defense-in-depth.
- Server error (network / RLS / unexpected) → inline error in popover, textarea value preserved so the user doesn't retype.
- Unauthenticated → `requireUser()` throws; client surfaces "אנא התחבר מחדש".

## Testing plan

- **Unit (vitest + RTL):**
  - `report-modal.test.tsx` — opens popover on click, validates empty description, calls server action with auto-captured context, closes on success, keeps text on error.
  - `feedback-actions.test.ts` — server action inserts with the correct `manager_id`; RLS blocks reading another manager's rows (integration test against staging, following the pattern of `lib-supabase-auth.test.ts`).
- **E2E (Playwright, same pattern as PR #12 verification):** log in → click `דווח` → select category → type description → submit → success toast visible → navigate to `/dashboard/feedback` → row present with correct route + category; click "סמן כנקרא" → is_read updates.

## Out of scope for v1 (explicit non-goals)

- Screenshot attachment
- Email notifications to the dev
- Multi-tenant super-admin view (current model: one manager sees only their own reports)
- Edit or delete reports (audit trail only)
- Rate limiting (single-tenant manager tool, not a public surface)
- Rich-text formatting in descriptions

## Migration + deployment checklist

To include in the PR description:

1. [ ] Run `supabase/migration_feedback.sql` in the **staging** Supabase project (the one `.env.test` points at) **before merging**.
2. [ ] Run the same SQL in the **production** Supabase project **before** clicking "Deploy" in Render.
3. [ ] Verify in production: log in → click `דווח` → submit a test report → visit `/dashboard/feedback` → see the row.

If code deploys before the migration runs, inserts will throw "relation `feedback` does not exist".

## Observability hook

Sentry (shipped in a separate PR) will catch any exception thrown from `submitFeedback` / `markFeedbackRead`. No extra wiring needed here — server actions that throw are already picked up by the Sentry wrapper.

## Pre-existing prototype

A working visual prototype of button + popover + admin page with mocked data exists in the branch. The implementation plan's job is to:

1. Add the migration.
2. Replace the mocked prototype's `console.log` with a real server action.
3. Replace the admin page's `MOCK_ROWS` with a real DB query.
4. Mirror the DDL into `seed.sql`.
5. Write the two test files.

The visual design, popover positioning, and accessibility wiring are already done and approved.

## Addendum — 2026-04-20: delete reports

**Status:** Approved 2026-04-20 (supersedes v1 "no delete" decision)

### Why the change

v1 ruled out delete for audit-trail reasons. That reasoning applied to a multi-user system where reports might be disputed or referenced by different people. In practice this is a **solo-use triage inbox** — the only user is also the only reader. "סמן כנקרא" already covers the "triaged but keep" state; the user needs a separate "done-and-gone" action to clean up resolved or duplicate reports. Supabase/Render daily backups cover accidental loss for the window that matters.

### Decisions locked

| # | Decision | Chosen | Alternative rejected |
|---|---|---|---|
| A1 | Hard-delete vs soft-delete? | **Hard-delete** — physical row removal via SQL `DELETE`. | Soft-delete with `deleted_at` column. Extra infra for a solo inbox. YAGNI. |
| A2 | Scope — single-row or bulk? | **Single-row** only. Trash action on each row. | Bulk-delete (checkboxes + toolbar). Deferred until the existing multi-select work for `מועמדים`/`הסמכות`/`משימות` ships a reusable primitive. |
| A3 | Confirmation UX | Reuse the existing `<DeleteButton>` primitive with its 2-step inline "בטוח?" confirm. | Modal dialog. Overkill and inconsistent with `employees`/`certifications`/`cert-types`/`candidates` deletes. |
| A4 | Row visibility | Visible on **all rows** (read and unread). Side-by-side with `סמן כנקרא` on unread rows. | Gate behind mark-read (forces triage flow). Adds friction without benefit — sometimes a report is garbage and should be deleted without being read. |
| A5 | Post-delete feedback | Row disappears after `router.refresh()`. **No toast.** | "הדיווח נמחק" toast. Inconsistent with other deletes in the app, which just refresh. |

### Schema change

New file: `supabase/migration_feedback_delete.sql`.

```sql
CREATE POLICY feedback_delete_own ON public.feedback
  FOR DELETE USING (manager_id = auth.uid());
```

Mirror the same line into the self-heal block of `tests/agents/fixtures/seed.sql` so the harness stays consistent.

### Server action addition

Append to `src/app/dashboard/feedback/actions.ts`:

```ts
export async function deleteFeedback(id: string): Promise<ActionResult> {
  if (!id) return { error: "id חסר" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
```

Same signature and error shape as `markFeedbackRead`. RLS enforces scope — a malicious client cannot delete another manager's rows.

### UI component

New file: `src/app/dashboard/feedback/delete-feedback-button.tsx`. Client component, structure mirrors `mark-read-button.tsx`: `useTransition` + `useRouter().refresh()`. Internally renders the existing `<DeleteButton>` primitive from `src/components/ui/delete-button.tsx`, passing an async `action` that calls `deleteFeedback(id)`.

The existing `<DeleteButton>` already provides the 2-step "בטוח? · מחק / ביטול" inline confirm, min-44px tap targets, `touch-manipulation`, and pending-state spinner — no new UX work needed.

### Page integration

Edit `src/app/dashboard/feedback/page.tsx`:

- **Desktop table:** in the action cell, render `<DeleteFeedbackButton id={row.id} />` on every row. Keep `<MarkReadButton>` in the same cell when `!row.is_read`.
- **Mobile cards:** in the action row (currently shows `סמן כנקרא` on unread cards), append `<DeleteFeedbackButton>`. Visible on read cards too.

### Testing

- **Unit (vitest + RTL):**
  - Extend `src/__tests__/feedback-actions.test.ts` with three new cases for `deleteFeedback`:
    - success path: action inserts a row then deletes it; subsequent select returns 0 rows.
    - missing id → `{ error: "id חסר" }`.
    - RLS violation: action called with valid id but mocked DB error → returns the error message.
  - New file `src/__tests__/delete-feedback-button.test.tsx`: initial click shows "בטוח?"; cancel restores the delete button; confirm triggers the mocked action and calls `router.refresh()`.

### Out of scope for this addendum

- Undo toast / soft-delete grace period.
- Bulk delete (see A2).
- Purging old rows automatically (cron / scheduled function).
- Exporting deleted rows to a log before removal.

### Deployment checklist

To include in the PR description:

1. [ ] Run `supabase/migration_feedback_delete.sql` in **staging** Supabase before merging.
2. [ ] Run the same SQL in **production** Supabase before clicking "Deploy" in Render.
3. [ ] Verify in production: open `/dashboard/feedback` → click `מחיקה` on a row → confirm `מחק` → row disappears.

If code deploys before the production migration runs, clicking `מחק` surfaces `new row violates row-level security policy` in the inline error. Recoverable: run the migration, retry.
