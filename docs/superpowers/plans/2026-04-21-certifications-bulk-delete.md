# Certifications Bulk Delete — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship bulk-delete for certifications (`/dashboard/certifications`) mirroring the multi-select pattern already shipped in the Candidates tab, with the `DeleteDialog` component relocated and generalized for reuse.

**Architecture:** A new client component `CertificationsList` owns selection state and renders the existing desktop-table + mobile-card UI, augmented with checkboxes, a bulk action bar, and a generalized `DeleteDialog`. The server action `deleteCertifications` loops per id with ownership verification via the `employees.manager_id` join, collects attached-file paths, and cleans up the `cert-images` storage bucket after DB deletion. The existing `page.tsx` remains a server component; it fetches data, then hands it to the new client component.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Supabase JS v2, Tailwind CSS, Vitest + React Testing Library + jsdom.

**Branch:** `feat/certifications-bulk-delete` (already checked out, spec committed).

**Spec reference:** [2026-04-21-bulk-delete-certifications-and-tasks.md](../specs/2026-04-21-bulk-delete-certifications-and-tasks.md)

---

## Task 0: Baseline — confirm green tests before starting

**Files:** none

- [ ] **Step 1: Verify branch + clean working tree**

Run: `git status && git branch --show-current`
Expected: branch `feat/certifications-bulk-delete`, no uncommitted changes (the spec is already committed).

- [ ] **Step 2: Run the full test suite to record a baseline**

Run: `npm test -- --run`
Expected: all tests PASS (this is the green state we must preserve).

If any tests fail at this point, stop and surface to the human — the branch diverged from a known-good state and we need to reconcile before proceeding.

---

## Task 1: Generalize and relocate DeleteDialog

**Files:**
- Create: `src/components/ui/delete-dialog.tsx`
- Delete: `src/components/candidates/delete-dialog.tsx`
- Modify: `src/components/candidates/candidates-table.tsx` (import path + prop names)
- Create: `src/__tests__/delete-dialog.test.tsx`

### Why this task comes first

`CertificationsList` needs the generalized dialog. Doing the refactor independently keeps candidate behavior green and isolates any fallout to this task alone.

- [ ] **Step 1: Write the failing test for the generalized dialog**

Create `src/__tests__/delete-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteDialog } from "@/components/ui/delete-dialog";

describe("DeleteDialog", () => {
  it("shows single-item title and body when exactly one name is passed", () => {
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /מחיקת הסמכה/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/האם למחוק את דנה כהן\? פעולה זו אינה ניתנת לביטול\./)
    ).toBeInTheDocument();
  });

  it("shows bulk title with count and lists names when multiple names are passed", () => {
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן", "יוסי לוי", "מוש פרץ"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /מחיקת 3 הסמכות/ })
    ).toBeInTheDocument();
    expect(screen.getByText("דנה כהן")).toBeInTheDocument();
    expect(screen.getByText("יוסי לוי")).toBeInTheDocument();
    expect(screen.getByText("מוש פרץ")).toBeInTheDocument();
    expect(
      screen.getByText(/האם למחוק 3 הסמכות\? פעולה זו אינה ניתנת לביטול\./)
    ).toBeInTheDocument();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <DeleteDialog
        open={false}
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("invokes onCancel when the ביטול button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^ביטול$/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("invokes onConfirm and disables both buttons while loading", async () => {
    const onConfirm = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    );
    render(
      <DeleteDialog
        open
        itemNames={["דנה כהן"]}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^מחק$/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // While in-flight, the confirm button shows a spinner label "מוחק..."
    expect(
      await screen.findByRole("button", { name: /מוחק\.\.\./ })
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the new test, expect failure**

Run: `npm test -- --run src/__tests__/delete-dialog.test.tsx`
Expected: FAIL with module-not-found error `Cannot find module '@/components/ui/delete-dialog'` (the file doesn't exist yet).

- [ ] **Step 3: Create the generalized component**

Create `src/components/ui/delete-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

