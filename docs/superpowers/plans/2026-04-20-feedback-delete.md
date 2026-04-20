# Feedback Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hard-delete for feedback rows — new SQL migration, server action, button component mirroring `MarkReadButton`, and integration on `/dashboard/feedback` desktop table + mobile cards.

**Architecture:** New RLS policy (`FOR DELETE USING manager_id = auth.uid()`) permits deletes scoped to the owner. Server action `deleteFeedback(id)` wraps a `supabase.from("feedback").delete().eq("id", id)` call. Client component `DeleteFeedbackButton` wraps the existing `<DeleteButton>` primitive from `src/components/ui/delete-button.tsx` (which already provides the 2-step "בטוח?" inline confirm). The feedback page renders the new button on every row alongside (or instead of) `<MarkReadButton>`.

**Tech Stack:** Next.js 16 App Router, Supabase SSR client + RLS, vitest + @testing-library/react, pg/Postgres via Supabase SQL editor.

---

## Task 1: Migration SQL + self-heal seed mirror

**Files:**
- Create: `supabase/migration_feedback_delete.sql`
- Modify: `tests/agents/fixtures/seed.sql` (append to the `feedback` block around line 72)

**Why this first:** Server action tests don't hit the DB (Supabase is mocked), but any live browser verification later needs the staging DB to permit deletes. Ship the SQL first, apply to staging before touching code.

- [ ] **Step 1: Create the migration file**

Write exactly:

```sql
-- supabase/migration_feedback_delete.sql
-- Adds DELETE permission to public.feedback, scoped to row owner.
-- Supersedes the v1 "No DELETE policy: audit trail" decision.
-- Idempotent: safe to re-run.

DROP POLICY IF EXISTS feedback_delete_own ON public.feedback;
CREATE POLICY feedback_delete_own ON public.feedback
  FOR DELETE USING (manager_id = auth.uid());
```

- [ ] **Step 2: Mirror the policy into the self-heal seed**

Open `tests/agents/fixtures/seed.sql`. Find the block under `-- From migration_feedback.sql` that defines the three existing feedback policies (lines ~66–71). Append two lines after the `feedback_update_own` policy so that block reads:

```sql
DROP POLICY IF EXISTS feedback_update_own ON feedback;
CREATE POLICY feedback_update_own ON feedback FOR UPDATE USING (manager_id = auth.uid());
DROP POLICY IF EXISTS feedback_delete_own ON feedback;
CREATE POLICY feedback_delete_own ON feedback FOR DELETE USING (manager_id = auth.uid());
```

- [ ] **Step 3: Apply migration to staging Supabase**

The user runs this (Claude cannot and should not touch staging SQL without confirmation). Paste the contents of `supabase/migration_feedback_delete.sql` into the staging Supabase SQL editor. Expected output: `CREATE POLICY` success with no errors.

- [ ] **Step 4: Smoke the policy on staging**

In the staging SQL editor, run:

```sql
SELECT polname FROM pg_policy WHERE polrelid = 'public.feedback'::regclass;
```

Expected: four rows — `feedback_select_own`, `feedback_insert_own`, `feedback_update_own`, `feedback_delete_own`.

- [ ] **Step 5: Commit migration + seed**

```bash
git add supabase/migration_feedback_delete.sql tests/agents/fixtures/seed.sql
git commit -m "feat(db): add feedback delete RLS policy + seed mirror"
```

---

## Task 2: `deleteFeedback` server action (TDD)

**Files:**
- Modify: `src/__tests__/feedback-actions.test.ts` (extend mock + add tests)
- Modify: `src/app/dashboard/feedback/actions.ts` (add export)

- [ ] **Step 1: Extend the shared mock in the test file to spy on `.delete()`**

Open `src/__tests__/feedback-actions.test.ts`. Add a `deleteSpy` alongside the existing `insertSpy` / `updateSpy` / `eqSpy`, and extend `fromSpy`'s return object to expose a `delete()` that records the call and forwards to `eqSpy` (same terminal resolver used by `update`). Reset the new spy in `beforeEach`.

