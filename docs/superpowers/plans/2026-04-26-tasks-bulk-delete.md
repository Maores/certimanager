# משימות (Tasks) Bulk Delete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multi-row selection and bulk delete on `/dashboard/tasks`, mirroring the pattern already shipped for certifications in PR #21 (and earlier for candidates in PR #16). Bundle two cross-cutting cleanups: Hebrew singular-grammar fix and a `CertRow` type relocation.

**Architecture:** Add selection state (`Set<string>`), a select-all + per-row checkbox column, a "{N} נבחרו" bulk-action bar, and `DeleteDialog` integration inside the existing `tasks-client.tsx` (already a `"use client"` component — no page refactor needed). Add a new `deleteTasks(ids[])` server action that mirrors `deleteCertifications` (per-id ownership check via `employees!inner(manager_id)` join, accumulates errors, returns `{ deleted, errors }`) but without storage-cleanup (tasks have no attachments). Tasks page already short-circuits in guest mode, so `tasks-client.tsx` does **not** need an `isGuest` prop.

**Tech Stack:** Next.js (server actions), Supabase, React 18, vitest + @testing-library/react, Tailwind, Hebrew/RTL UI, Claude-in-Chrome MCP for browser verification.

---

## Reference: PR #21 (certifications bulk delete) is the template

Before writing any code in this plan, the engineer should skim:
- [`src/app/dashboard/certifications/actions.ts:386-453`](../../../src/app/dashboard/certifications/actions.ts) — `deleteCertifications` shape to mirror.
- [`src/components/certifications/certifications-list.tsx`](../../../src/components/certifications/certifications-list.tsx) — selection logic, banner pattern, dialog wiring.
- [`src/__tests__/certifications-delete-actions.test.ts`](../../../src/__tests__/certifications-delete-actions.test.ts) — server-action mock structure to mirror.
- [`src/__tests__/certifications-list.test.tsx`](../../../src/__tests__/certifications-list.test.tsx) — component test patterns.

---

## File structure

**New files:**
- `src/__tests__/tasks-delete-actions.test.ts` — server-action unit tests for `deleteTasks`.
- `src/__tests__/tasks-client-bulk.test.tsx` — component tests for the bulk-selection UI.

