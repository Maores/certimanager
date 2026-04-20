# Candidates — Hide Promoted + Bulk Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide promoted candidates from the `/dashboard/candidates` view via a server-side status filter, and add a bulk-delete button (with a names-listing confirm modal) to the existing bulk action bar.

**Architecture:** The page query adds one `.neq("status", "הוסמך")` on both the main and count queries to hide promoted rows. A new `DeleteDialog` component mirrors the existing `<PromoteDialog>` with delete-specific copy. A new `deleteCandidates(ids)` server action iterates `.delete().eq("id").eq("manager_id")` scoped to the authed user. The table wires them together: a `מחק נבחרים` button in the bulk action bar opens the dialog; confirming calls the action, refreshes, clears selection.

**Tech Stack:** Next.js 16 App Router + React 19, Supabase SSR + RLS, vitest + @testing-library/react.

---

## Task 1: `<DeleteDialog>` component

**Files:**
- Create: `src/components/candidates/delete-dialog.tsx`

The dialog is a plain client component with no server interaction — its own coverage comes from Task 3's table tests (open/cancel/confirm paths exercised through the real React tree). No separate component test.

- [ ] **Step 1: Create the component**

Write to `src/components/candidates/delete-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  candidateNames: string[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteDialog({ open, candidateNames, onConfirm, onCancel }: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  const isBulk = candidateNames.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isBulk ? `מחיקת ${candidateNames.length} מועמדים` : "מחיקת מועמד"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-600">
          {isBulk
            ? `האם למחוק ${candidateNames.length} מועמדים? פעולה זו אינה ניתנת לביטול.`
            : `האם למחוק את ${candidateNames[0]}? פעולה זו אינה ניתנת לביטול.`}
        </p>

        {isBulk && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
            <ul className="space-y-1 text-sm text-gray-700">
              {candidateNames.map((name, idx) => (
                <li key={idx}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-danger/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                מוחק...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                מחק
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-muted hover:bg-gray-50 hover:text-foreground transition-colors cursor-pointer"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/candidates/delete-dialog.tsx
git commit -m "feat(candidates): add DeleteDialog component mirroring PromoteDialog"
```

---

## Task 2: `deleteCandidates` server action (TDD)

**Files:**
- Create: `src/__tests__/candidates-delete-actions.test.ts`
- Modify: `src/app/dashboard/candidates/actions.ts` (append new export)

The existing `actions.ts` uses `createClient()` directly (not `requireUser`). The mocking shape is different from `feedback-actions.test.ts` — we mock `@/lib/supabase/server` directly.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/candidates-delete-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteSpy = vi.fn();
const eqFirstSpy = vi.fn();
const eqSecondSpy = vi.fn();