Change the top of the file from:

```ts
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const eqSpy = vi.fn();
const fromSpy = vi.fn((_table: string) => ({
  insert: insertSpy,
  update: (patch: unknown) => {
    updateSpy(patch);
    return { eq: eqSpy };
  },
}));
```

to:

```ts
const insertSpy = vi.fn();
const updateSpy = vi.fn();
const deleteSpy = vi.fn();
const eqSpy = vi.fn();
const fromSpy = vi.fn((_table: string) => ({
  insert: insertSpy,
  update: (patch: unknown) => {
    updateSpy(patch);
    return { eq: eqSpy };
  },
  delete: () => {
    deleteSpy();
    return { eq: eqSpy };
  },
}));
```

And add `deleteSpy.mockReset();` inside `beforeEach` alongside the other resets.

- [ ] **Step 2: Add a failing `describe` block for `deleteFeedback`**

Append at the end of the file (after the `markFeedbackRead` block closes):

```ts
describe("deleteFeedback", () => {
  it("deletes the row scoped by id", async () => {
    const { deleteFeedback } = await import("@/app/dashboard/feedback/actions");
    const result = await deleteFeedback("fb-xyz");
    expect(result).toEqual({ ok: true });
    expect(fromSpy).toHaveBeenCalledWith("feedback");
    expect(deleteSpy).toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith("id", "fb-xyz");
  });

  it("returns an error when Supabase delete fails", async () => {
    eqSpy.mockResolvedValue({ error: { message: "policy violation" } });
    const { deleteFeedback } = await import("@/app/dashboard/feedback/actions");
    const result = await deleteFeedback("fb-xyz");
    expect(result).toEqual({ error: "policy violation" });
  });

  it("rejects empty id without hitting Supabase", async () => {
    const { deleteFeedback } = await import("@/app/dashboard/feedback/actions");
    const result = await deleteFeedback("");
    expect(result).toEqual({ error: expect.any(String) });
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the failing tests**

```bash
npx vitest run src/__tests__/feedback-actions.test.ts
```

Expected: the three new tests fail with `deleteFeedback is not a function` (or similar — action does not exist yet). The six pre-existing tests still pass.

- [ ] **Step 4: Add the minimal implementation**

Open `src/app/dashboard/feedback/actions.ts`. Append after `markFeedbackRead`:

```ts
export async function deleteFeedback(id: string): Promise<ActionResult> {
  if (!id) return { error: "id חסר" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
```

- [ ] **Step 5: Run tests again**

```bash
npx vitest run src/__tests__/feedback-actions.test.ts
```

Expected: all nine tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/feedback-actions.test.ts src/app/dashboard/feedback/actions.ts
git commit -m "feat(feedback): deleteFeedback server action with owner-scoped RLS check"
```

---

## Task 3: `DeleteFeedbackButton` client component (TDD)

**Files:**
- Create: `src/__tests__/delete-feedback-button.test.tsx`
- Create: `src/app/dashboard/feedback/delete-feedback-button.tsx`

The component is a thin wrapper: it wires up a `useTransition` + `router.refresh()` around the existing `<DeleteButton>` primitive. The primitive handles the 2-step "בטוח?" confirm — no new confirm UX needed.

- [ ] **Step 1: Write the failing RTL test**

Create `src/__tests__/delete-feedback-button.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const routerRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: vi.fn() }),
}));

const deleteFeedback = vi.fn();
vi.mock("@/app/dashboard/feedback/actions", () => ({
  deleteFeedback: (...args: unknown[]) => deleteFeedback(...args),
}));

import { DeleteFeedbackButton } from "@/app/dashboard/feedback/delete-feedback-button";

describe("DeleteFeedbackButton", () => {
  beforeEach(() => {
    routerRefresh.mockReset();
    deleteFeedback.mockReset();
    deleteFeedback.mockResolvedValue({ ok: true });
  });

  it("starts showing only the מחיקה trigger, not the confirm prompt", () => {
    render(<DeleteFeedbackButton id="fb-1" />);
    expect(screen.getByRole("button", { name: /מחיקה/ })).toBeInTheDocument();
    expect(screen.queryByText("בטוח?")).not.toBeInTheDocument();
  });

  it("shows 'בטוח?' and a מחק confirm after first click", () => {
    render(<DeleteFeedbackButton id="fb-1" />);
    fireEvent.click(screen.getByRole("button", { name: /מחיקה/ }));
    expect(screen.getByText("בטוח?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^מחק$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ביטול/ })).toBeInTheDocument();
  });

  it("ביטול restores the initial state without calling deleteFeedback", () => {
    render(<DeleteFeedbackButton id="fb-1" />);
    fireEvent.click(screen.getByRole("button", { name: /מחיקה/ }));
    fireEvent.click(screen.getByRole("button", { name: /ביטול/ }));
    expect(screen.queryByText("בטוח?")).not.toBeInTheDocument();
    expect(deleteFeedback).not.toHaveBeenCalled();
  });

  it("confirming calls deleteFeedback with the id and refreshes the router", async () => {
    render(<DeleteFeedbackButton id="fb-xyz" />);
    fireEvent.click(screen.getByRole("button", { name: /מחיקה/ }));
    fireEvent.click(screen.getByRole("button", { name: /^מחק$/ }));
    await waitFor(() => expect(deleteFeedback).toHaveBeenCalledWith("fb-xyz"));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npx vitest run src/__tests__/delete-feedback-button.test.tsx
```

Expected: fails — module `@/app/dashboard/feedback/delete-feedback-button` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/dashboard/feedback/delete-feedback-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "@/components/ui/delete-button";
import { deleteFeedback } from "./actions";

export function DeleteFeedbackButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <DeleteButton
      action={async () => {
        await deleteFeedback(id);
        router.refresh();
      }}
    />
  );
}
```

Note: `<DeleteButton>` renders its confirm button inside a `<form>` and uses `useFormStatus` for the pending spinner, so we don't need `useTransition` here. `router.refresh()` re-runs the server component after the delete lands.

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/delete-feedback-button.test.tsx
```