**Modified files:**
- `src/app/dashboard/tasks/actions.ts` — add `deleteTasks(ids: string[])` export. Existing `createTask` / `updateTaskStatus` / `deleteTask` unchanged.
- `src/app/dashboard/tasks/tasks-client.tsx` — add selection state, success banner, bulk bar, checkbox column (desktop + mobile), `DeleteDialog`. Existing single-row delete + status select unchanged.
- `src/types/database.ts` — accept relocated `CertRow` interface (cross-cutting cleanup #1).
- `src/components/certifications/certifications-list.tsx` — import `CertRow` from `@/types/database` instead of defining locally; ternary success/error copy for singular grammar (cross-cutting cleanup #2).
- `src/__tests__/certifications-list.test.tsx` — update test type-import + N=1 regex for new singular copy (cross-cutting cleanup #2).
- `src/components/candidates/candidates-table.tsx` — fix existing typo (`מחקו` → `נמחקו`) + ternary singular grammar.
- `src/__tests__/candidates-table.test.tsx` — update success-banner regex for fixed typo + (where applicable) singular form.

---

## Cross-cutting cleanup justifications

**Why bundle in this PR:**

1. **`CertRow` move:** PR #21's reviewer feedback / queue item requires this. The interface is a row shape used in multiple places (component, test, and now potentially other components). Lives at component level only because PR #21 didn't extract it. One-time mechanical move — cheap to do here while we're touching the surrounding files.
2. **Singular grammar:** today, deleting one cert/task/candidate prints "נמחקו 1 הסמכות" (literally "1 certifications were deleted") — grammatically wrong in Hebrew. Should be "נמחקה הסמכה אחת" / "נמחקה משימה אחת" / "נמחק מועמד אחד". Tasks need this from day one (PR 2 introduces the tasks bulk-delete success path), so doing certs + candidates in the same commit keeps copy consistent across all three list views. There is also an existing typo in `candidates-table.tsx:142` (`מחקו` is missing the `נ`) that gets fixed for free.

**Out of scope (intentional):**
- The "{N} נבחרו" selection-count label: also wrong for N=1 (`1 נבחרו` should be `נבחרה אחת`), but it appears in 3 places, would require its own grammar pattern, and is much lower-impact than the post-action success banner. Leaving as a follow-up. Document in the session handoff at the end.

---

## Task 1: Move `CertRow` interface to `src/types/database.ts`

Pure refactor — no behavior change.

**Files:**
- Modify: `src/types/database.ts` (add export)
- Modify: `src/components/certifications/certifications-list.tsx` (import instead of define)
- Modify: `src/__tests__/certifications-list.test.tsx` (import instead of define inline `type CertRow`)

- [ ] **Step 1.1: Add `CertRow` export to `src/types/database.ts`**

Add to the bottom of the file (after `daysUntilExpiry`):

```ts
export interface CertRow {
  id: string;
  employee_name: string;
  employee_department: string;
  cert_type_id: string;
  cert_type_name: string;
  issue_date: string | null;
  expiry_date: string | null;
  next_refresh_date: string | null;
  image_url: string | null;
  status: CertStatus;
}
```

- [ ] **Step 1.2: In `src/components/certifications/certifications-list.tsx`**

Replace lines 28-39 (the `export interface CertRow { ... }` block) with nothing, and update the imports at the top.

Before:
```ts
import type { CertStatus } from "@/types/database";
import { formatDateHe } from "@/types/database";
```

After:
```ts
import type { CertStatus, CertRow } from "@/types/database";
import { formatDateHe } from "@/types/database";
```

(And delete the local `export interface CertRow { ... }` block — lines 28-39.)

- [ ] **Step 1.3: In `src/__tests__/certifications-list.test.tsx`**

Replace lines 4 + 18-29 (the `import type { CertStatus }` and the inline `type CertRow = { ... }`) with a shared import:

Before:
```ts
import type { CertStatus } from "@/types/database";
// ...
type CertRow = {
  id: string;
  // ...
  status: CertStatus;
};
```

After:
```ts
import type { CertRow } from "@/types/database";
```

(Delete the local `type CertRow = { ... }` block.)

- [ ] **Step 1.4: Type-check**

Run: `npx tsc --noEmit`
Expected: passes (no TS errors).

- [ ] **Step 1.5: Run cert tests**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**' src/__tests__/certifications-list.test.tsx src/__tests__/certifications-delete-actions.test.ts`
Expected: PASS (all 13 tests still green — pure refactor).

- [ ] **Step 1.6: Commit**

```bash
git add src/types/database.ts src/components/certifications/certifications-list.tsx src/__tests__/certifications-list.test.tsx
git commit -m "refactor(certifications): move CertRow interface to src/types/database.ts"
```

---

## Task 2: Hebrew singular-grammar fix (certifications + candidates)

Tasks itself doesn't need updating yet (the bulk-delete copy doesn't exist there until Task 6). Doing it now means Task 6 can write the correct copy from the start.

**Approach:** ternary inline in each component. No shared helper — three call sites with three different nouns is below the DRY threshold.

**Files:**
- Modify: `src/components/certifications/certifications-list.tsx` (success + error copy)
- Modify: `src/components/candidates/candidates-table.tsx` (success + error copy + typo fix)
- Modify: `src/__tests__/certifications-list.test.tsx` (N=1 regex)
- Modify: `src/__tests__/candidates-table.test.tsx` (success regex)

### 2A. Update test expectations to assert the new copy (TDD red)

- [ ] **Step 2.1: Update `src/__tests__/certifications-list.test.tsx:285`**

The test "partial failure surfaces an error banner AND keeps failed rows selected for retry" feeds `{ deleted: 1, errors: ["b: permission denied"] }`. Currently asserts `/נמחקו 1/`. After the fix, the error banner will read `"נמחקה הסמכה אחת. שגיאות: b: permission denied"`.

Before:
```ts
await waitFor(() => {
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(/נמחקו 1/);
  expect(alert).toHaveTextContent(/permission denied/);
});
```

After:
```ts
await waitFor(() => {
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(/נמחקה הסמכה אחת/);
  expect(alert).toHaveTextContent(/permission denied/);
});
```

(The other regexes in this file — `/נמחקו 2 הסמכות/` at line 227, `/מחיקת 2 הסמכות/` at line 195 — are correct for N=2 and need no change.)

- [ ] **Step 2.2: Update `src/__tests__/candidates-table.test.tsx:220`**

Currently asserts `/מחקו 2 מועמדים/` (matching the typo in the source). After the source typo is fixed, the assertion should read the corrected word.

Before:
```ts
await waitFor(() => {
  expect(screen.getByRole("status")).toHaveTextContent(/מחקו 2 מועמדים/);
});
```

After:
```ts
await waitFor(() => {
  expect(screen.getByRole("status")).toHaveTextContent(/נמחקו 2 מועמדים/);
});
```

(N=2 path stays plural — no singular change for this particular test. Singular candidates path is not currently tested; we will add it implicitly when handed to the next reviewer, but not in this PR — keep scope tight.)

- [ ] **Step 2.3: Run failing tests**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**' src/__tests__/certifications-list.test.tsx src/__tests__/candidates-table.test.tsx`
Expected: 2 tests FAIL (the partial-failure test in cert-list, the success test in candidates).

### 2B. Make the tests pass (green)

- [ ] **Step 2.4: Update `src/components/certifications/certifications-list.tsx:97-107` `handleConfirmDelete`**

Replace the success/error message construction:

Before (lines 97-107):
```ts
if (result.errors.length > 0) {
  setError(`נמחקו ${result.deleted}. שגיאות: ${result.errors.join(", ")}`);
  // Per spec: failing rows remain selected so the user can retry.
  // Errors format is "${id}: message" — recover the failed ids by splitting on the first ":".
  const failedIds = new Set(
    result.errors.map((e) => e.slice(0, e.indexOf(":")).trim())
  );
  setSelected(failedIds);
} else {
  setSuccess(`נמחקו ${result.deleted} הסמכות`);
  setSelected(new Set());
}
```

After:
```ts
const headline =
  result.deleted === 1
    ? "נמחקה הסמכה אחת"
    : `נמחקו ${result.deleted} הסמכות`;
if (result.errors.length > 0) {
  setError(`${headline}. שגיאות: ${result.errors.join(", ")}`);
  // Per spec: failing rows remain selected so the user can retry.
  // Errors format is "${id}: message" — recover the failed ids by splitting on the first ":".
  const failedIds = new Set(
    result.errors.map((e) => e.slice(0, e.indexOf(":")).trim())
  );
  setSelected(failedIds);
} else {
  setSuccess(headline);
  setSelected(new Set());
}
```

- [ ] **Step 2.5: Update `src/components/candidates/candidates-table.tsx:138-143` `handleConfirmDelete`**

Apply the same shape, with the candidates noun (`מועמד` masc) and fix the typo. Note `נמחק` (no `ה` suffix) for masculine singular.

Before (lines 138-143):
```ts
const result = await deleteCandidates(deleteDialog.ids);
if (result.errors.length > 0) {
  setError(`נמחקו ${result.deleted} מועמדים. שגיאות: ${result.errors.join(", ")}`);
} else {
  setSuccess(`מחקו ${result.deleted} מועמדים`);
}
```

After:
```ts
const result = await deleteCandidates(deleteDialog.ids);
const headline =
  result.deleted === 1
    ? "נמחק מועמד אחד"
    : `נמחקו ${result.deleted} מועמדים`;
if (result.errors.length > 0) {
  setError(`${headline}. שגיאות: ${result.errors.join(", ")}`);
} else {
  setSuccess(headline);
}
```

- [ ] **Step 2.6: Run tests, all pass**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**' src/__tests__/certifications-list.test.tsx src/__tests__/candidates-table.test.tsx`
Expected: PASS (all tests in both files green).

- [ ] **Step 2.7: Commit**

```bash
git add src/components/certifications/certifications-list.tsx src/components/candidates/candidates-table.tsx src/__tests__/certifications-list.test.tsx src/__tests__/candidates-table.test.tsx
git commit -m "fix(copy): correct Hebrew singular grammar for bulk-delete success/error banners

- N=1 path now uses singular form (נמחקה הסמכה אחת / נמחק מועמד אחד)
- Fixes existing typo מחקו → נמחקו in candidates success copy
- Aligns copy across certifications and candidates in preparation for tasks (PR 2)"
```

---

## Task 3: Failing tests for `deleteTasks` server action (TDD red)

Mirror `src/__tests__/certifications-delete-actions.test.ts` structure. Tasks have no `image_url` / storage cleanup, so storage assertions are dropped.

**Files:**
- Create: `src/__tests__/tasks-delete-actions.test.ts`

- [ ] **Step 3.1: Create the test file**

Create `src/__tests__/tasks-delete-actions.test.ts` with this content:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ------------------------------------------------------------
const selectSingleSpy = vi.fn();
const deleteEqSpy = vi.fn();
const getGuestSessionIdSpy = vi.fn();

const fromSpy = vi.fn((_table: string) => ({
  select: (_cols: string) => ({
    eq: (_col: string, _val: string) => ({
      single: selectSingleSpy,
    }),
  }),
  delete: () => ({
    eq: (col: string, val: string) => deleteEqSpy(col, val),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: fromSpy,
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  })),
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: (...args: unknown[]) => getGuestSessionIdSpy(...args),
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
  selectSingleSpy.mockReset();
  deleteEqSpy.mockReset();
  getGuestSessionIdSpy.mockReset();
  getGuestSessionIdSpy.mockResolvedValue(null);
  fromSpy.mockClear();
  vi.resetModules();
});

// Helpers ----------------------------------------------------------
function makeOwnedTask(overrides: Partial<{ id: string }> = {}) {
  return {
    data: {
      id: overrides.id ?? "task-1",
      employees: { manager_id: "user-1" },
    },
    error: null,
  };
}

// Tests ------------------------------------------------------------
describe("deleteTasks", () => {
  it("deletes each owned task and returns the count", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedTask({ id: "t1" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t2" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t3" }));
    deleteEqSpy.mockResolvedValue({ error: null });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1", "t2", "t3"]);

    expect(result).toEqual({ deleted: 3, errors: [] });
    expect(deleteEqSpy).toHaveBeenCalledTimes(3);
    expect(deleteEqSpy).toHaveBeenNthCalledWith(1, "id", "t1");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(2, "id", "t2");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(3, "id", "t3");
  });

  it("treats a cross-manager task id as silent no-op (counts as deleted)", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { id: "t1", employees: { manager_id: "other-user" } },
      error: null,
    });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1"]);

    // No data leak, no error surfaced; counted as deleted per spec
    expect(result).toEqual({ deleted: 1, errors: [] });
    expect(deleteEqSpy).not.toHaveBeenCalled();
  });

  it("treats a missing task id as silent no-op (counts as deleted)", async () => {
    selectSingleSpy.mockResolvedValueOnce({ data: null, error: null });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t-missing"]);

    expect(result).toEqual({ deleted: 1, errors: [] });
    expect(deleteEqSpy).not.toHaveBeenCalled();
  });

  it("records partial failures and keeps going", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedTask({ id: "t1" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t2" }))
      .mockResolvedValueOnce(makeOwnedTask({ id: "t3" }));
    deleteEqSpy
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "permission denied" } })
      .mockResolvedValueOnce({ error: null });

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1", "t2", "t3"]);

    expect(result.deleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("t2");
  });

  it("returns zero deleted on empty array without hitting Supabase", async () => {
    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks([]);

    expect(result).toEqual({ deleted: 0, errors: [] });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(selectSingleSpy).not.toHaveBeenCalled();
  });

  it("refuses in guest mode with a helpful error message", async () => {
    getGuestSessionIdSpy.mockResolvedValue("guest-123");

    const { deleteTasks } = await import("@/app/dashboard/tasks/actions");
    const result = await deleteTasks(["t1"]);

    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/אורח/);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3.2: Run failing tests**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**' src/__tests__/tasks-delete-actions.test.ts`
Expected: FAIL — `deleteTasks` not exported from `@/app/dashboard/tasks/actions` (all 6 tests fail at the dynamic import).

---

## Task 4: Implement `deleteTasks` (TDD green)

**Files:**
- Modify: `src/app/dashboard/tasks/actions.ts` (append new export)

- [ ] **Step 4.1: Append `deleteTasks` to `src/app/dashboard/tasks/actions.ts`**

After the existing `deleteTask` function (after line 153), append:

```ts
export async function deleteTasks(ids: string[]): Promise<{
  deleted: number;
  errors: string[];
}> {
  const result = { deleted: 0, errors: [] as string[] };
  if (!Array.isArray(ids) || ids.length === 0) return result;

  const guestSid = await getGuestSessionId();
  if (guestSid) {
    return {
      deleted: 0,
      errors: ["משימות אינן זמינות במצב אורח"],
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  for (const id of ids) {
    const { data: task } = await supabase
      .from("employee_tasks")
      .select("id, employees!inner(manager_id)")
      .eq("id", id)
      .single();

    // Missing row OR cross-manager row: silent no-op per spec.
    // Count as deleted because the end state (row inaccessible to this user) is correct.
    const managerId =
      task && (task.employees as unknown as { manager_id: string } | null)?.manager_id;
    if (!task || managerId !== user.id) {
      result.deleted++;
      continue;
    }

    const { error } = await supabase
      .from("employee_tasks")
      .delete()
      .eq("id", id);

    if (error) {
      result.errors.push(`${id}: שגיאה במחיקה`);
      continue;
    }

    result.deleted++;
  }

  revalidatePath("/dashboard/tasks");
  return result;
}
```

- [ ] **Step 4.2: Run tests, all pass**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**' src/__tests__/tasks-delete-actions.test.ts`
Expected: PASS (all 6 tests green).

- [ ] **Step 4.3: Commit**

```bash
git add src/app/dashboard/tasks/actions.ts src/__tests__/tasks-delete-actions.test.ts
git commit -m "feat(tasks): add deleteTasks server action with per-id ownership check

Mirrors deleteCertifications: returns { deleted, errors }, treats cross-manager
and missing rows as silent no-ops, records per-id error messages on partial
failure, refuses in guest mode."
```

---

## Task 5: Failing tests for `tasks-client` bulk UI (TDD red)

Mirror `src/__tests__/certifications-list.test.tsx` structure. Differences:
- Tasks don't render desktop and mobile via `hidden md:block` — they use Tailwind's `hidden sm:block` / `sm:hidden` (see `tasks-client.tsx:302` + `:379`). Same jsdom problem (per-row labels appear twice). Use `data-testid="tasks-desktop"` / `data-testid="tasks-mobile"` to scope.
- TasksClient props are richer than CertificationsList's. Tests must supply realistic minimal values.

**Files:**
- Create: `src/__tests__/tasks-client-bulk.test.tsx`

- [ ] **Step 5.1: Add `data-testid` attributes to `tasks-client.tsx`**

To make the tests scope-able, the desktop and mobile containers need testids (this is the only behavior change before Task 6). The certifications equivalent already does this (`data-testid="certs-desktop"`).

In `src/app/dashboard/tasks/tasks-client.tsx`:

Find line 302:
```tsx
<div className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-white"
```

Change to:
```tsx
<div
  data-testid="tasks-desktop"
  className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-white"
```

Find line 379:
```tsx
<div className="sm:hidden space-y-3">
```

Change to:
```tsx
<div data-testid="tasks-mobile" className="sm:hidden space-y-3">
```

(These two cosmetic changes ship together with Task 6's behavioral changes; the test file in Task 5 references the testids before they are committed, so we DO need to make these two edits before running the tests. Add the edits now and they'll be part of the same diff that Task 6 commits.)

- [ ] **Step 5.2: Create `src/__tests__/tasks-client-bulk.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const deleteTasks = vi.fn();
const updateTaskStatus = vi.fn();
const deleteTask = vi.fn();
const createTask = vi.fn();
vi.mock("@/app/dashboard/tasks/actions", () => ({
  deleteTasks: (...args: unknown[]) => deleteTasks(...args),
  updateTaskStatus: (...args: unknown[]) => updateTaskStatus(...args),
  deleteTask: (...args: unknown[]) => deleteTask(...args),
  createTask: (...args: unknown[]) => createTask(...args),
}));

import { TasksClient } from "@/app/dashboard/tasks/tasks-client";

type Task = {
  id: string;
  employee_id: string;
  description: string;
  responsible: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  employee_name: string;
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    employee_id: "emp-1",
    description: "החלף שמן",
    responsible: null,
    status: "פתוח",
    created_at: "2026-04-20T08:00:00Z",
    updated_at: "2026-04-20T08:00:00Z",
    employee_name: "דנה כהן",
    ...overrides,
  };
}

const baseProps = {
  employees: [{ id: "emp-1", name: "דנה כהן" }],
  responsibleList: [],
  counts: { "פתוח": 0, "בטיפול": 0, "הושלם": 0 },
  statusFilter: "",
  responsibleFilter: "",
};

// jsdom renders both desktop and mobile views regardless of the Tailwind
// breakpoint (CSS-only), so per-row checkboxes appear twice. Scope queries
// to the desktop view; browser verification (Task 8) covers mobile visually.
function desktop() {
  return within(screen.getByTestId("tasks-desktop"));
}

describe("TasksClient — selection UI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a checkbox for each row and a select-all in the table header", () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר הכל/ })
    ).toBeInTheDocument();
  });

  it("select-all toggles all rows", () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    const selectAll = desktop().getByRole("checkbox", { name: /בחר הכל/ });
    fireEvent.click(selectAll);
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeChecked();

    fireEvent.click(selectAll);
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).not.toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).not.toBeChecked();
  });

  it("hides the bulk action bar when nothing is selected", () => {
    render(<TasksClient {...baseProps} tasks={[makeTask()]} />);
    expect(
      screen.queryByRole("button", { name: /מחק נבחרים/ })
    ).not.toBeInTheDocument();
  });

  it("shows the bulk action bar with count when at least one row is selected", () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    expect(screen.getByText(/1 נבחרו/)).toBeInTheDocument();
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    expect(screen.getByText(/2 נבחרו/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /מחק נבחרים/ })
    ).toBeInTheDocument();
  });
});

describe("TasksClient — bulk delete flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking 'מחק נבחרים' opens the dialog with selected names listed", async () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן", description: "החלף שמן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי", description: "ביטוח רכב" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));

    const dialog = await screen.findByRole("dialog", {
      name: /מחיקת 2 משימות/,
    });
    expect(within(dialog).getByText(/דנה כהן.*החלף שמן/)).toBeInTheDocument();
    expect(within(dialog).getByText(/יוסי לוי.*ביטוח רכב/)).toBeInTheDocument();
  });

  it("confirm calls deleteTasks with selected ids and shows success", async () => {
    deleteTasks.mockResolvedValue({ deleted: 2, errors: [] });

    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^מחק$/ }));

    await waitFor(() => {
      expect(deleteTasks).toHaveBeenCalledWith(["a", "b"]);
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/נמחקו 2 משימות/);
    });
  });

  it("cancel closes the dialog without calling deleteTasks; selection preserved", async () => {
    render(
      <TasksClient
        {...baseProps}
        tasks={[makeTask({ id: "a", employee_name: "דנה כהן" })]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^ביטול$/ }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /מחיקת/ })
      ).not.toBeInTheDocument();
    });
    expect(deleteTasks).not.toHaveBeenCalled();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
  });

  it("partial failure surfaces an error banner AND keeps failed rows selected for retry", async () => {
    deleteTasks.mockResolvedValue({
      deleted: 1,
      errors: ["b: שגיאה במחיקה"],
    });

    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^מחק$/ }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/נמחקה משימה אחת/);
      expect(alert).toHaveTextContent(/שגיאה במחיקה/);
    });

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).not.toBeChecked();
  });

  it("thrown error preserves selection and shows the error banner", async () => {
    deleteTasks.mockRejectedValue(new Error("network boom"));

    render(
      <TasksClient
        {...baseProps}
        tasks={[
          makeTask({ id: "a", employee_name: "דנה כהן" }),
          makeTask({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^מחק$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/network boom/);
    });
    expect(
      screen.queryByRole("heading", { name: /מחיקת/ })
    ).not.toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeChecked();
  });
});
```

- [ ] **Step 5.3: Run failing tests**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**' src/__tests__/tasks-client-bulk.test.tsx`
Expected: FAIL — selection UI doesn't exist yet (no checkboxes, no bulk bar, no dialog wiring).

---

## Task 6: Implement bulk-selection UI in `tasks-client.tsx` (TDD green)

**Files:**
- Modify: `src/app/dashboard/tasks/tasks-client.tsx`

This is the largest single edit. The existing file structure stays intact — we layer on top.

- [ ] **Step 6.1: Update imports at the top of the file**

Replace lines 1-15 (`"use client"` through the `import { AutoSubmitSelect } ...`) with:

```tsx
"use client";

import { useTransition, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Plus,
  Trash2,
  X,
  CircleDot,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { createTask, updateTaskStatus, deleteTask, deleteTasks } from "./actions";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { DeleteDialog } from "@/components/ui/delete-dialog";
```

(Adds `useCallback`, `useEffect`, `deleteTasks`, `DeleteDialog`. Removes nothing.)

- [ ] **Step 6.2: Add a `taskLabel` helper above the component**

Just before `export function TasksClient(...)` (after line 84, after `StatusBadge`), add:

```tsx
function taskLabel(t: Pick<Task, "employee_name" | "description">): string {
  const desc = t.description.length > 40 ? `${t.description.slice(0, 40)}…` : t.description;
  return `${t.employee_name} — ${desc}`;
}
```

- [ ] **Step 6.3: Add new state and handlers inside `TasksClient`**

After the existing state lines (94-97 — `showForm`, `isPending`, `error`, `router`), insert:

```tsx
const [success, setSuccess] = useState<string | null>(null);
const [selected, setSelected] = useState<Set<string>>(new Set());
const [deleteDialog, setDeleteDialog] = useState<{
  open: boolean;
  ids: string[];
  names: string[];
}>({ open: false, ids: [], names: [] });

useEffect(() => {
  if (!success) return;
  const t = setTimeout(() => setSuccess(null), 7000);
  return () => clearTimeout(t);
}, [success]);

const toggleSelect = useCallback((id: string) => {
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}, []);

const toggleAll = useCallback(() => {
  setSelected((prev) => {
    if (prev.size === tasks.length) return new Set();
    return new Set(tasks.map((t) => t.id));
  });
}, [tasks]);

function handleBulkDelete() {
  const ids = Array.from(selected);
  const names = ids.map((id) => {
    const t = tasks.find((tt) => tt.id === id);
    return t ? taskLabel(t) : id;
  });
  setDeleteDialog({ open: true, ids, names });
}

async function handleConfirmDelete() {
  setError(null);
  setSuccess(null);
  try {
    const result = await deleteTasks(deleteDialog.ids);
    const headline =
      result.deleted === 1
        ? "נמחקה משימה אחת"
        : `נמחקו ${result.deleted} משימות`;
    if (result.errors.length > 0) {
      setError(`${headline}. שגיאות: ${result.errors.join(", ")}`);
      const failedIds = new Set(
        result.errors.map((e) => e.slice(0, e.indexOf(":")).trim())
      );
      setSelected(failedIds);
    } else {
      setSuccess(headline);
      setSelected(new Set());
    }
    setDeleteDialog({ open: false, ids: [], names: [] });
    router.refresh();
  } catch (e) {
    setError(e instanceof Error ? e.message : "שגיאה במחיקה");
    setDeleteDialog({ open: false, ids: [], names: [] });
  }
}
```

- [ ] **Step 6.4: Add success banner + bulk action bar JSX**

Inside the returned `<div className="space-y-6">`, immediately AFTER the existing `{error && (...)}` block (currently lines 185-189), insert:

```tsx
{success && (
  <div
    role="status"
    className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-3"
  >
    <span>{success}</span>
    <button
      type="button"
      onClick={() => setSuccess(null)}
      aria-label="סגור"
      className="rounded p-0.5 text-green-600 hover:bg-green-100 cursor-pointer"
    >
      ✕
    </button>
  </div>
)}

{selected.size > 0 && (
  <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm">
    <span className="font-medium text-blue-800">{selected.size} נבחרו</span>
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

(Note: deliberately no top/bottom margin on the banners — the parent's `space-y-6` handles spacing, matching how the existing error banner sits.)

- [ ] **Step 6.5: Add select-all checkbox to the desktop table header**

In the `<thead>`'s `<tr>` (currently lines 308-327), add a NEW first `<th>` before the existing `עובד` column header:

```tsx
<th scope="col" className="w-10 px-3 py-3">
  <input
    type="checkbox"
    aria-label="בחר הכל"
    checked={tasks.length > 0 && selected.size === tasks.length}
    onChange={toggleAll}
    className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
  />
</th>
```

- [ ] **Step 6.6: Add per-row checkbox to each desktop body row**

In the `tasks.map((task) => ...)` block (currently lines 330-373), add a NEW first `<td>` before the existing `task.employee_name` cell:

```tsx
<td className="w-10 px-3 py-3">
  <input
    type="checkbox"
    aria-label={`בחר ${taskLabel(task)}`}
    checked={selected.has(task.id)}
    onChange={() => toggleSelect(task.id)}
    className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
  />
</td>
```

- [ ] **Step 6.7: Add per-row checkbox to mobile cards**

In the mobile cards block (currently lines 380-428), modify the inner card's top row. Today it looks like:

```tsx
<div className="flex items-start justify-between gap-2">
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground text-sm">
      {task.employee_name}
    </p>
    ...
```

Wrap the name+description cluster in an outer flex with the checkbox at the start. Replace the inner div opening (`<div className="flex-1 min-w-0">`) with:

```tsx
<div className="flex items-start gap-3 flex-1 min-w-0">
  <label className="inline-flex h-11 w-11 -m-2 p-2 items-center justify-center cursor-pointer touch-manipulation">
    <input
      type="checkbox"
      aria-label={`בחר ${taskLabel(task)}`}
      checked={selected.has(task.id)}
      onChange={() => toggleSelect(task.id)}
      className="h-5 w-5 rounded border-gray-300 cursor-pointer accent-primary"
    />
  </label>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground text-sm">
      {task.employee_name}
    </p>
```

(The `<label>` `h-11 w-11 -m-2 p-2` pattern matches the certifications mobile card — gives a 44×44 touch target while visually rendering a smaller 20×20 checkbox.)

You'll need to add a closing `</div>` to balance the new wrapper. The structure becomes:

```tsx
<div className="flex items-start justify-between gap-2">
  <div className="flex items-start gap-3 flex-1 min-w-0">
    <label className="inline-flex h-11 w-11 -m-2 p-2 items-center justify-center cursor-pointer touch-manipulation">
      <input
        type="checkbox"
        aria-label={`בחר ${taskLabel(task)}`}
        checked={selected.has(task.id)}
        onChange={() => toggleSelect(task.id)}
        className="h-5 w-5 rounded border-gray-300 cursor-pointer accent-primary"
      />
    </label>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground text-sm">
        {task.employee_name}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {task.description}
      </p>
    </div>
  </div>
  <button
    onClick={() => handleDelete(task.id)}
    /* ...unchanged... */
  >
    <Trash2 className="h-4 w-4" />
  </button>
</div>
```

- [ ] **Step 6.8: Add `<DeleteDialog>` at the bottom of the rendered tree**

Inside the outermost `<div className="space-y-6">`, immediately before its closing `</div>` (the very last line before the `);` of the `return`), insert:

```tsx
<DeleteDialog
  open={deleteDialog.open}
  itemNames={deleteDialog.names}
  noun="משימה"
  nounPlural="משימות"
  onConfirm={handleConfirmDelete}
  onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