// Chain: .delete().eq("id", id).eq("manager_id", userId)
const fromSpy = vi.fn((_table: string) => ({
  delete: () => {
    deleteSpy();
    return {
      eq: (col: string, val: string) => {
        eqFirstSpy(col, val);
        return { eq: eqSecondSpy };
      },
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: fromSpy,
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect: ${path}`);
  }),
}));

beforeEach(() => {
  deleteSpy.mockReset();
  eqFirstSpy.mockReset();
  eqSecondSpy.mockReset();
  eqSecondSpy.mockResolvedValue({ error: null });
  fromSpy.mockClear();
  vi.resetModules();
});

describe("deleteCandidates", () => {
  it("deletes each id scoped by manager_id and returns the count", async () => {
    const { deleteCandidates } = await import("@/app/dashboard/candidates/actions");
    const result = await deleteCandidates(["c1", "c2", "c3"]);

    expect(result).toEqual({ deleted: 3, errors: [] });
    expect(fromSpy).toHaveBeenCalledWith("course_candidates");
    expect(deleteSpy).toHaveBeenCalledTimes(3);
    expect(eqFirstSpy).toHaveBeenNthCalledWith(1, "id", "c1");
    expect(eqFirstSpy).toHaveBeenNthCalledWith(2, "id", "c2");
    expect(eqFirstSpy).toHaveBeenNthCalledWith(3, "id", "c3");
    // Second .eq scopes by manager_id = user.id
    expect(eqSecondSpy).toHaveBeenCalledWith("manager_id", "user-1");
  });

  it("records partial failures and keeps going", async () => {
    // First two succeed, third fails
    eqSecondSpy
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "permission denied" } });

    const { deleteCandidates } = await import("@/app/dashboard/candidates/actions");
    const result = await deleteCandidates(["c1", "c2", "c3"]);

    expect(result.deleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("c3");
  });

  it("returns zero deleted on empty array without hitting Supabase", async () => {
    const { deleteCandidates } = await import("@/app/dashboard/candidates/actions");
    const result = await deleteCandidates([]);

    expect(result).toEqual({ deleted: 0, errors: [] });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/__tests__/candidates-delete-actions.test.ts
```

Expected: 3 fails — `deleteCandidates is not a function` (module doesn't export it yet).

- [ ] **Step 3: Add the action**

Open `src/app/dashboard/candidates/actions.ts`. Append AFTER `promoteCandidates` (around line 217):

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

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/__tests__/candidates-delete-actions.test.ts
```

Expected: 3/3 pass.

Also typecheck:

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/candidates-delete-actions.test.ts src/app/dashboard/candidates/actions.ts
git commit -m "feat(candidates): deleteCandidates server action with partial-failure reporting"
```

---

## Task 3: Wire bulk-delete into `CandidatesTable` (TDD)

**Files:**
- Modify: `src/__tests__/candidates-table.test.tsx` (extend mock + add new describe block)
- Modify: `src/components/candidates/candidates-table.tsx`

### Step 1: Extend the test-file mock and add failing cases

Open `src/__tests__/candidates-table.test.tsx`. At the top, the existing mocks already cover `promoteCandidate`, `promoteCandidates`, `updateCandidateStatus`, `deleteCandidate`. Add `deleteCandidates`:

- [ ] **Step 1a: Add the mock variable**

Find the existing block:

```ts
const deleteCandidate = vi.fn();

vi.mock("@/app/dashboard/candidates/actions", () => ({
  promoteCandidate: (...args: unknown[]) => promoteCandidate(...args),
  promoteCandidates: (...args: unknown[]) => promoteCandidates(...args),
  updateCandidateStatus: (...args: unknown[]) => updateCandidateStatus(...args),
  deleteCandidate: (...args: unknown[]) => deleteCandidate(...args),
}));
```

Change it to:

```ts
const deleteCandidate = vi.fn();
const deleteCandidates = vi.fn();

vi.mock("@/app/dashboard/candidates/actions", () => ({
  promoteCandidate: (...args: unknown[]) => promoteCandidate(...args),
  promoteCandidates: (...args: unknown[]) => promoteCandidates(...args),
  updateCandidateStatus: (...args: unknown[]) => updateCandidateStatus(...args),
  deleteCandidate: (...args: unknown[]) => deleteCandidate(...args),
  deleteCandidates: (...args: unknown[]) => deleteCandidates(...args),
}));
```

- [ ] **Step 1b: Append a new describe block at the end of the file**

```tsx
describe("CandidatesTable — bulk delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteCandidates.mockResolvedValue({ deleted: 2, errors: [] });
  });

  it("clicking the bulk-delete button opens the DeleteDialog with selected names", async () => {
    render(
      <CandidatesTable
        candidates={[
          makeCandidate({ id: "c1", first_name: "דנה", last_name: "כהן" }),
          makeCandidate({ id: "c2", first_name: "יוסי", last_name: "לוי" }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /בחר דנה כהן/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחר יוסי לוי/ }));
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));

    // Modal title for bulk (2)
    expect(await screen.findByRole("heading", { name: /מחיקת 2 מועמדים/ })).toBeInTheDocument();
    // Names listed
    expect(screen.getByText("דנה כהן")).toBeInTheDocument();
    expect(screen.getByText("יוסי לוי")).toBeInTheDocument();
  });

  it("cancel closes the dialog without calling deleteCandidates; selection preserved", async () => {
    render(
      <CandidatesTable
        candidates={[
          makeCandidate({ id: "c1", first_name: "דנה", last_name: "כהן" }),
          makeCandidate({ id: "c2", first_name: "יוסי", last_name: "לוי" }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /בחר דנה כהן/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחר יוסי לוי/ }));
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));

    fireEvent.click(await screen.findByRole("button", { name: /^ביטול$/ }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /מחיקת 2 מועמדים/ })).not.toBeInTheDocument();
    });
    expect(deleteCandidates).not.toHaveBeenCalled();
    // Both checkboxes still checked after cancel
    expect(screen.getByRole("checkbox", { name: /בחר דנה כהן/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /בחר יוסי לוי/ })).toBeChecked();
  });

  it("confirm calls deleteCandidates with the selected ids and shows success", async () => {
    render(
      <CandidatesTable
        candidates={[
          makeCandidate({ id: "c1", first_name: "דנה", last_name: "כהן" }),
          makeCandidate({ id: "c2", first_name: "יוסי", last_name: "לוי" }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /בחר דנה כהן/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /בחר יוסי לוי/ }));
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^מחק$/ }));

    await waitFor(() => {
      expect(deleteCandidates).toHaveBeenCalledWith(["c1", "c2"]);
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/מחקו 2 מועמדים/);
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run src/__tests__/candidates-table.test.tsx
```

Expected: the 3 new tests fail (button `/מחק נבחרים/` not found, etc.). Existing tests still pass.

- [ ] **Step 3: Update `candidates-table.tsx`**

Open `src/components/candidates/candidates-table.tsx`. Make these four changes:

**3a. Update imports at the top.**

Replace the existing imports block (lines 1–14):

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, UserCheck, Users } from "lucide-react";
import type { CourseCandidate, CandidateStatus } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import {
  updateCandidateStatus,
  deleteCandidate,
  promoteCandidate,
  promoteCandidates,
} from "@/app/dashboard/candidates/actions";
import { PromoteDialog } from "./promote-dialog";
```

Change to:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, UserCheck, Users } from "lucide-react";
import type { CourseCandidate, CandidateStatus } from "@/types/database";
import { CANDIDATE_STATUSES } from "@/types/database";
import {
  updateCandidateStatus,
  deleteCandidate,
  deleteCandidates,
  promoteCandidate,
  promoteCandidates,
} from "@/app/dashboard/candidates/actions";
import { PromoteDialog } from "./promote-dialog";
import { DeleteDialog } from "./delete-dialog";
```

**3b. Add `deleteDialog` state alongside the existing `promoteDialog`.**

Find the line (around line 38):

```tsx
  const [promoteDialog, setPromoteDialog] = useState<{
    open: boolean;
    ids: string[];
    names: string[];
  }>({ open: false, ids: [], names: [] });
```

Add directly after it:

```tsx
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    ids: string[];
    names: string[];
  }>({ open: false, ids: [], names: [] });
```

**3c. Add the bulk-delete handlers.**

Find the `handleBulkPromote` function (around line 108). Directly AFTER its closing brace, insert:

```tsx
  function handleBulkDelete() {
    const ids = Array.from(selected);
    const names = ids.map((id) => {
      const c = candidates.find((cc) => cc.id === id);
      return c ? `${c.first_name} ${c.last_name}` : id;
    });
    setDeleteDialog({ open: true, ids, names });
  }

  async function handleConfirmDelete() {
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteCandidates(deleteDialog.ids);
      if (result.errors.length > 0) {
        setError(`נמחקו ${result.deleted} מועמדים. שגיאות: ${result.errors.join(", ")}`);
      } else {
        setSuccess(`מחקו ${result.deleted} מועמדים`);
      }
      setDeleteDialog({ open: false, ids: [], names: [] });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
      setDeleteDialog({ open: false, ids: [], names: [] });
    }
  }
```

**3d. Add the `מחק נבחרים` button to the bulk action bar.**

Find the `Bulk action bar` JSX (around line 171–183):

```tsx
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-blue-800">{selected.size} נבחרו</span>
          <button
            type="button"
            onClick={handleBulkPromote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
            קדם לעובדים
          </button>
        </div>
      )}
```

Change to:

```tsx
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-blue-800">{selected.size} נבחרו</span>
          <button
            type="button"
            onClick={handleBulkPromote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition-colors cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
            קדם לעובדים
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

**3e. Render `<DeleteDialog>` alongside `<PromoteDialog>`.**

At the bottom of the component, find:

```tsx
      <PromoteDialog
        open={promoteDialog.open}
        candidateNames={promoteDialog.names}
        onConfirm={handleConfirmPromote}
        onCancel={() => setPromoteDialog({ open: false, ids: [], names: [] })}
      />
    </div>
  );
}
```

Change to:

```tsx
      <PromoteDialog
        open={promoteDialog.open}
        candidateNames={promoteDialog.names}
        onConfirm={handleConfirmPromote}
        onCancel={() => setPromoteDialog({ open: false, ids: [], names: [] })}
      />

      <DeleteDialog
        open={deleteDialog.open}
        candidateNames={deleteDialog.names}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/__tests__/candidates-table.test.tsx
```

Expected: all tests pass (7 existing + 3 new = 10).

Run the full suite to be sure nothing broke elsewhere:

```bash
npx vitest run
```

Expected: all tests pass (count = prior total + 6 new: 3 action + 3 table).

Typecheck:

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/candidates-table.test.tsx src/components/candidates/candidates-table.tsx
git commit -m "feat(candidates): bulk delete with names-listing confirm dialog"
```

---

## Task 4: Hide promoted candidates in page query

**Files:**
- Modify: `src/app/dashboard/candidates/page.tsx`

No new unit test — the file is a server component with `requireUser` + Supabase wiring that's prohibitively expensive to mock for a one-line SQL change. Coverage comes from Task 5 browser verification (promote one candidate → confirm they vanish).

- [ ] **Step 1: Add the filter to the main query**

Open `src/app/dashboard/candidates/page.tsx`. Find the main query block (around lines 29–33):

```ts
  let query = supabase
    .from("course_candidates")
    .select("*, cert_types(name)")
    .eq("manager_id", user.id)
    .order("created_at", { ascending: false });
```

Insert `.neq("status", "הוסמך")` between `.eq("manager_id", user.id)` and `.order(...)`:

```ts
  let query = supabase
    .from("course_candidates")
    .select("*, cert_types(name)")
    .eq("manager_id", user.id)
    .neq("status", "הוסמך")
    .order("created_at", { ascending: false });
```

- [ ] **Step 2: Add the filter to the count query**

Find the count query block (around lines 51–54):

```ts
  let countQuery = supabase
    .from("course_candidates")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", user.id);
```

Add the same `.neq`:

```ts
  let countQuery = supabase
    .from("course_candidates")
    .select("*", { count: "exact", head: true })
    .eq("manager_id", user.id)
    .neq("status", "הוסמך");
```

- [ ] **Step 3: Typecheck + full suite**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: zero TS errors; all tests green.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/candidates/page.tsx
git commit -m "feat(candidates): hide promoted (status=הוסמך) candidates from the list view"
```

---

## Task 5: Browser verify + open PR

**Files:** none (verification + push).

- [ ] **Step 1: Copy `.env.test` into the worktree**

```bash
cp "C:/Users/maor4/OneDrive/Desktop/certimanager/.env.test" .env.test
```

- [ ] **Step 2: Ensure the staging launch entry exists in `.claude/launch.json`**

If `.claude/launch.json` only has the `certimanager` entry, add a `certimanager-staging` entry (port 3005):

```json
{
  "name": "certimanager-staging",
  "runtimeExecutable": "npx",
  "runtimeArgs": ["dotenv", "-e", ".env.test", "--", "next", "dev", "-p", "3005"],
  "port": 3005,
  "autoPort": false
}
```

If port 3005 is already in use by a stale process: `netstat -ano | findstr :3005` → `taskkill //PID <PID> //F`.

- [ ] **Step 3: Start the staging dev server**

Invoke `mcp__Claude_Preview__preview_start` with `name: "certimanager-staging"`. Note the returned `serverId`.

- [ ] **Step 4: Drive Claude-in-Chrome through the verification**

The Preview Chrome cannot reach localhost in this environment — use the Claude-in-Chrome MCP (the pattern established in PR #15 for feedback delete).

1. `mcp__Claude_in_Chrome__tabs_context_mcp` with `createIfEmpty: true` — get tabId.
2. `mcp__Claude_in_Chrome__navigate` to `http://localhost:3005/dashboard/candidates`.
3. `mcp__Claude_in_Chrome__javascript_tool` — verify the page loaded and count rows:

   ```js
   (() => {
     const rows = document.querySelectorAll('tbody tr').length;
     const bulkBar = document.body.innerText.includes('נבחרו');
     return { rowCount: rows, bulkBarVisible: bulkBar };
   })()
   ```

   Expected: some rows. `bulkBarVisible: false` (no selection yet).

4. **Hide-promoted check.** If any row has status `"הוסמך"` showing — the filter isn't working. Evaluate:

   ```js
   Array.from(document.querySelectorAll('select[aria-label^="סטטוס"]')).map(s => s.value).filter(v => v === 'הוסמך').length
   ```

   Expected: `0` — no row should have the `"הוסמך"` status visible on this page.

5. **Bulk-delete flow.** Check two rows' checkboxes. `mcp__Claude_in_Chrome__find` → query: `"checkbox in the first data row"` → `computer.left_click` on its ref. Repeat for second row. Expected: bulk action bar appears with "2 נבחרו", "קדם לעובדים", and **"מחק נבחרים"** buttons.

6. Find and click `מחק נבחרים`. Expected: modal appears with heading `"מחיקת 2 מועמדים"` and both candidate names listed.

7. Find and click `ביטול`. Expected: modal closes, selection preserved (checkboxes still checked), no rows deleted.

8. Click `מחק נבחרים` again → modal re-opens. Click `מחק` (the red confirm button — use `/^מחק$/` regex if searching, anchors matter so it doesn't match `מחיקה`). Expected: modal closes, rows gone, success toast reads `"מחקו 2 מועמדים"`.

9. **Regression — bulk-promote still works.** Select one remaining candidate, click `קדם לעובדים`, click `קדם לעובד` in dialog. Expected: candidate promoted, row disappears from list (because of the new filter), success toast.

- [ ] **Step 5: Stop the preview server + clean up**

```bash
rm .env.test
```

Revert `.claude/launch.json` to the single `certimanager` entry so the commit doesn't drift. Call `mcp__Claude_Preview__preview_stop` with the serverId.

- [ ] **Step 6: Push the branch + open PR**

```bash
git push -u origin feat/candidates-hide-promoted-bulk-delete
```

Open PR with `gh pr create`. Body:

```markdown
## Summary

Two related cleanups to `/dashboard/candidates`:

- **Hide promoted candidates** (user bug #3): server-side `.neq("status", "הוסמך")` filter on the main and count queries. Promoted candidates stay in DB; they just don't appear in the list. Cleaner work queue for the manager.
- **Bulk delete** (user bug #4): new `deleteCandidates(ids)` server action + new `<DeleteDialog>` component mirroring `<PromoteDialog>`. A `מחק נבחרים` button joins `קדם לעובדים` in the bulk action bar. Confirm modal lists every name being deleted so mis-selection is catchable before damage.

Spec: `docs/superpowers/specs/2026-04-20-candidates-hide-promoted-and-bulk-delete.md`
Plan: `docs/superpowers/plans/2026-04-20-candidates-hide-promoted-and-bulk-delete.md`

## No DB migration needed

Existing RLS on `course_candidates` already permits `DELETE` scoped by `manager_id`. Just merge → deploy.

## Verification

- Unit tests: 6 new (3 `deleteCandidates` action cases + 3 bulk-delete table cases). Full suite green, `tsc --noEmit` clean.
- Browser-verified on staging (Claude-in-Chrome round-trip): bulk-select 2 → `מחק נבחרים` → modal lists names → `ביטול` preserves selection → `מחק` confirms → rows gone, toast shows count. Regression: single-row delete and bulk-promote still work. Promoted candidates no longer appear.

## Test plan

- [x] Regression tests cover action (3 cases) + bulk-delete UI (3 cases)
- [x] Manual: staging round-trip verified in browser
- [ ] Post-deploy: promote a test candidate in prod → verify they vanish from list; bulk-delete 2 test candidates → verify both vanish.
```

- [ ] **Step 7: Smoke-test on production after deploy**

User action post-merge: click Deploy in Render → hit `/dashboard/candidates` in prod → promote 1 test candidate → verify they vanish → create 2 test candidates → bulk-delete → verify both vanish.

---

## Post-merge hygiene

- Update memory: note that bugs #3 and #4 are addressed in PR for `feat/candidates-hide-promoted-bulk-delete`. If a "הצג מקודמים" toggle is ever needed, it's a small follow-up on top of this.
- No follow-ups expected beyond that. Bulk-delete + hide-promoted are the full asks.