interface DeleteDialogProps {
  open: boolean;
  itemNames: string[];
  noun: string;
  nounPlural: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteDialog({
  open,
  itemNames,
  noun,
  nounPlural,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
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

  const isBulk = itemNames.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="delete-dialog-title" className="text-lg font-bold text-gray-900">
            {isBulk ? `מחיקת ${itemNames.length} ${nounPlural}` : `מחיקת ${noun}`}
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
            ? `האם למחוק ${itemNames.length} ${nounPlural}? פעולה זו אינה ניתנת לביטול.`
            : `האם למחוק את ${itemNames[0]}? פעולה זו אינה ניתנת לביטול.`}
        </p>

        {isBulk && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
            <ul className="space-y-1 text-sm text-gray-700">
              {itemNames.map((name) => (
                <li key={name}>{name}</li>
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

- [ ] **Step 4: Run the new test, expect pass**

Run: `npm test -- --run src/__tests__/delete-dialog.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 5: Update `candidates-table.tsx` to use the new dialog**

In `src/components/candidates/candidates-table.tsx`, change the import on line 16:

Before:
```tsx
import { DeleteDialog } from "./delete-dialog";
```

After:
```tsx
import { DeleteDialog } from "@/components/ui/delete-dialog";
```

Then find the `<DeleteDialog />` JSX (near the bottom of the file) and update its props:

Before:
```tsx
<DeleteDialog
  open={deleteDialog.open}
  candidateNames={deleteDialog.names}
  onConfirm={handleConfirmDelete}
  onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
/>
```

After:
```tsx
<DeleteDialog
  open={deleteDialog.open}
  itemNames={deleteDialog.names}
  noun="מועמד"
  nounPlural="מועמדים"
  onConfirm={handleConfirmDelete}
  onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
/>
```

- [ ] **Step 6: Delete the old dialog file**

Run: `rm src/components/candidates/delete-dialog.tsx`

- [ ] **Step 7: Run the candidates tests to confirm no regression**

Run: `npm test -- --run src/__tests__/candidates-table.test.tsx`
Expected: all tests PASS (dialog still opens with `מחיקת 2 מועמדים` title because `noun="מועמד"` / `nounPlural="מועמדים"` is now explicit).

- [ ] **Step 8: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS — no other files reference the old dialog path.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/delete-dialog.tsx \
        src/components/candidates/candidates-table.tsx \
        src/__tests__/delete-dialog.test.tsx
git rm src/components/candidates/delete-dialog.tsx
git commit -m "refactor(ui): generalize DeleteDialog and move to components/ui

$(cat <<'MSG'
Rename candidateNames prop to itemNames, add noun/nounPlural props so the
dialog renders correct Hebrew titles and body text for any entity.

Prep for the certifications bulk-delete feature; no user-visible change
in the candidates flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

## Task 2: `deleteCertifications` server action (TDD)

**Files:**
- Modify: `src/app/dashboard/certifications/actions.ts`
- Create: `src/__tests__/certifications-delete-actions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/certifications-delete-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ------------------------------------------------------------
const selectSingleSpy = vi.fn();
const deleteEqSpy = vi.fn();
const storageRemoveSpy = vi.fn();
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
    storage: {
      from: (_bucket: string) => ({ remove: storageRemoveSpy }),
    },
  })),
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: (...args: unknown[]) => getGuestSessionIdSpy(...args),
}));

