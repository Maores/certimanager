# Mobile Nav All-Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 8 dashboard destinations reachable from the mobile bottom nav by swapping the hardcoded 5-route whitelist for a "4 pinned + עוד sheet" pattern, while also fixing the latent guest-filter bypass.

**Architecture:** Single-component change in `src/components/layout/sidebar.tsx` (client component). Add a `PINNED_MOBILE_HREFS` constant and local state for the sheet (`useState`), close on route change / Escape / scrim / item tap. Render a `role="dialog"` bottom sheet containing the overflow items above the existing nav bar. Desktop sidebar untouched.

**Tech Stack:** Next.js 16 (App Router) · React 19 client component · Tailwind v4 utility classes · lucide-react icons · Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-04-15-mobile-nav-all-tabs-design.md`

**Branch:** `fix/mobile-nav-all-tabs` (already created off master; spec is committed as `ef3020c`).

---

## ⚠ Session Handoff (2026-04-15 18:10 GMT+3)

The previous session stopped mid-Task-1 due to context-window pressure and a Haiku-subagent misstep. Clean state at the end of that session:

- **HEAD:** `ef72fa9` (plan-fix commit this block) — or whatever the latest commit is after reading this note.
- **Branch:** `fix/mobile-nav-all-tabs`, nothing uncommitted, nothing pushed.
- **What's done:** spec (`ef3020c`), plan (`2d37824`), and this plan-level bug-fix.
- **What's next:** Task 1 (scaffolding) still needs doing. Preflight should pass cleanly.

**Plan defect found and fixed in place:** Task 1's original smoke test used `screen.getByRole("navigation", { name: "ניווט ראשי" })`, but `sidebar.tsx` currently renders TWO `<nav>` elements with that exact label (the desktop internal nav at line 66 and the mobile bottom bar at line 110). In jsdom, both render regardless of media queries, so `getByRole` throws "Found multiple elements". Task 1's Step 1 below is now updated to use `getAllByRole(...)[0]` — this matches the pattern Task 2 already uses. No other plan changes are needed.

**Latent a11y note (not blocking):** Having two nav landmarks share an identical `aria-label` is suboptimal. A follow-up PR could rename the desktop inner nav's label (e.g., "תפריט צד") to distinguish it. Out of scope for this fix — flagging for later.

**Subagent lesson for the next run:** if a subagent encounters something unexpected (like a test query that doesn't match the DOM), it must report `BLOCKED` rather than modifying files outside its stated scope. The implementer prompt already says this; be explicit about it when re-dispatching.

---

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/components/layout/sidebar.tsx` | Renders desktop sidebar + mobile bottom nav. Adds "עוד" sheet on mobile. | Modify |
| `src/__tests__/sidebar.test.tsx` | Vitest suite covering the 9 scenarios from the spec. | Create |

No other files change. No new dependencies.

---

## Preflight (run once before Task 1)

- [ ] **Verify branch:** `git branch --show-current` → expect `fix/mobile-nav-all-tabs`.
- [ ] **Verify clean working tree:** `git status --short` → expect empty (spec already committed).
- [ ] **Verify test infra works:** `npm test -- --run src/__tests__/candidates-table.test.tsx` → expect all tests PASS.

If any preflight check fails, stop and fix before continuing.

---

## Task 1: Test scaffolding

Get a new test file wired up with mocks and a single smoke test proving the mobile nav renders at all. This is the TDD on-ramp — everything else hangs off this.

**Files:**
- Create: `src/__tests__/sidebar.test.tsx`

- [ ] **Step 1: Write the scaffold test**

Create `src/__tests__/sidebar.test.tsx` with this exact content:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next/navigation before importing the component.
// Use a mutable variable so individual tests can override the pathname.
let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// Import AFTER the mock.
import Sidebar, { type NavItem } from "@/components/layout/sidebar";