Expected: all four tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/delete-feedback-button.test.tsx src/app/dashboard/feedback/delete-feedback-button.tsx
git commit -m "feat(feedback): DeleteFeedbackButton component wrapping existing DeleteButton primitive"
```

---

## Task 4: Render the button on every row (desktop + mobile)

**Files:**
- Modify: `src/app/dashboard/feedback/page.tsx`

- [ ] **Step 1: Import the new component**

At the top of the file, below the existing `MarkReadButton` import:

```tsx
import { MarkReadButton } from "./mark-read-button";
import { DeleteFeedbackButton } from "./delete-feedback-button";
```

- [ ] **Step 2: Update the desktop table action cell**

Find the `<td>` in the desktop table that currently renders the mark-read button (around line 123–125):

```tsx
<td className="px-4 py-4">
  {!row.is_read && <MarkReadButton id={row.id} />}
</td>
```

Replace with:

```tsx
<td className="px-4 py-4">
  <div className="flex items-center gap-2">
    {!row.is_read && <MarkReadButton id={row.id} />}
    <DeleteFeedbackButton id={row.id} />
  </div>
</td>
```

- [ ] **Step 3: Update the mobile card action area**

Find the mobile card's tail (around line 160):

```tsx
<p className="text-xs text-muted-foreground font-mono" dir="ltr">{row.route}</p>
{!row.is_read && <MarkReadButton id={row.id} />}
```

Replace with:

```tsx
<p className="text-xs text-muted-foreground font-mono" dir="ltr">{row.route}</p>
<div className="flex items-center gap-3 pt-2">
  {!row.is_read && <MarkReadButton id={row.id} />}
  <DeleteFeedbackButton id={row.id} />
