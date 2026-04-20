# Candidates Tab — Hide Promoted + Bulk Delete — Design

**Status:** Approved 2026-04-20 (pairing session with Maor)

## Overview

Two related cleanups to `/dashboard/candidates`:

1. **Hide promoted candidates.** Once a candidate is promoted to an employee, their row keeps appearing in the candidates list with a green `UserCheck` icon. The user already sees that person in the employees list, so the candidates row is pure clutter.
2. **Bulk delete.** The bulk action bar currently only offers `קדם לעובדים`. Add a sibling `מחק נבחרים` button that deletes every selected candidate in one shot, with a modal confirm showing the names being deleted.

Both fixes touch `candidates-table.tsx` + `actions.ts` + `page.tsx` and ship together in one PR.

## User stories

- As a manager triaging course candidates, I want promoted candidates to disappear from the list automatically so my work queue is just the people who still need action.
- As a manager cleaning up bad imports or duplicates, I want to delete several candidates at once instead of clicking the trash icon on each row.

## Decisions locked in brainstorming

| # | Decision | Chosen | Alternative rejected |
|---|---|---|---|
| 1 | How to hide promoted candidates? | **Server-side query filter** `status != 'הוסמך'` on the main query AND the count query | Client-side filter after the employees cross-reference (breaks pagination counts); NOT EXISTS subquery (overkill at current scale) |
| 2 | Bulk-delete confirmation UX? | **Modal dialog** listing all names being deleted + "לא ניתן לבטל פעולה זו" warning + red `מחק` / neutral `ביטול` buttons | Browser `confirm()` (matches existing single-row delete but hides which rows are about to go — bad for multi-select mistakes) |
| 3 | Scope of this PR | Both fixes in one PR; same 2 files change | Two PRs (thrashing, same files) |
| 4 | Recoverability of promoted-hidden rows | **No toggle to show them.** They remain in DB but are invisible. If needed later, add a "הצג מקודמים" toggle in a follow-up | Always-visible with a strikethrough style (kept the clutter) |

## Current behaviour being changed

**`src/app/dashboard/candidates/page.tsx`** currently fetches:

```ts
let query = supabase
  .from("course_candidates")
  .select("*, cert_types(name)")
  .eq("manager_id", user.id)
  .order("created_at", { ascending: false });
// ...filters by q, cert_type, statusFilter...
```

The page then cross-references with `employees` by `id_number` to set `is_employee: true` on each row. The table renders a read-only `UserCheck` icon for promoted candidates instead of the promote button.

**`src/components/candidates/candidates-table.tsx`** has a bulk action bar (line ~171) that renders only when `selected.size > 0`:

```tsx
<button onClick={handleBulkPromote}>
  <Users className="h-3.5 w-3.5" />
  קדם לעובדים
</button>
```

Single-row delete (`handleDelete` at line ~81) uses browser `confirm()` and calls the existing `deleteCandidate(id)` action.

## Changes

### 1. Filter promoted out of the view

In `src/app/dashboard/candidates/page.tsx`, add a single `.neq` to both the main query and the count query:

```ts
let query = supabase
  .from("course_candidates")
  .select("*, cert_types(name)")
  .eq("manager_id", user.id)
  .neq("status", "הוסמך")   // ← new
  .order("created_at", { ascending: false });

// ...

let countQuery = supabase
  .from("course_candidates")
  .select("*", { count: "exact", head: true })
  .eq("manager_id", user.id)
  .neq("status", "הוסמך");  // ← new
```

Nothing else in the page changes. The `is_employee` cross-reference becomes partially redundant (every remaining row will be `!is_employee` in the normal flow), but it stays — it's the safety net for the edge case where a candidate's status is `"הוסמך"` manually but they aren't in the employees table yet (incomplete promotion). Those rows are hidden too, which matches user intent.

Empty state copy in the page already reads "לא נמצאו מועמדים / התחל בהוספת מועמד חדש או ייבוא מקובץ" — works unchanged.

### 2. New `deleteCandidates` server action

Append to `src/app/dashboard/candidates/actions.ts`:

```ts
export async function deleteCandidates(ids: string[]): Promise<{
  deleted: number;
  errors: string[];
}> {
  const result = { deleted: 0, errors: [] as string[] };
  if (!Array.isArray(ids) || ids.length === 0) return result;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  for (const id of ids) {
    const { error } = await supabase
      .from("course_candidates")
      .delete()
      .eq("id", id)
      .eq("manager_id", user.id);
    if (error) result.errors.push(`${id}: ${mapSupabaseError(error.message)}`);
    else result.deleted++;
  }

  revalidatePath("/dashboard/candidates");
  return result;
}
```

Shape parallels `promoteCandidates` — returns a summary so the UI can show "מחקו X מועמדים" with partial-error handling. Iterates rather than using `.in()` so one bad row doesn't abort the batch.

### 3. `<DeleteDialog>` component

New file: `src/components/candidates/delete-dialog.tsx`. Mirrors `PromoteDialog` structure:

```tsx
"use client";

interface DeleteDialogProps {
  open: boolean;
  candidateNames: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDialog({ open, candidateNames, onConfirm, onCancel }: DeleteDialogProps) {
  if (!open) return null;

  const count = candidateNames.length;
  const title = count === 1 ? `מחיקת מועמד` : `מחיקת ${count} מועמדים`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="delete-dialog-title" className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">פעולה זו אינה ניתנת לביטול.</p>
        <ul className="mt-3 max-h-48 overflow-y-auto rounded-md border border-border bg-gray-50 p-3 text-sm text-foreground">
          {candidateNames.map((name) => (
            <li key={name} className="py-0.5">{name}</li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="min-h-[44px] rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-50 transition-colors cursor-pointer">
            ביטול
          </button>
          <button type="button" onClick={onConfirm} className="min-h-[44px] rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer">
            מחק
          </button>
        </div>
      </div>
    </div>
  );
}
```