/>
```

- [ ] **Step 6.9: Run tests, all pass**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**' src/__tests__/tasks-client-bulk.test.tsx`
Expected: PASS (all 9 tests green).

- [ ] **Step 6.10: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 6.11: Commit**

```bash
git add src/app/dashboard/tasks/tasks-client.tsx src/__tests__/tasks-client-bulk.test.tsx
git commit -m "feat(tasks): multi-select + bulk delete UI in tasks-client

- Always-visible checkbox column on desktop, inline checkbox on mobile cards
- Bulk action bar appears when ≥1 row selected
- Reuses generalized DeleteDialog with משימה / משימות nouns
- Success/error banners with auto-dismiss + manual close
- Existing per-row delete + status select unchanged"
```

---

## Task 7: Full type-check + lint + test sweep

- [ ] **Step 7.1: Full test suite**

Run: `npx vitest run --exclude '**/node_modules/**' --exclude '**/journeys-e2e/**' --exclude '**/.claude/**'`
Expected: All test files pass (no regressions in PR #21's tests, the candidates tests, or any other suite).

- [ ] **Step 7.2: Type-check**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 7.3: Lint**

Run: `npm run lint`
Expected: passes (or fix any issues; commit fixes separately if needed).

- [ ] **Step 7.4: Production build (smoke)**

Run: `npm run build`
Expected: builds successfully. The `/dashboard/tasks` route should be marked dynamic (it already is in master).

If the build fails or the suite has any failure, STOP and triage before moving to Task 8. Do not silence failures.

---

## Task 8: Browser verification via Claude-in-Chrome MCP

The user's standing convention is to verify in a real browser before opening a PR. Claude-in-Chrome is connected; use it.

- [ ] **Step 8.1: Start dev server**

Run (background): `npm run dev`
Wait until output shows `Ready in ...` on port 3000.

- [ ] **Step 8.2: Connect to Chrome and log in as admin**

Navigate to `http://localhost:3000/login` and authenticate using the admin credentials in the user's reference memory file.

- [ ] **Step 8.3: Visit `/dashboard/tasks`**

Confirm the desktop view renders:
- A leading checkbox column on the table.
- Each row shows a per-row checkbox.
- Header has "בחר הכל" checkbox.
- No bulk action bar (selection is empty).

Take a screenshot for the PR description.

- [ ] **Step 8.4: Test selection state**

- Click 3 row checkboxes. Verify the bulk bar shows `"3 נבחרו"` and a `"מחק נבחרים"` button.
- Click "בחר הכל". Verify ALL rows become checked, count updates to `"{N} נבחרו"`.
- Click "בחר הכל" again. Verify ALL rows become unchecked, bulk bar disappears.

- [ ] **Step 8.5: Cancel-path delete (non-destructive)**

- Tick 2 rows.
- Click "מחק נבחרים".
- Verify the dialog opens, title reads `"מחיקת 2 משימות"`, list shows `"{employee} — {first 40 chars of description}"` for each.
- Click "ביטול". Verify the dialog closes and selections are preserved.

Take a screenshot of the open dialog for the PR description.

- [ ] **Step 8.6: Mobile viewport check**

Resize the browser to ~375×812 (iPhone-class). Verify:
- Mobile cards render with a checkbox at the top-start of each card.
- Checkbox tap target visually appears finger-friendly (the `h-11 w-11` touch wrapper is invisible but expands the hit area).
- Tick 2 cards → bulk bar appears with `"2 נבחרו"`.
- Click "מחק נבחרים", verify the same dialog renders correctly on a narrow viewport.
- Click ביטול to close.

Take a screenshot of mobile + bulk bar for the PR description.

- [ ] **Step 8.7: Document destructive path for user**

Per project convention, the user owns the destructive-path test (so we don't accidentally delete their real production data). In the PR description, include:

> **Destructive-path verification (user-owned):**
> 1. Pick 1-2 expendable tasks on the dev server.
> 2. Tick them, click "מחק נבחרים", confirm.
> 3. Expect green banner ("נמחקו N משימות" or "נמחקה משימה אחת" if N=1) and rows removed from the list.
> 4. Refresh the page — rows should stay gone.

- [ ] **Step 8.8: Stop dev server**

Stop the dev server background process.

---

## Task 9: Open the PR

- [ ] **Step 9.1: Final status check**

Run: `git status && git log --oneline origin/master..HEAD`
Expected: clean working tree; commits from Tasks 1, 2, 4, 6 (≈4 commits).

- [ ] **Step 9.2: Push branch**

Run: `git push -u origin feat/tasks-bulk-delete`

- [ ] **Step 9.3: Open the PR via `gh`**

Use `gh pr create --draft` with this body shape (HEREDOC):

```markdown
## Summary
- Adds multi-row selection + bulk delete on `/dashboard/tasks`, mirroring PR #21 (certifications).
- New server action `deleteTasks(ids[])` with per-id ownership check via `employees!inner(manager_id)` join, returning `{ deleted, errors }`.
- Reuses generalized `DeleteDialog` with משימה / משימות nouns.
- **Bundled cleanup:**
  - Move `CertRow` interface from `certifications-list.tsx` to `src/types/database.ts`.
  - Hebrew singular grammar fix for bulk-delete success/error banners (certifications + candidates + tasks).
  - Fix existing typo `מחקו` → `נמחקו` in candidates success copy.

## Out of scope
- Selection-count label `{N} נבחרו` is not yet pluralized for N=1 (would read "1 נבחרו"). Tracked as a follow-up.
- No keyboard shortcuts (Shift-click ranges, Cmd/Ctrl-A) — deferred per spec.

## Test plan
- [x] `tasks-delete-actions.test.ts` — 6 unit tests for the server action
- [x] `tasks-client-bulk.test.tsx` — 9 component tests for the UI
- [x] All previously-passing tests still pass (216+9+~6 = ~231 total)
- [x] Cancel-path browser-verified (Claude-in-Chrome MCP)
- [ ] **User-owned: destructive-path verify on dev server** — see body below

[Insert screenshots from Task 8: desktop list with bulk bar, open dialog, mobile cards.]

**Destructive-path verification (user-owned):**
1. Pick 1-2 expendable tasks on the dev server.
2. Tick them, click "מחק נבחרים", confirm.
3. Expect green banner and rows removed.
4. Refresh — rows stay gone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 9.4: Report PR URL to the user**

After `gh pr create` succeeds, report the URL in chat.

---

## Self-review checklist (run after writing the plan, before kicking off execution)

**Spec coverage (all spec sections accounted for):**
- "PR 2 — Tasks bulk delete" file list (spec lines 124-134) → Tasks 4 (`actions.ts`) + 6 (`tasks-client.tsx`) ✓
- New test files (spec lines 132-134) → Tasks 3 (`tasks-delete-actions.test.ts`) + 5 (`tasks-client-bulk.test.tsx`) ✓
- Bulk action bar UX (spec lines 56-63) → Task 6 step 6.4 ✓
- DeleteDialog reuse with task nouns (spec lines 65-72) → Task 6 step 6.8 ✓
- Success/error banner with auto-dismiss + manual close (spec lines 76-80) → Task 6 steps 6.3 + 6.4 ✓
- Server-action ownership pattern (spec line 145, "employees.manager_id join") → Task 4 step 4.1 ✓
- Partial failure preserves failed selections (spec lines 152, 158) → Task 6 step 6.3 (handleConfirmDelete `failedIds`) ✓
- Browser verification (spec lines 199-206) → Task 8 ✓
- Cross-cutting cleanups from session_handoff_apr26.md → Tasks 1 + 2 ✓

**Placeholder scan:** No "TBD", "TODO", "implement later", "etc." — every step has full code.

**Type consistency:**
- `deleteTasks` signature `(ids: string[]) => Promise<{ deleted: number; errors: string[] }>` — used identically in actions.ts (Task 4), action test (Task 3), and client (Task 6). ✓
- `taskLabel(task)` defined in Task 6 step 6.2, called by handleBulkDelete (6.3), desktop checkbox aria (6.6), mobile checkbox aria (6.7). ✓
- `Task` type re-defined in test (Task 5) matches the inline shape declared in `tasks-client.tsx:17-26`. ✓
- `noun="משימה" nounPlural="משימות"` matches DeleteDialog interface (`src/components/ui/delete-dialog.tsx:6-13`). ✓

**Risk areas:**
- The `data-testid` additions to tasks-client.tsx in Task 5 step 5.1 are committed together with Task 6's behavioral changes (no separate commit). The test file added in Task 5 will reference these testids before they exist if you run the tests between 5.2 and 5.3 — that's intentional (TDD red).
- jsdom renders both desktop and mobile divs — the `desktop()` scoping helper handles it. Mobile-specific behavior is verified in the browser only (Task 8).
- The `useEffect` for `success` auto-dismiss has `[success]` as the only dep — same pattern certs and candidates use. Lint should not complain.
