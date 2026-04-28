# Mobile Navigation — All 8 Tabs Reachable — Design Spec

**Date:** 2026-04-15
**Project:** CertiManager
**Branch:** `fix/mobile-nav-all-tabs`
**Status:** Approved

---

## Overview

The desktop sidebar lists 8 navigation items; the mobile bottom bar only shows 5 (a hardcoded whitelist filter). Three destinations — `סוגי הסמכות`, `מועמדים לקורסים`, and `ייבוא` — are unreachable on a phone without typing the URL.

This spec fixes the reachability bug using the iOS/Android "tab bar + More sheet" pattern: **4 pinned tabs + an "עוד" button that opens a bottom sheet containing the remaining items**.

A latent secondary bug is fixed alongside it: the current mobile nav uses raw `items` instead of `filteredItems`, bypassing the guest filter that hides `/dashboard/import` and `/dashboard/candidates`.

---

## Root Cause

[src/components/layout/sidebar.tsx:112-115](src/components/layout/sidebar.tsx#L112) — the mobile nav hardcodes a 5-route whitelist:

```tsx
items
  .filter(item =>
    ["/dashboard", "/dashboard/employees", "/dashboard/certifications", "/dashboard/tasks", "/dashboard/reports"].includes(item.href)
  )
```

The `iconMap` already supports all 8 items. The bug is purely a filter choice, not an icon or layout limitation.

---

## Target Behavior

### Pinned split

| Position | Label | Href | Icon |
|---|---|---|---|
| 1 | לוח בקרה | `/dashboard` | `LayoutDashboard` |
| 2 | עובדים | `/dashboard/employees` | `Users` |
| 3 | הסמכות | `/dashboard/certifications` | `Award` |
| 4 | משימות | `/dashboard/tasks` | `ClipboardList` |
| 5 | **עוד** | *(button, not a route)* | `MoreHorizontal` |

### Sheet contents (opens on tap of "עוד")

| Label | Href | Icon |
|---|---|---|
| סוגי הסמכות | `/dashboard/cert-types` | `Tag` |
| מועמדים לקורסים | `/dashboard/candidates` | `GraduationCap` |
| ייבוא | `/dashboard/import` | `FileUp` |
| דוחות | `/dashboard/reports` | `BarChart3` |

Sheet layout: 4-column grid (icon stacked over label), styled to match the bottom-bar tab pattern. RTL order: סוגי הסמכות is right-most.

### Dynamic behavior

| Trigger | Effect |
|---|---|
| Tap "עוד" (closed) | Sheet opens; focus moves to first sheet item; `aria-expanded="true"` |
| Tap "עוד" (open) | Sheet closes; focus returns to "עוד" button |
| Tap scrim | Sheet closes |
| Press Escape | Sheet closes |
| Tap a sheet item | Navigation occurs; sheet closes |
| Route change (any cause) | Sheet closes (`useEffect` on `pathname`) |
| Current route is in overflow set | "עוד" button renders with active styling (blue, semi-bold label) |

### Edge case: guest user (fewer items)

`filteredItems` for a guest excludes `/dashboard/import` and `/dashboard/candidates`, yielding 6 items. Rule:

- If `overflowItems.length === 0` → render all pinned items, **no "עוד" button**. (Never actually triggered with the current split — included for resilience.)
- If `overflowItems.length > 0` → render 4 pinned + "עוד".

For a guest: 4 pinned + "עוד" → sheet contains 2 items (`סוגי הסמכות`, `דוחות`). Sheet still renders as a grid; 4-column grid tolerates 2 items (left-aligned in RTL).

---

## Implementation

### File: `src/components/layout/sidebar.tsx`

**Add constant at module top:**
```tsx
const PINNED_MOBILE_HREFS = [
  "/dashboard",
  "/dashboard/employees",
  "/dashboard/certifications",
  "/dashboard/tasks",
];
```

**In the `Sidebar` component body (replacing the current mobile-nav block):**
```tsx
const pinnedItems = filteredItems.filter(i => PINNED_MOBILE_HREFS.includes(i.href));
const overflowItems = filteredItems.filter(i => !PINNED_MOBILE_HREFS.includes(i.href));
const hasOverflow = overflowItems.length > 0;

const [sheetOpen, setSheetOpen] = useState(false);

useEffect(() => {
  setSheetOpen(false);
}, [pathname]);

useEffect(() => {
  if (!sheetOpen) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [sheetOpen]);

const overflowActive = overflowItems.some(i => pathname.startsWith(i.href));
```

**Imports added:**
```tsx
import { useState, useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
```

**Mobile nav JSX structure:**
```tsx
<nav aria-label="ניווט ראשי" className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-sm border-t border-border z-50 md:hidden safe-area-bottom">
  <div className="flex items-center h-16 px-2 relative">
    {pinnedItems.map(item => (/* existing tab markup */))}

    {hasOverflow && (
      <button
        type="button"
        aria-label="עוד אפשרויות ניווט"
        aria-expanded={sheetOpen}
        aria-controls="mobile-more-sheet"
        onClick={() => setSheetOpen(v => !v)}
        className={/* flex-col tab styling, active when overflowActive || sheetOpen */}
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={overflowActive ? 2.25 : 1.75} />
        <span className="text-[10px] ...">עוד</span>
      </button>
    )}
  </div>
</nav>

{hasOverflow && sheetOpen && (
  <>
    <div
      onClick={() => setSheetOpen(false)}
      className="fixed inset-0 bottom-16 bg-black/40 z-40 md:hidden animate-fade-in"
      aria-hidden="true"
    />
    <div
      id="mobile-more-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="ניווט משני"
      className="fixed bottom-16 inset-x-0 z-[60] md:hidden bg-white border-t border-border rounded-t-2xl shadow-lg pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex justify-center pt-2 pb-1"><div className="w-8 h-1 rounded-full bg-gray-300" /></div>
      <div className="grid grid-cols-4 gap-1 p-3" dir="rtl">
        {overflowItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            onClick={() => setSheetOpen(false)}
            className={/* icon + label, tap target min-h-16 */}
          >
            <Icon />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  </>
)}
```

### Focus management

- On sheet open: `useRef` on first sheet link, `.focus()` inside an effect keyed on `sheetOpen`.
- On sheet close: `.focus()` back on the "עוד" button ref.
- Escape key and scrim click use the same `setSheetOpen(false)` path.

### Animation

CSS transitions only (no new JS libraries). Sheet: `translate-y-full` → `translate-y-0` with `transition-transform duration-200 ease-out`. Scrim: `opacity-0` → `opacity-100` same duration. Existing `animate-fade-in` utility reused.

### Z-index budget

- Scrim: `z-40` (covers page content; nav sits above it — iOS pattern)
- Nav bar: `z-50` (existing, unchanged)
- Sheet panel: `z-[60]` (explicitly above the nav, so render-order of the JSX tree is irrelevant; the sheet is positioned at `bottom-16` so it stacks directly atop the nav without visual overlap)

---

## Constraints Preserved

| Constraint | How |
|---|---|
| No new dependencies | Reuses lucide-react, adds only `MoreHorizontal` import |
| RTL order | Container stays `dir="rtl"` on dashboard layout; grid + flex order follows |
| Safe-area bottom | Nav keeps `safe-area-bottom` class; sheet uses `pb-[env(safe-area-inset-bottom)]` |
| Desktop sidebar untouched | Only the `md:hidden` mobile block changes |
| Active-route highlighting | Preserved for pinned tabs; extended to "עוד" button |
| Guest filter | Now applies to mobile path (fixes latent bug) |

---

## Tests

**New file:** `src/__tests__/sidebar.test.tsx`

Scenarios:

1. **Renders 4 pinned + "עוד"** — given full 8-item `items` array on mobile viewport, the nav contains 4 tab links plus a button with `aria-label="עוד אפשרויות ניווט"`.
2. **Sheet opens on tap** — clicking "עוד" sets `aria-expanded="true"` and reveals the remaining 4 links (all 8 hrefs now queryable via `getByRole("link")`).
3. **Guest filter applies** — with `isGuest={true}`, neither `/dashboard/import` nor `/dashboard/candidates` appears in pinned or (after opening) the sheet.
4. **"עוד" shows active state on overflow route** — render with `pathname = "/dashboard/reports"` (via Next's `usePathname` mock); "עוד" button has the active style.
5. **Escape closes sheet** — open sheet, dispatch `Escape` keydown, assert `aria-expanded="false"`.
6. **Sheet item navigation closes sheet** — open sheet, click a sheet link, assert sheet no longer in DOM.
7. **No "עוד" when no overflow** — given `items` that produce empty overflow (e.g., `PINNED_MOBILE_HREFS` superset of filtered items), button absent.
8. **Scrim click closes sheet** — open sheet, click the backdrop (role-agnostic query via `aria-hidden="true"` sibling), assert `aria-expanded="false"`.
9. **Route change closes sheet** — open sheet, re-render with a changed `usePathname` mock value, assert sheet not in DOM (covers the `useEffect` on `pathname`).

Mocks required: `next/navigation` (`usePathname`), already patterned in existing tests. Pattern reference: [src/__tests__/candidates-table.test.tsx](src/__tests__/candidates-table.test.tsx).

---

## Verification (manual, via preview_*)

1. `preview_start`; log in with admin credentials from your local credential store.
2. `preview_resize` to **320×700**, **375×812**, **414×896** in turn. At each width:
   - All 5 pinned slots visible (4 tabs + "עוד").
   - No horizontal overflow: `preview_eval` confirms `document.documentElement.scrollWidth === window.innerWidth`.
   - Tap "עוד" (`preview_click`) → sheet reveals 4 items.
   - Tap a sheet item → navigation occurs, URL updates, sheet closes.
3. Navigate to `/dashboard/candidates` → confirm "עוד" button renders in active state.
4. `preview_resize` to **768×1024** → desktop sidebar renders, no bottom nav, all 8 items visible in sidebar.
5. `preview_screenshot` at 320px, 375px (sheet open), 768px (desktop) for PR.

---

## Out of Scope

- Reordering the desktop sidebar.
- User-configurable pinned items.
- Persistent "last visited" re-ordering.
- Any visual redesign of the existing tab styling.
- Any change to `dashboard/layout.tsx` `navItems` list.

---

## Risk & Rollback

**Risk:** Low. Change is localized to one component's mobile render branch; desktop untouched; no DB or API changes; no new deps.

**Rollback:** Revert the single commit. The only behavioral change for users is additional reachability + the guest-filter fix.

---

## Done Criteria

- All 8 destinations reachable from a 320px mobile viewport with no URL typing.
- No horizontal scroll at 320/375/414px.
- Active-route highlight works for pinned tabs and for "עוד" (when on overflow route).
- Desktop sidebar identical to pre-change behavior.
- New Vitest suite passes (all 9 scenarios above).
- `npm run build` and `npm test` pass.
- PR opened against `master` from `fix/mobile-nav-all-tabs`, screenshots attached, **not merged without user approval**.