Same interaction contract as `PromoteDialog` (open/candidateNames/onConfirm/onCancel). Kept separate rather than generalizing — generalizing into a shared `ConfirmDialog` is a good follow-up but out of scope for this PR (YAGNI; two call sites is not yet "repeated three times" territory).

### 4. Wire bulk delete into `candidates-table.tsx`

- Import `DeleteDialog` from `./delete-dialog` and `deleteCandidates` from `@/app/dashboard/candidates/actions`.
- Add a `deleteDialog` state object parallel to `promoteDialog`.
- Add `handleBulkDelete()`: maps `selected` ids → names, opens the dialog.
- Add `handleConfirmDelete()`: calls `deleteCandidates(ids)`, sets success/error messages, closes dialog, clears selection, refreshes router.
- Add a second button to the bulk action bar. Placement: after `קדם לעובדים`, visually distinguished as danger (red bg).
- Render `<DeleteDialog>` alongside the existing `<PromoteDialog>`.

Exact bulk action bar diff:

```tsx
{/* Bulk action bar */}
{selected.size > 0 && (
  <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
    <span className="font-medium text-blue-800">{selected.size} נבחרו</span>
    <button type="button" onClick={handleBulkPromote} className="...">
      <Users className="h-3.5 w-3.5" /> קדם לעובדים
    </button>
    <button
      type="button"
      onClick={handleBulkDelete}
      className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors cursor-pointer"
    >
      <Trash2 className="h-3.5 w-3.5" />
      מחק נבחרים
    </button>
  </div>
)}
```

## Error handling

- Bulk delete: `deleteCandidates` returns `{ deleted, errors }`. If `errors.length > 0`, UI shows `"נמחקו X מועמדים. שגיאות: …"`. If `deleted > 0 && errors.length === 0`, shows the success toast pattern already in the component (`setSuccess(...)`).
- Empty `ids[]` → action short-circuits to `{ deleted: 0, errors: [] }` without hitting Supabase.
- User not authenticated → `redirect("/login")` (same as every other action in this file).
- Filter for hidden promoted rows has no failure mode — it's just a `.neq` clause.

## Testing plan

### Unit (vitest + RTL)

- **Extend `src/__tests__/candidates-table.test.tsx`** with three cases:
  1. When rows selected and bulk-delete clicked, dialog opens listing their names.
  2. Cancel closes the dialog and does NOT call `deleteCandidates`; selection stays intact.
  3. Confirm calls `deleteCandidates` with the exact selected ids, on success clears selection + refreshes router + surfaces the success message.
- **New `src/__tests__/candidates-delete-actions.test.ts`** with three cases for `deleteCandidates` — parallels the existing feedback-actions pattern (mock Supabase `from(...).delete().eq().eq()`):
  1. Happy path — 3 ids → 3 delete calls scoped by both `id` and `manager_id` → `{ deleted: 3, errors: [] }`.
  2. Partial failure — one id returns an error → result has `deleted: 2, errors: [one message]`.
  3. Empty array → short-circuits, no Supabase calls.

### Browser verification (staging)

1. Reproduce bug #3: navigate to `/dashboard/candidates`. A known-promoted candidate (status `"הוסמך"`) must NOT appear. Cross-reference: they appear in `/dashboard/employees`.
2. Bulk delete: select 2 pending candidates → click `מחק נבחרים` → modal opens with their names → confirm → rows disappear, toast shows `"מחקו 2 מועמדים"`.
3. Cancel path: select 1 candidate → `מחק נבחרים` → cancel → dialog closes, candidate still present, selection still showing.
4. Regression: individual row delete button still works (unchanged code path).
5. Regression: bulk-promote still works.

## Out of scope for this PR

- A "הצג מקודמים" toggle to re-show promoted candidates (future — follow-up if the user ever misses them).
- Generalizing `PromoteDialog` + `DeleteDialog` into a single `ConfirmDialog`. Two call sites; not yet worth it.
- Undo toast after bulk delete. Matches the "done-and-gone" pattern from PR #15 (feedback delete) — if we add undo, we add it everywhere together in a separate design.
- Soft-delete / audit trail for candidate deletions. Same rationale as feedback: solo-use, backups cover accidents.

## Migration + deployment checklist

**No DB migration.** RLS on `course_candidates` already permits DELETE scoped by `manager_id` — the existing `deleteCandidate` action uses the same policy.

1. [ ] Merge PR after CI green.
2. [ ] Click Deploy in Render.
3. [ ] Post-deploy smoke on production: promote one test candidate → confirm they vanish from the list. Select 2 test candidates → bulk-delete → confirm both vanish.

## File summary

- Modify: `src/app/dashboard/candidates/page.tsx` (two `.neq` lines).
- Modify: `src/app/dashboard/candidates/actions.ts` (append `deleteCandidates`).
- Modify: `src/components/candidates/candidates-table.tsx` (dialog state + bulk-delete button + handlers + DeleteDialog render).
- Create: `src/components/candidates/delete-dialog.tsx` (new modal component).
- Modify: `src/__tests__/candidates-table.test.tsx` (3 new RTL cases).
- Create: `src/__tests__/candidates-delete-actions.test.ts` (3 new action cases).