const FULL_ITEMS: NavItem[] = [
  { label: "לוח בקרה", href: "/dashboard", icon: "dashboard" },
  { label: "עובדים", href: "/dashboard/employees", icon: "employees" },
  { label: "הסמכות", href: "/dashboard/certifications", icon: "certifications" },
  { label: "סוגי הסמכות", href: "/dashboard/cert-types", icon: "cert-types" },
  { label: "מועמדים לקורסים", href: "/dashboard/candidates", icon: "candidates" },
  { label: "משימות", href: "/dashboard/tasks", icon: "tasks" },
  { label: "ייבוא", href: "/dashboard/import", icon: "import" },
  { label: "דוחות", href: "/dashboard/reports", icon: "reports" },
];

describe("Sidebar — smoke", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("renders at least one nav landmark labelled 'ניווט ראשי'", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    // NOTE: current sidebar.tsx renders TWO such navs (desktop inner + mobile bottom).
    // We tolerate both and assert at least one exists. Task 2's tests select mobile
    // specifically via navs[navs.length - 1].
    const navs = screen.getAllByRole("navigation", { name: "ניווט ראשי" });
    expect(navs.length).toBeGreaterThan(0);
    expect(navs[0]).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- --run src/__tests__/sidebar.test.tsx`
Expected: PASS (Sidebar renders at least one `<nav aria-label="ניווט ראשי">`).

> ⚠ **If this fails**, check: (a) the `@/` alias resolves (it should, per `vitest.config.ts`); (b) `Sidebar` exports a default component; (c) the existing markup uses `aria-label="ניווט ראשי"`. **Do NOT modify `src/__tests__/setup.ts` to work around rendering quirks** — the component renders both desktop and mobile branches in jsdom and that's fine. If the query fails for a different reason, report BLOCKED.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sidebar.test.tsx
git commit -m "test(sidebar): add test scaffold with navigation mocks"
```

---

## Task 2: Add "עוד" button and sheet — 4 pinned + overflow

This is the core change. Adds the constant, state, and mobile rendering path. Writes the two core reachability tests (spec tests #1 and #2) first.

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/__tests__/sidebar.test.tsx`

- [ ] **Step 1: Add failing tests for reachability**

Append to `src/__tests__/sidebar.test.tsx` after the existing `describe`:

```tsx
describe("Sidebar — mobile nav: 4 pinned + עוד", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("renders 4 pinned links plus an 'עוד' button on mobile", () => {
    render(<Sidebar items={FULL_ITEMS} />);

    // The mobile nav is the second navigation landmark (first is desktop).
    const navs = screen.getAllByRole("navigation", { name: "ניווט ראשי" });
    const mobileNav = navs[navs.length - 1]; // last one in DOM is mobile

    // 4 pinned: dashboard, employees, certifications, tasks
    expect(mobileNav.querySelectorAll('a[href="/dashboard"]').length).toBeGreaterThan(0);
    expect(mobileNav.querySelector('a[href="/dashboard/employees"]')).toBeInTheDocument();
    expect(mobileNav.querySelector('a[href="/dashboard/certifications"]')).toBeInTheDocument();
    expect(mobileNav.querySelector('a[href="/dashboard/tasks"]')).toBeInTheDocument();

    // "עוד" trigger exists with correct aria
    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn).toHaveAttribute("aria-expanded", "false");
    expect(moreBtn).toHaveAttribute("aria-controls", "mobile-more-sheet");
  });

  it("opens the sheet and exposes the 4 overflow items when 'עוד' is clicked", () => {
    render(<Sidebar items={FULL_ITEMS} />);

    // Before click: sheet dialog not present
    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));

    // After click: dialog present, aria-expanded flipped, all 4 overflow hrefs reachable
    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "עוד אפשרויות ניווט" })).toHaveAttribute("aria-expanded", "true");

    expect(sheet.querySelector('a[href="/dashboard/cert-types"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/candidates"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/import"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/reports"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/__tests__/sidebar.test.tsx`
Expected: both new tests FAIL (the "עוד" button doesn't exist yet; clicking it doesn't produce a dialog). The smoke test still passes.

- [ ] **Step 3: Update imports + add constant in `sidebar.tsx`**

Replace the existing import block at the top of `src/components/layout/sidebar.tsx` (lines 1-16) with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Award,
  Tag,
  FileUp,
  BarChart3,
  ClipboardList,
  GraduationCap,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

const PINNED_MOBILE_HREFS = [
  "/dashboard",
  "/dashboard/employees",
  "/dashboard/certifications",
  "/dashboard/tasks",
];
```

- [ ] **Step 4: Replace the mobile nav block with the new implementation**

Replace lines `~109-149` (the entire `{/* Mobile bottom tab bar */}` block plus its `<nav>...</nav>`) with the markup below. The desktop `<aside>` block stays exactly as it is.

Inside the `Sidebar` function, **just before the `return`**, add:

```tsx
  const pinnedItems = filteredItems.filter((i) => PINNED_MOBILE_HREFS.includes(i.href));
  const overflowItems = filteredItems.filter((i) => !PINNED_MOBILE_HREFS.includes(i.href));
  const hasOverflow = overflowItems.length > 0;
  const overflowActive = overflowItems.some((i) => pathname.startsWith(i.href));

  const [sheetOpen, setSheetOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const firstSheetLinkRef = useRef<HTMLAnchorElement>(null);

  // Close sheet on route change
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Escape key + focus management while open
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    firstSheetLinkRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  // Return focus to trigger when closing
  useEffect(() => {
    if (!sheetOpen) moreBtnRef.current?.focus({ preventScroll: true });
  }, [sheetOpen]);
```

Then replace the old mobile nav JSX with:

```tsx
      {/* Mobile bottom tab bar */}
      <nav
        aria-label="ניווט ראשי"
        className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-bottom"
      >
        <div className="flex items-center h-16 px-2">
          {pinnedItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = getIcon(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1.5
                  transition-colors duration-150
                  ${isActive ? "text-primary" : "text-muted-foreground"}
                `}
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                <span
                  className={`text-[10px] truncate leading-none max-w-full px-0.5 ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {hasOverflow && (
            <button
              ref={moreBtnRef}
              type="button"
              aria-label="עוד אפשרויות ניווט"
              aria-expanded={sheetOpen}
              aria-controls="mobile-more-sheet"
              onClick={() => setSheetOpen((v) => !v)}
              className={`
                flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1.5
                transition-colors duration-150
                ${overflowActive || sheetOpen ? "text-primary" : "text-muted-foreground"}
              `}
            >
              <MoreHorizontal
                className="h-5 w-5"
                strokeWidth={overflowActive || sheetOpen ? 2.25 : 1.75}
              />
              <span
                className={`text-[10px] truncate leading-none max-w-full px-0.5 ${
                  overflowActive || sheetOpen ? "font-semibold" : "font-medium"
                }`}
              >
                עוד
              </span>
            </button>
          )}
        </div>
      </nav>

      {hasOverflow && sheetOpen && (
        <>
          <div
            data-testid="mobile-more-scrim"
            aria-hidden="true"
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 bottom-16 bg-black/40 z-40 md:hidden animate-fade-in"
          />
          <div
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="ניווט משני"
            className="fixed bottom-16 inset-x-0 z-[60] md:hidden bg-white border-t border-border rounded-t-2xl shadow-lg pb-[env(safe-area-inset-bottom)] animate-fade-in"
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="grid grid-cols-4 gap-1 p-3" dir="rtl">
              {overflowItems.map((item, idx) => {
                const isActive = pathname.startsWith(item.href);
                const Icon = getIcon(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={idx === 0 ? firstSheetLinkRef : undefined}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setSheetOpen(false)}
                    className={`
                      flex flex-col items-center justify-center gap-1 min-h-16 rounded-lg py-2 px-1
                      transition-colors
                      ${isActive ? "text-primary bg-primary-light" : "text-muted-foreground hover:bg-gray-50"}
                    `}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} />
                    <span
                      className={`text-[10px] leading-tight text-center ${
                        isActive ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
```

- [ ] **Step 5: Run tests to verify the two new tests pass**

Run: `npm test -- --run src/__tests__/sidebar.test.tsx`
Expected: all 3 tests (smoke + 2 mobile) PASS.

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `npm test -- --run`
Expected: ALL tests pass (pre-existing suites untouched).

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/sidebar.tsx src/__tests__/sidebar.test.tsx
git commit -m "feat(sidebar): add 'עוד' sheet for mobile nav overflow"
```

---

## Task 3: Guest filter + no-overflow edge case

Ensures the mobile nav respects the existing `filteredItems` guest filter (latent bug fix) and that the "עוד" button is hidden when there's nothing to overflow.

**Files:**
- Modify: `src/__tests__/sidebar.test.tsx`

> ✅ **Note:** Task 2 already swapped the mobile block from `items` to `filteredItems`, so these tests should pass against the existing implementation. The point of this task is to *lock in* that behavior with regression tests.

- [ ] **Step 1: Add guest + no-overflow tests**

Append to `src/__tests__/sidebar.test.tsx`:

```tsx
describe("Sidebar — guest & overflow edge cases", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("hides /dashboard/import and /dashboard/candidates from pinned AND sheet when isGuest", () => {
    render(<Sidebar items={FULL_ITEMS} isGuest />);

    // Not in pinned row
    expect(document.querySelector('a[href="/dashboard/import"]')).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/dashboard/candidates"]')).not.toBeInTheDocument();

    // Also not in sheet after opening
    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));
    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    expect(sheet.querySelector('a[href="/dashboard/import"]')).not.toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/candidates"]')).not.toBeInTheDocument();

    // Sheet still contains the remaining 2 (cert-types, reports)
    expect(sheet.querySelector('a[href="/dashboard/cert-types"]')).toBeInTheDocument();
    expect(sheet.querySelector('a[href="/dashboard/reports"]')).toBeInTheDocument();
  });

  it("hides the 'עוד' button when there are no overflow items", () => {
    const pinnedOnly: NavItem[] = FULL_ITEMS.filter((i) =>
      ["/dashboard", "/dashboard/employees", "/dashboard/certifications", "/dashboard/tasks"].includes(i.href)
    );
    render(<Sidebar items={pinnedOnly} />);

    expect(screen.queryByRole("button", { name: "עוד אפשרויות ניווט" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --run src/__tests__/sidebar.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sidebar.test.tsx
git commit -m "test(sidebar): lock in guest filter and no-overflow handling"
```

---

## Task 4: Active highlighting for "עוד"

When the user is on a route belonging to an overflow item (e.g., `/dashboard/reports`), the "עוד" button should render in the active style.

**Files:**
- Modify: `src/__tests__/sidebar.test.tsx`

> ✅ **Note:** Task 2 already implemented `overflowActive`. This task adds the regression test.

- [ ] **Step 1: Add active-state test**

Append to `src/__tests__/sidebar.test.tsx`:

```tsx
describe("Sidebar — active highlight on 'עוד'", () => {
  it("renders 'עוד' with active styling when pathname is in overflow set", () => {
    mockPathname = "/dashboard/reports";
    render(<Sidebar items={FULL_ITEMS} />);

    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn.className).toContain("text-primary");
  });

  it("renders 'עוד' with inactive styling when pathname is in pinned set", () => {
    mockPathname = "/dashboard/employees";
    render(<Sidebar items={FULL_ITEMS} />);

    const moreBtn = screen.getByRole("button", { name: "עוד אפשרויות ניווט" });
    expect(moreBtn.className).toContain("text-muted-foreground");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --run src/__tests__/sidebar.test.tsx`
Expected: all 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sidebar.test.tsx
git commit -m "test(sidebar): assert active highlight on overflow routes"
```

---

## Task 5: Close triggers — Escape, scrim, item tap, route change

All four ways to close the sheet. Task 2 already wired every trigger; this task locks them in with tests.

**Files:**
- Modify: `src/__tests__/sidebar.test.tsx`

- [ ] **Step 1: Add close-trigger tests**

Append to `src/__tests__/sidebar.test.tsx`:

```tsx
describe("Sidebar — sheet close triggers", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  function openSheet() {
    fireEvent.click(screen.getByRole("button", { name: "עוד אפשרויות ניווט" }));
  }

  it("closes sheet on Escape key", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    openSheet();
    expect(screen.getByRole("dialog", { name: "ניווט משני" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "עוד אפשרויות ניווט" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("closes sheet when scrim is clicked", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    openSheet();

    fireEvent.click(screen.getByTestId("mobile-more-scrim"));

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
  });

  it("closes sheet when a sheet item is tapped", () => {
    render(<Sidebar items={FULL_ITEMS} />);
    openSheet();

    const sheet = screen.getByRole("dialog", { name: "ניווט משני" });
    const reportsLink = sheet.querySelector('a[href="/dashboard/reports"]') as HTMLElement;
    fireEvent.click(reportsLink);

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
  });

  it("closes sheet when pathname changes", () => {
    const { rerender } = render(<Sidebar items={FULL_ITEMS} />);
    openSheet();
    expect(screen.getByRole("dialog", { name: "ניווט משני" })).toBeInTheDocument();

    // Simulate route change by flipping the mock and re-rendering
    mockPathname = "/dashboard/reports";
    rerender(<Sidebar items={FULL_ITEMS} />);

    expect(screen.queryByRole("dialog", { name: "ניווט משני" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --run src/__tests__/sidebar.test.tsx`
Expected: all 11 tests PASS.

> ⚠ **If the Escape or route-change test fails**: the `useEffect` hook in `Sidebar` may have a dependency array mistake. Verify it's `[pathname]` for the route-change effect and `[sheetOpen]` for the Escape-key effect (per Task 2 Step 4).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/sidebar.test.tsx
git commit -m "test(sidebar): cover all four sheet-close triggers"
```

---

## Task 6: Type-check + full test suite + build gate

Before moving to manual verification, make sure the whole codebase is green.

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any before continuing.

- [ ] **Step 2: Full test suite**

Run: `npm test -- --run`
Expected: ALL tests pass across every suite.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no errors. Warnings about unused imports in other files (if any) are OK to ignore — new code must be warning-free.

- [ ] **Step 4: Commit (only if step 1-3 surfaced fixes)**

If any step required edits, run:
```bash
git add -u
git commit -m "chore(sidebar): fix type/build errors after mobile nav work"
```
Otherwise skip this step — no commit needed.

---

## Task 7: Manual verification in preview

Exercise the sheet interactively at the target mobile widths and capture screenshots for the PR.

**Tools:** `preview_start`, `preview_resize`, `preview_click`, `preview_eval`, `preview_screenshot`, `preview_network`.

- [ ] **Step 1: Start the dev server**

Use `preview_start` with the `certimanager` launch config. Confirm the server comes up.

- [ ] **Step 2: Log in**

Navigate the preview to `/login`, fill email `admin@certimanager.co.il`, password `Test123456`, submit.

- [ ] **Step 3: 320×700 viewport**

`preview_resize` to `{ width: 320, height: 700 }`.

Verify, using `preview_eval`:
```js
document.documentElement.scrollWidth === window.innerWidth
```
Expected: `true`.

- [ ] **Step 4: 320px — Open sheet, tap each overflow item**

`preview_click` on the "עוד" button. `preview_screenshot` the sheet-open state (attach to PR).
Tap each of the 4 sheet items in turn; verify the URL updates and the sheet closes automatically (use `preview_inspect` on the dialog to assert it's gone).

- [ ] **Step 5: 320px — Active state on "עוד"**

Navigate to `/dashboard/reports`. `preview_inspect` the "עוד" button; its `className` must contain `text-primary`. `preview_screenshot` and attach.

- [ ] **Step 6: 375×812 viewport repeat**

`preview_resize` to `{ width: 375, height: 812 }`. Re-run steps 3 and 4. Attach screenshot.

- [ ] **Step 7: 414×896 viewport spot check**

`preview_resize` to `{ width: 414, height: 896 }`. Re-run step 3 only (overflow check).

- [ ] **Step 8: 768×1024 desktop check**

`preview_resize` to `{ width: 768, height: 1024 }`. Confirm: (a) no bottom nav visible; (b) desktop sidebar renders with all 8 items visible in a vertical list. `preview_screenshot` and attach.

- [ ] **Step 9: Record verification results**

Keep the screenshot paths handy — they go into the PR body in Task 8.

No commit for this task (screenshots only; nothing in-repo changes).

---

## Task 8: Open the pull request

Push the branch, open a PR against `master`, attach the screenshots. **Do NOT merge** — user approval gate.

- [ ] **Step 1: Push branch**

```bash
git push -u origin fix/mobile-nav-all-tabs
```

- [ ] **Step 2: Open the PR via gh**

```bash
gh pr create --title "fix(mobile-nav): reach all 8 tabs via '4 pinned + עוד' sheet" --body "$(cat <<'EOF'
## Summary
- Adds a mobile bottom-sheet pattern so all 8 dashboard destinations are reachable on phones (root cause: a hardcoded 5-route whitelist in the mobile nav).
- 4 pinned tabs (לוח בקרה · עובדים · הסמכות · משימות) + "עוד" trigger opening a bottom sheet with the remaining 4 (סוגי הסמכות · מועמדים לקורסים · ייבוא · דוחות).
- Fixes latent guest-filter bypass — the mobile nav now uses `filteredItems` so guests no longer see links to `/dashboard/import` or `/dashboard/candidates`.

## Design spec
`docs/superpowers/specs/2026-04-15-mobile-nav-all-tabs-design.md`

## Test plan
- [x] 11 new unit tests in `src/__tests__/sidebar.test.tsx` (smoke, reachability, guest filter, no-overflow, active highlight, 4 close triggers)
- [x] `npm test -- --run` passes
- [x] `npm run build` passes
- [x] `npx tsc --noEmit` clean
- [x] Preview: 320px — all 8 reachable, no horizontal scroll, active highlight on "עוד" when on overflow route
- [x] Preview: 375px — same checks
- [x] Preview: 414px — overflow check
- [x] Preview: 768px — desktop sidebar unchanged
- [ ] Awaiting user approval before merge

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Return the PR URL to the user**

Paste the PR URL into the chat. **Stop and wait for user approval before merging.**

---

## Known pitfalls

- **Don't amend earlier commits.** Each task ends with a fresh commit. Hooks catch issues → fix and add a new commit.
- **`preview_resize` is per-tab state.** Re-issue it after navigation if the viewport resets.
- **Hebrew RTL note.** The dashboard layout applies `dir="rtl"` at the outer wrapper; the mobile nav inherits. No per-element RTL flip is needed in the new markup.
- **Icon colors.** Tailwind's `text-primary` requires the primary colors to be defined (they are, in the existing codebase). Don't switch to arbitrary color values.
- **`safe-area-bottom` is a project-defined utility**, not built-in Tailwind. Keep the class name as-is.

---

## Done criteria (verbatim from spec)

- [ ] All 8 destinations reachable from a 320px mobile viewport with no URL typing.
- [ ] No horizontal scroll at 320/375/414px.
- [ ] Active-route highlight works for pinned tabs and for "עוד" (when on overflow route).
- [ ] Desktop sidebar identical to pre-change behavior.
- [ ] New Vitest suite passes (all 11 test cases in `sidebar.test.tsx`).
- [ ] `npm run build` and `npm test` pass.
- [ ] PR opened against `master` from `fix/mobile-nav-all-tabs`, screenshots attached, not merged without user approval.