</div>
```

- [ ] **Step 4: Typecheck + full test suite**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: zero TS errors; all tests green (count grew by 7: 3 action tests + 4 component tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/feedback/page.tsx
git commit -m "feat(feedback): render DeleteFeedbackButton on every row (desktop + mobile)"
```

---

## Task 5: Browser verify on staging + open PR

**Files:** none (verification + push).

- [ ] **Step 1: Copy `.env.test` into the worktree**

```bash
cp "C:/Users/maor4/OneDrive/Desktop/certimanager/.env.test" .env.test
```

- [ ] **Step 2: Confirm a Claude Preview launch config for staging exists**

Check `.claude/launch.json`. If it has no `certimanager-staging` entry on port 3005, add one:

```json
{
  "name": "certimanager-staging",
  "runtimeExecutable": "npx",
  "runtimeArgs": ["dotenv", "-e", ".env.test", "--", "next", "dev", "-p", "3005"],
  "port": 3005,
  "autoPort": false
}
```

- [ ] **Step 3: Start the staging dev server via `preview_start`**

Invoke the `mcp__Claude_Preview__preview_start` tool with `name: "certimanager-staging"`. Note the returned `serverId`.

If port 3005 is in use by a stale process, find the PID with `netstat -ano | findstr :3005` and `taskkill //PID <PID> //F`.

- [ ] **Step 4: Drive Claude-in-Chrome through the verification**

The Preview Chrome cannot reach localhost in this environment — use the Claude-in-Chrome MCP instead (see PR #14 commit for precedent).

1. `mcp__Claude_in_Chrome__tabs_context_mcp` with `createIfEmpty: true` → get tabId.
2. `mcp__Claude_in_Chrome__navigate` to `http://localhost:3005/dashboard/feedback`.
3. `mcp__Claude_in_Chrome__read_page` with `filter: "interactive"` — confirm `מחיקה` button visible on every row.
4. Click the `דווח` header button, fill category=`אחר` and description=`delete-verification test row` (unique string so you can find the row later), submit.
5. Reload `/dashboard/feedback`, confirm the new row appears.
6. Use `mcp__Claude_in_Chrome__find` with query `"delete button in the row that says delete-verification test row"` to get a ref. Click it. Then `find` the `מחק` confirm button and click it. Expected: row disappears after refresh.
7. `read_page` again — confirm the row is gone.

- [ ] **Step 5: Verify RLS on staging directly (optional but strong)**

In the staging Supabase SQL editor, run:

```sql
SELECT count(*) FROM feedback WHERE description = 'delete-verification test row';
```

Expected: 0.

- [ ] **Step 6: Stop the preview server + clean `.env.test`**

```bash
rm .env.test
```

And call `mcp__Claude_Preview__preview_stop` with the serverId from Step 3. If `.claude/launch.json` was modified for the staging entry, revert it to the single-config form so the commit doesn't drift.

- [ ] **Step 7: Push the branch + open PR**

```bash
git push -u origin feat/feedback-delete
```

Then open PR with `gh pr create`. Body must include:

- Summary: delete-reports addendum implemented (hard-delete, single-row, reuse `<DeleteButton>` primitive).
- Verification: unit tests (7 new), typecheck, browser-verified on staging with a submit → delete round-trip.
- **Migration checklist** (critical — user must action):
  - [ ] Run `supabase/migration_feedback_delete.sql` in **staging** Supabase before reviewing. **Already done per Task 1 Step 3.**
  - [ ] Run the same SQL in **production** Supabase before clicking Deploy in Render.
  - [ ] Post-deploy: verify on prod by submitting a test report and deleting it.

---

## Post-merge hygiene

- Update memory — note that PR #13's v1 spec is now superseded by the delete addendum (file path + one-liner).
- No follow-up backlog items expected from this PR. Multi-select bulk-delete on feedback stays deferred until the cross-tab multi-select primitive lands.