vi.mock("@/lib/guest-store", () => ({
  guestCreateCertification: vi.fn(),
  guestUpdateCertification: vi.fn(),
  guestDeleteCertification: vi.fn(),
  getGuestData: vi.fn(),
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
  storageRemoveSpy.mockReset();
  getGuestSessionIdSpy.mockReset();
  getGuestSessionIdSpy.mockResolvedValue(null);
  fromSpy.mockClear();
  vi.resetModules();
});

// Helpers ----------------------------------------------------------
function makeOwnedCert(overrides: Partial<{ id: string; image_url: string | null }> = {}) {
  return {
    data: {
      id: overrides.id ?? "cert-1",
      image_url: overrides.image_url ?? null,
      employees: { manager_id: "user-1" },
    },
    error: null,
  };
}

// Tests ------------------------------------------------------------
describe("deleteCertifications", () => {
  it("deletes each owned cert and returns the count", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedCert({ id: "c1" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c2" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c3" }));
    deleteEqSpy.mockResolvedValue({ error: null });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1", "c2", "c3"]);

    expect(result).toEqual({ deleted: 3, errors: [] });
    expect(deleteEqSpy).toHaveBeenCalledTimes(3);
    expect(deleteEqSpy).toHaveBeenNthCalledWith(1, "id", "c1");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(2, "id", "c2");
    expect(deleteEqSpy).toHaveBeenNthCalledWith(3, "id", "c3");
    // No image_url on any cert → storage.remove NOT called
    expect(storageRemoveSpy).not.toHaveBeenCalled();
  });

  it("cleans up cert-images storage for deleted rows that had image_url", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(
        makeOwnedCert({ id: "c1", image_url: "certs/aaa.jpg" })
      )
      .mockResolvedValueOnce(
        makeOwnedCert({ id: "c2", image_url: null })
      )
      .mockResolvedValueOnce(
        makeOwnedCert({ id: "c3", image_url: "certs/bbb.pdf" })
      );
    deleteEqSpy.mockResolvedValue({ error: null });
    storageRemoveSpy.mockResolvedValue({ data: [], error: null });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1", "c2", "c3"]);

    expect(result.deleted).toBe(3);
    expect(storageRemoveSpy).toHaveBeenCalledTimes(1);
    expect(storageRemoveSpy).toHaveBeenCalledWith([
      "certs/aaa.jpg",
      "certs/bbb.pdf",
    ]);
  });

  it("tolerates a storage cleanup failure without failing the whole action", async () => {
    selectSingleSpy.mockResolvedValueOnce(
      makeOwnedCert({ id: "c1", image_url: "certs/aaa.jpg" })
    );
    deleteEqSpy.mockResolvedValue({ error: null });
    storageRemoveSpy.mockRejectedValue(new Error("storage down"));

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1"]);

    // DB delete succeeded; storage failure is swallowed
    expect(result).toEqual({ deleted: 1, errors: [] });
  });

  it("treats a cross-manager cert id as silent no-op (counts as deleted)", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { id: "c1", image_url: null, employees: { manager_id: "other-user" } },
      error: null,
    });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1"]);

    // No data leak, no error surfaced; counted as deleted per spec
    expect(result).toEqual({ deleted: 1, errors: [] });
    expect(deleteEqSpy).not.toHaveBeenCalled();
  });

  it("records partial failures and keeps going", async () => {
    selectSingleSpy
      .mockResolvedValueOnce(makeOwnedCert({ id: "c1" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c2" }))
      .mockResolvedValueOnce(makeOwnedCert({ id: "c3" }));
    deleteEqSpy
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "permission denied" } })
      .mockResolvedValueOnce({ error: null });

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1", "c2", "c3"]);

    expect(result.deleted).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("c2");
  });

  it("returns zero deleted on empty array without hitting Supabase", async () => {
    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications([]);

    expect(result).toEqual({ deleted: 0, errors: [] });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(selectSingleSpy).not.toHaveBeenCalled();
  });

  it("refuses in guest mode with a helpful error message", async () => {
    getGuestSessionIdSpy.mockResolvedValue("guest-123");

    const { deleteCertifications } = await import(
      "@/app/dashboard/certifications/actions"
    );
    const result = await deleteCertifications(["c1"]);

    expect(result.deleted).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/אורח/);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- --run src/__tests__/certifications-delete-actions.test.ts`
Expected: FAIL with `deleteCertifications is not a function` (or similar import error).

- [ ] **Step 3: Add `deleteCertifications` to the actions file**

In `src/app/dashboard/certifications/actions.ts`, append (at the end of the file — do not touch existing exports):

```ts
export async function deleteCertifications(ids: string[]): Promise<{
  deleted: number;
  errors: string[];
}> {
  const result = { deleted: 0, errors: [] as string[] };
  if (!Array.isArray(ids) || ids.length === 0) return result;

  const guestSid = await getGuestSessionId();
  if (guestSid) {
    return {
      deleted: 0,
      errors: ["מחיקה מרובה אינה זמינה במצב אורח"],
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const imagePaths: string[] = [];

  for (const id of ids) {
    const { data: cert } = await supabase
      .from("certifications")
      .select("id, image_url, employees!inner(manager_id)")
      .eq("id", id)
      .single();

    // Missing row OR cross-manager row: silent no-op per spec.
    // Count as deleted because the end state (row inaccessible to this user) is correct.
    const managerId =
      cert && (cert.employees as unknown as { manager_id: string } | null)?.manager_id;
    if (!cert || managerId !== user.id) {
      result.deleted++;
      continue;
    }

    const { error } = await supabase
      .from("certifications")
      .delete()
      .eq("id", id);

    if (error) {
      result.errors.push(`${id}: ${mapSupabaseError(error.message)}`);
      continue;
    }

    result.deleted++;
    if (cert.image_url) {
      const path = cert.image_url.includes("/cert-images/")
        ? cert.image_url.split("/cert-images/")[1]
        : cert.image_url;
      if (path) imagePaths.push(path);
    }
  }

  // Best-effort storage cleanup. DB is authoritative; orphaned files are acceptable.
  if (imagePaths.length > 0) {
    try {
      await supabase.storage.from("cert-images").remove(imagePaths);
    } catch {
      // Intentionally swallow — orphan is preferable to a failed bulk delete.
    }
  }

  revalidatePath("/dashboard/certifications");
  return result;
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npm test -- --run src/__tests__/certifications-delete-actions.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS.

- [ ] **Step 6: Run typecheck + lint**

Run: `npm run build`
Expected: completes without TypeScript errors.

Run: `npm run lint`
Expected: no lint errors for the changed files.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/certifications/actions.ts \
        src/__tests__/certifications-delete-actions.test.ts
git commit -m "feat(certifications): add deleteCertifications server action

$(cat <<'MSG'
Bulk-delete action for the certifications tab. Verifies ownership via
employees!inner(manager_id) join per id, collects image_url paths of
deleted rows, and best-effort cleans up the cert-images storage bucket.

Refuses in guest mode. Cross-manager ids and missing rows count as
silent no-ops (end state matches user intent). Mirrors the behavior of
deleteCandidates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

## Task 3: `CertificationsList` client component (TDD)

**Files:**
- Create: `src/components/certifications/certifications-list.tsx`
- Create: `src/__tests__/certifications-list.test.tsx`

### Component contract

```ts
interface CertRow {
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

interface CertificationsListProps {
  certs: CertRow[];
  isGuest: boolean;  // hide bulk UI when true
}
```

- [ ] **Step 1: Write the failing test suite**

Create `src/__tests__/certifications-list.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import type { CertStatus } from "@/types/database";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const deleteCertifications = vi.fn();
vi.mock("@/app/dashboard/certifications/actions", () => ({
  deleteCertifications: (...args: unknown[]) => deleteCertifications(...args),
  deleteCertification: vi.fn(),
}));

// Import after mocks
import { CertificationsList } from "@/components/certifications/certifications-list";

type CertRow = {
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
};

function makeCert(overrides: Partial<CertRow> = {}): CertRow {
  return {
    id: "cert-1",
    employee_name: "דנה כהן",
    employee_department: "נת״ע",
    cert_type_id: "ct-1",
    cert_type_name: "נהיגה",
    issue_date: "2025-01-01",
    expiry_date: "2027-01-01",
    next_refresh_date: null,
    image_url: null,
    status: "valid",
    ...overrides,
  };
}

// Helper: scope queries to the desktop table only.
// In jsdom, both the desktop table and the mobile card list render (Tailwind's
// `hidden md:block` / `md:hidden` are CSS-only and jsdom does not evaluate the
// media query), so per-row labels appear twice. We assert against the desktop
// view; browser verification (Task 5) covers mobile visually.
function desktop() {
  return within(screen.getByTestId("certs-desktop"));
}
function mobile() {
  return within(screen.getByTestId("certs-mobile"));
}

describe("CertificationsList — selection UI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a checkbox for each row and a select-all in the table header", () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
        ]}
      />
    );

    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeInTheDocument();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*יוסי לוי/ })
    ).toBeInTheDocument();
    // Select-all exists once (desktop table only)
    expect(
      desktop().getByRole("checkbox", { name: /בחר הכל/ })
    ).toBeInTheDocument();
  });

  it("select-all toggles all rows", () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
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
    render(
      <CertificationsList
        isGuest={false}
        certs={[makeCert()]}
      />
    );
    expect(
      screen.queryByRole("button", { name: /מחק נבחרים/ })
    ).not.toBeInTheDocument();
  });

  it("shows the bulk action bar with count when at least one row is selected", () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
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

  it("hides all selection UI in guest mode", () => {
    render(
      <CertificationsList
        isGuest={true}
        certs={[makeCert()]}
      />
    );
    // No select-all, no per-row checkboxes anywhere
    expect(
      screen.queryByRole("checkbox", { name: /בחר הכל/ })
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox", { name: /בחר/ })).toHaveLength(0);
  });
});

describe("CertificationsList — bulk delete flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clicking 'מחק נבחרים' opens the dialog with selected names listed", async () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({
            id: "a",
            employee_name: "דנה כהן",
            cert_type_name: "נהיגה",
          }),
          makeCert({
            id: "b",
            employee_name: "יוסי לוי",
            cert_type_name: "ריתוך",
          }),
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
      name: /מחיקת 2 הסמכות/,
    });
    expect(within(dialog).getByText(/דנה כהן.*נהיגה/)).toBeInTheDocument();
    expect(within(dialog).getByText(/יוסי לוי.*ריתוך/)).toBeInTheDocument();
  });

  it("confirm calls deleteCertifications with selected ids and shows success", async () => {
    deleteCertifications.mockResolvedValue({ deleted: 2, errors: [] });

    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
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
      expect(deleteCertifications).toHaveBeenCalledWith(["a", "b"]);
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/נמחקו 2 הסמכות/);
    });
  });

  it("cancel closes the dialog without calling the server action", async () => {
    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
        ]}
      />
    );

    fireEvent.click(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /מחק נבחרים/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^ביטול$/ }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /מחיקת הסמכה/ })
      ).not.toBeInTheDocument();
    });
    expect(deleteCertifications).not.toHaveBeenCalled();
    expect(
      desktop().getByRole("checkbox", { name: /בחר .*דנה כהן/ })
    ).toBeChecked();
  });

  it("partial failure surfaces an error banner and keeps the successful deletes", async () => {
    deleteCertifications.mockResolvedValue({
      deleted: 1,
      errors: ["b: permission denied"],
    });

    render(
      <CertificationsList
        isGuest={false}
        certs={[
          makeCert({ id: "a", employee_name: "דנה כהן" }),
          makeCert({ id: "b", employee_name: "יוסי לוי" }),
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
      expect(alert).toHaveTextContent(/נמחקו 1/);
      expect(alert).toHaveTextContent(/permission denied/);
    });
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- --run src/__tests__/certifications-list.test.tsx`
Expected: FAIL with module-not-found for `@/components/certifications/certifications-list`.

- [ ] **Step 3: Create the client component**

Create `src/components/certifications/certifications-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Paperclip, FileText, Image } from "lucide-react";
import { deleteCertification, deleteCertifications } from "@/app/dashboard/certifications/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import type { CertStatus } from "@/types/database";
import { formatDateHe } from "@/types/database";

const statusConfig: Record<
  CertStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  valid: { label: "בתוקף", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  unknown: { label: "לא ידוע", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  expiring_soon: {
    label: "פג בקרוב",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  expired: { label: "פג תוקף", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

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

interface CertificationsListProps {
  certs: CertRow[];
  isGuest: boolean;
}

export function CertificationsList({ certs, isGuest }: CertificationsListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
      if (prev.size === certs.length) return new Set();
      return new Set(certs.map((c) => c.id));
    });
  }, [certs]);

  function handleBulkDelete() {
    const ids = Array.from(selected);
    const names = ids.map((id) => {
      const c = certs.find((cc) => cc.id === id);
      return c ? `${c.employee_name} — ${c.cert_type_name}` : id;
    });
    setDeleteDialog({ open: true, ids, names });
  }

  async function handleConfirmDelete() {
    setError(null);
    setSuccess(null);
    try {
      const result = await deleteCertifications(deleteDialog.ids);
      if (result.errors.length > 0) {
        setError(`נמחקו ${result.deleted}. שגיאות: ${result.errors.join(", ")}`);
      } else {
        setSuccess(`נמחקו ${result.deleted} הסמכות`);
      }
      setDeleteDialog({ open: false, ids: [], names: [] });
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה במחיקה");
      setDeleteDialog({ open: false, ids: [], names: [] });
    }
  }

  const showBulkUI = !isGuest;

  return (
    <>
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-3 mb-3"
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

      {showBulkUI && selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-2.5 text-sm mb-3">
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

      {/* Desktop table */}
      <div
        data-testid="certs-desktop"
        className="hidden md:block rounded-xl overflow-x-auto"
        style={{
          backgroundColor: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <table className="w-full">
          <caption className="sr-only">רשימת הסמכות</caption>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {showBulkUI && (
                <th scope="col" className="w-10 px-4 py-3.5">
                  <input
                    type="checkbox"
                    aria-label="בחר הכל"
                    checked={certs.length > 0 && selected.size === certs.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
                  />
                </th>
              )}
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>עובד</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>סוג הסמכה</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>קובץ</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>תאריך הנפקה</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>תאריך תפוגה</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>מועד רענון הבא</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>סטטוס</th>
              <th scope="col" className="text-right px-6 py-3.5 text-sm font-medium" style={{ color: "#64748b" }}>פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "#e2e8f0" }}>
            {certs.map((cert) => {
              const sc = statusConfig[cert.status];
              const label = `${cert.employee_name} — ${cert.cert_type_name}`;
              return (
                <tr key={cert.id} className="transition-colors duration-150">
                  {showBulkUI && (
                    <td className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label={`בחר ${label}`}
                        checked={selected.has(cert.id)}
                        onChange={() => toggleSelect(cert.id)}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: "#0f172a" }}>{cert.employee_name}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{cert.cert_type_name}</td>
                  <td className="px-6 py-4">
                    {cert.image_url ? (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                        {cert.image_url.endsWith(".pdf") ? (
                          <FileText className="h-3.5 w-3.5" />
                        ) : (
                          <Image className="h-3.5 w-3.5" />
                        )}
                        מצורף
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{formatDateHe(cert.issue_date)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{formatDateHe(cert.expiry_date)}</td>
                  <td className="px-6 py-4 text-sm" style={{ color: "#64748b" }}>{formatDateHe(cert.next_refresh_date)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} aria-hidden="true" />
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/certifications/${cert.id}/edit`}
                        className="text-sm font-medium transition-colors"
                        style={{ color: "#2563eb" }}
                      >
                        עריכה
                      </Link>
                      <DeleteButton
                        action={async () => {
                          "use server";
                          await deleteCertification(cert.id);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div data-testid="certs-mobile" className="md:hidden space-y-3">
        {certs.map((cert) => {
          const sc = statusConfig[cert.status];
          const label = `${cert.employee_name} — ${cert.cert_type_name}`;
          return (
            <div
              key={cert.id}
              className="rounded-xl p-4 space-y-3 transition-colors duration-150"
              style={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {showBulkUI && (
                    <label className="inline-flex h-11 w-11 -m-2 p-2 items-center justify-center cursor-pointer touch-manipulation">
                      <input
                        type="checkbox"
                        aria-label={`בחר ${label}`}
                        checked={selected.has(cert.id)}
                        onChange={() => toggleSelect(cert.id)}
                        className="h-5 w-5 rounded border-gray-300 cursor-pointer accent-primary"
                      />
                    </label>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate" style={{ color: "#0f172a" }}>
                      {cert.employee_name}
                    </h3>
                    <p className="text-sm truncate" style={{ color: "#64748b" }}>
                      {cert.cert_type_name}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} aria-hidden="true" />
                  {sc.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span style={{ color: "#94a3b8" }}>הנפקה: </span>
                  <span style={{ color: "#0f172a" }}>{formatDateHe(cert.issue_date)}</span>
                </div>
                <div>
                  <span style={{ color: "#94a3b8" }}>תפוגה: </span>
                  <span style={{ color: "#0f172a" }}>{formatDateHe(cert.expiry_date)}</span>
                </div>
                {cert.next_refresh_date && (
                  <div>
                    <span style={{ color: "#94a3b8" }}>מועד רענון הבא: </span>
                    <span style={{ color: "#0f172a" }}>{formatDateHe(cert.next_refresh_date)}</span>
                  </div>
                )}
              </div>

              {cert.image_url && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <Paperclip className="h-3.5 w-3.5" />
                  קובץ מצורף
                </div>
              )}

              <div className="flex items-center gap-3 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
                <Link
                  href={`/dashboard/certifications/${cert.id}/edit`}
                  className="inline-flex min-h-[44px] items-center text-sm font-medium transition-colors touch-manipulation"
                  style={{ color: "#2563eb" }}
                >
                  עריכה
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await deleteCertification(cert.id);
                  }}
                >
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center text-sm font-medium transition-colors touch-manipulation"
                    style={{ color: "#dc2626" }}
                  >
                    מחיקה
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <DeleteDialog
        open={deleteDialog.open}
        itemNames={deleteDialog.names}
        noun="הסמכה"
        nounPlural="הסמכות"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDialog({ open: false, ids: [], names: [] })}
      />
    </>
  );
}
```

> **Note for the implementer:** the mobile card uses a `<form action={inlineServerAction}>` pattern that mirrors the existing single-delete flow. In this new component, we keep the per-row single delete unchanged — it's already proven in production. The bulk flow is additive.

> **Accessibility note:** the select-all checkbox label `"בחר הכל"` and the per-row label `"בחר {employee} — {cert_type}"` use a shared `בחר` prefix. The tests distinguish them with regex. Do not rename.

- [ ] **Step 4: Run the test, expect pass**

Run: `npm test -- --run src/__tests__/certifications-list.test.tsx`
Expected: all tests PASS.

If a test fails because a regex doesn't match the exact text, fix the test — not the component — unless the component text is semantically wrong.

- [ ] **Step 5: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/certifications/certifications-list.tsx \
        src/__tests__/certifications-list.test.tsx
git commit -m "feat(certifications): CertificationsList client component with multi-select

$(cat <<'MSG'
Adds a client component that renders the certifications list (desktop
table + mobile cards) with a leading checkbox column, select-all, and
a bulk action bar that opens the generalized DeleteDialog. Selection
UI is hidden in guest mode.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

## Task 4: Wire `CertificationsList` into the certifications page

**Files:**
- Modify: `src/app/dashboard/certifications/page.tsx`

### Rationale

The page stays a server component — it handles auth, guest detection, data fetching, filtering, and search. After filtering, it passes the rows to `<CertificationsList>` instead of rendering the inline table/cards.

- [ ] **Step 1: Modify `page.tsx` to use the new component**

Open `src/app/dashboard/certifications/page.tsx`. Keep imports for server-side data (`requireUser`, `getGuestSessionId`, guest store, `getCertStatus`, `AutoSubmitSelect`, `Search`, `Plus`, `Link`). **Remove** imports that only the old inline render needed: `Paperclip`, `FileText`, `Image`, `deleteCertification`, `DeleteButton`, `formatDateHe` (the list component re-imports what it needs).

Add:
```tsx
import { CertificationsList, type CertRow } from "@/components/certifications/certifications-list";
```

Remove the `statusConfig` constant and the two large `{/* Desktop table */}` / `{/* Mobile cards */}` JSX blocks. Replace the final empty/list conditional with a single call to `<CertificationsList>`.

Here is the updated bottom half of the file (replace from `// Transform and filter` onward):

```tsx
  // Transform and filter
  const allCerts: CertRow[] = (certifications || []).map((cert: any) => ({
    id: cert.id,
    employee_name: cert.employees
      ? `${cert.employees.first_name} ${cert.employees.last_name}`
      : "לא ידוע",
    employee_department: cert.employees?.department || "",
    cert_type_id: cert.cert_type_id,
    cert_type_name: cert.cert_types?.name || "לא ידוע",
    issue_date: cert.issue_date,
    expiry_date: cert.expiry_date,
    next_refresh_date: cert.next_refresh_date,
    image_url: cert.image_url,
    status: getCertStatus(cert.expiry_date, cert.next_refresh_date),
  }));

  const filtered = allCerts.filter((cert) => {
    const matchesFilter =
      currentFilter === "all" || cert.status === currentFilter;
    const matchesSearch =
      !searchQuery ||
      cert.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.cert_type_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept =
      !deptFilter || cert.employee_department === deptFilter;
    const matchesType =
      !typeFilter || cert.cert_type_id === typeFilter;
    return matchesFilter && matchesSearch && matchesDept && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header (unchanged) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>
            הסמכות
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            ניהול ומעקב אחר הסמכות העובדים
          </p>
        </div>
        <Link
          href="/dashboard/certifications/new"
          className="inline-flex items-center justify-center gap-2 text-white px-5 py-2.5 rounded-lg transition-colors text-sm font-medium"
          style={{ backgroundColor: "#2563eb", boxShadow: "var(--shadow-sm)" }}
        >
          <Plus className="h-4 w-4" />
          <span>הוסף הסמכה</span>
        </Link>
      </div>

      {/* Search + filters (unchanged) */}
      <form className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            name="search"
            defaultValue={searchQuery}
            placeholder="חיפוש לפי שם עובד או הסמכה..."
            aria-label="חיפוש הסמכות"
            className="w-full pr-4 pl-10 py-2.5 rounded-lg text-sm border border-border bg-white text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring"
          />
          <input type="hidden" name="filter" value={currentFilter} />
          <button
            type="submit"
            aria-label="חיפוש"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors cursor-pointer"
          >
            <Search className="h-4.5 w-4.5" style={{ width: "18px", height: "18px" }} />
          </button>
        </div>
        <AutoSubmitSelect
          name="dept"
          defaultValue={deptFilter}
          aria-label="סינון לפי מחלקה"
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-44"
        >
          <option value="">כל המחלקות</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect
          name="type"
          defaultValue={typeFilter}
          aria-label="סינון לפי סוג הסמכה"
          className="rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-ring cursor-pointer sm:w-44"
        >
          <option value="">כל סוגי ההסמכה</option>
          {(certTypes || []).map((ct: any) => (
            <option key={ct.id} value={ct.id}>{ct.name}</option>
          ))}
        </AutoSubmitSelect>
      </form>

      {/* Filter tabs (unchanged) */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => {
          const isActive = currentFilter === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/dashboard/certifications?filter=${tab.key}${searchQuery ? `&search=${searchQuery}` : ""}${deptFilter ? `&dept=${deptFilter}` : ""}${typeFilter ? `&type=${typeFilter}` : ""}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                isActive ? "text-white" : "hover:text-[#0f172a]"
              }`}
              style={
                isActive
                  ? { backgroundColor: "#2563eb", color: "#fff" }
                  : {
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      color: "#64748b",
                    }
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Results count */}
      <p className="text-sm" style={{ color: "#94a3b8" }}>
        {filtered.length} הסמכות נמצאו
      </p>

      {filtered.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="text-lg" style={{ color: "#64748b" }}>
            לא נמצאו הסמכות
          </p>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            נסה לשנות את הסינון או להוסיף הסמכה חדשה
          </p>
        </div>
      ) : (
        <CertificationsList certs={filtered} isGuest={Boolean(guestSid)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove unused imports from the top of the file**

The old top-of-file imports:
```tsx
import { deleteCertification } from "./actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { Search, Plus, Paperclip, FileText, Image } from "lucide-react";
```

Replace with:
```tsx
import { Search, Plus } from "lucide-react";
```

Also remove `getCertStatus, formatDateHe` from `"@/types/database"` import if `formatDateHe` is only used inside the deleted render — keep `getCertStatus` since we still call it. The resulting types import should read:
```tsx
import { getCertStatus } from "@/types/database";
import type { CertStatus } from "@/types/database";
```

Remove the `statusConfig` constant entirely — it moved to the list component.

- [ ] **Step 3: Run typecheck**

Run: `npm run build`
Expected: build succeeds; no TS errors referring to unused imports, missing types, or bad prop shapes.

- [ ] **Step 4: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS, including the existing `certifications-page-filter.test.tsx` if any (confirms filter logic survived the refactor).

- [ ] **Step 5: Smoke-render in dev**

Run: `npm run dev` (in a separate terminal).

Open `http://localhost:3000/dashboard/certifications` after logging in. Verify visually:
- Page renders without errors in the browser console.
- Desktop table shows a checkbox column on the left.
- Mobile cards (resize to <768px) show a checkbox at the top-start corner of each card.
- Existing single-row "עריכה" and "מחיקה" actions still work.

This is a manual sanity check before the full browser verification in Task 5. Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/certifications/page.tsx
git commit -m "feat(certifications): render via CertificationsList client component

$(cat <<'MSG'
page.tsx continues to do all data fetching, filtering, and search
server-side, then hands the final row set plus an isGuest flag to the
new CertificationsList client component. Inline desktop/mobile render
blocks removed; statusConfig moved into the list component.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

## Task 5: Full browser verification (Claude-in-Chrome MCP)

**Files:** none modified; this is verification.

### Preconditions

- Dev server running on `http://localhost:3000`.
- Admin credentials from [reference_admin_credentials.md](../../../.claude/projects/C--Users-maor4-OneDrive-Desktop-certimanager/memory/reference_admin_credentials.md).
- At least 3 certifications exist in the account; if not, create them via the UI first.
- Optional but recommended: one of those certifications has an attached file so we can confirm storage cleanup.

- [ ] **Step 1: Log in**

Via Claude-in-Chrome: navigate to `/login`, submit admin credentials, wait for redirect to `/dashboard`.

- [ ] **Step 2: Navigate to certifications**

Click `הסמכות` in the sidebar. Confirm the page loads, at least 3 rows are visible, and the desktop table shows a leading checkbox column.

- [ ] **Step 3: Tick 3 rows, confirm bulk bar**

Click 3 row checkboxes. Expect a blue bulk action bar to appear above the table reading `3 נבחרו` and a red `מחק נבחרים` button.

- [ ] **Step 4: Open the confirmation dialog**

Click `מחק נבחרים`. Expect:
- Modal dialog with title `מחיקת 3 הסמכות`.
- Body text `האם למחוק 3 הסמכות? פעולה זו אינה ניתנת לביטול.`
- A scrollable list of 3 items, each showing `{employee} — {cert_type}`.

- [ ] **Step 5: Cancel, confirm selection preserved**

Click `ביטול`. Dialog closes. Row checkboxes remain ticked. Bulk bar still visible.

- [ ] **Step 6: Re-open and confirm**

Click `מחק נבחרים` again. Click the red `מחק` button. Expect:
- Button briefly shows `מוחק...` spinner.
- Dialog closes.
- A green success banner appears: `נמחקו 3 הסמכות`.
- The 3 rows are gone from the list.
- Select-all count is 0 (no checkbox in header is checked).

- [ ] **Step 7: Success banner auto-dismisses**

Wait 7 seconds. The green banner should disappear on its own.

- [ ] **Step 8: (If applicable) Verify storage cleanup**

If one of the deleted certs had an attached file: in Supabase Studio → Storage → `cert-images` → `certs/`, confirm the file is gone. (If not using Supabase Studio, skip this step; the server action test covers the behavior.)

- [ ] **Step 9: Mobile viewport**

Resize the browser to 375×812 (iPhone 13) via the Chrome MCP `resize_window`. Reload. Expect:
- Cards render, each with a checkbox at the top-start corner next to the employee name.
- Tap two cards' checkboxes. Bulk bar appears with `2 נבחרו`.
- Tap `מחק נבחרים` → dialog → `מחק`. Cards are gone. Green banner appears.

- [ ] **Step 10: Guest mode sanity check**

Log out. Enter guest mode (the app's guest session entry point). Navigate to הסמכות.

Expect:
- No checkboxes anywhere (neither in the desktop table header nor on mobile cards).
- No bulk action bar ever appears (impossible to trigger).
- Existing per-row עריכה / מחיקה affordances still work.

- [ ] **Step 11: Record verification result**

If all 10 steps passed, the feature is verified. If any failed, file the specific failure and stop — do not open the PR until the root cause is fixed.

---

## Task 6: Pre-PR polish

**Files:** none new; refinements only.

- [ ] **Step 1: Re-run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS.

- [ ] **Step 2: Re-run build + lint**

Run: `npm run build && npm run lint`
Expected: both succeed without errors.

- [ ] **Step 3: Review the full diff against master**

Run: `git diff --stat master..HEAD`

Expected file list (approximate):
- `docs/superpowers/specs/2026-04-21-bulk-delete-certifications-and-tasks.md` (new, from Task 0 of the prior session)
- `docs/superpowers/plans/2026-04-21-certifications-bulk-delete.md` (new, this plan)
- `src/components/ui/delete-dialog.tsx` (new)
- `src/components/candidates/delete-dialog.tsx` (deleted)
- `src/components/candidates/candidates-table.tsx` (minor: 2-prop change)
- `src/__tests__/delete-dialog.test.tsx` (new)
- `src/app/dashboard/certifications/actions.ts` (modified: new export)
- `src/__tests__/certifications-delete-actions.test.ts` (new)
- `src/components/certifications/certifications-list.tsx` (new)
- `src/__tests__/certifications-list.test.tsx` (new)
- `src/app/dashboard/certifications/page.tsx` (modified: delegates render to list)

Total: roughly 400-600 net lines added.

- [ ] **Step 4: Hand off to the human**

Report:
- Tests passing, build clean, lint clean.
- Browser verification completed (reference Task 5 results).
- Branch pushed? (Ask the human before pushing or opening the PR — they control remote actions.)

---

## Out of scope for PR 1 (do NOT attempt)

- `feat/tasks-bulk-delete` (PR 2) — gets its own plan after this one merges.
- A shared `useBulkSelection` hook — deferred.
- Bulk actions other than delete — deferred.
- Guest-mode bulk delete — intentionally hidden by `isGuest` flag.
- Keyboard shortcuts (Cmd/Ctrl-A, Shift-click ranges) — deferred.
- Pagination-aware select-all — no pagination today.
- Changes to the candidates tab beyond the two-prop dialog rename.

If execution surfaces a requirement not covered by the spec, stop and surface it to the human before inventing behavior.
