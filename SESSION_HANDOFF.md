# CertiManager - Session Handoff Document

> Last updated: 2026-04-10
> Purpose: Complete context for continuing development in a new Claude Code session

---

## 1. What Is CertiManager?

A **certification tracking web app** for a construction/infrastructure manager overseeing ~150 employees. Each employee needs multiple time-limited certifications (e.g., "עבודה בגובה" / working at heights, "נתי"ע", "כביש 6", "PFI"). The app tracks who has what, when it expires, and who's missing certifications.

**Live URL:** https://certimanager.co.il
**Repo:** https://github.com/Maores/certimanager (private)
**Branch:** `master` (production, auto-deploys)

---

## 2. User Profile

- **Role:** Manager responsible for ~150 employees with time-limited certifications
- **Web dev experience:** Beginner — needs guidance and explanations
- **Language:** Hebrew UI required for daily use; understands basic/average English
- **Location:** Israel (GMT+3)
- **Budget:** Free/low-cost tools and hosting only
- **Mobile:** Critical — manager works in the field
- **Preference:** Working solution fast, no over-engineering

---

## 3. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | **Next.js 16.2.2** (App Router) | Uses Turbopack. AGENTS.md warns: "This is NOT the Next.js you know" — check `node_modules/next/dist/docs/` for breaking changes |
| React | **React 19.2.4** | Server components, server actions (`"use server"`) |
| Database | **Supabase** (PostgreSQL) | RLS enabled, `manager_id` scoping on all tables |
| Auth | **Supabase Auth** | Email/password, auto-creates manager profile via trigger |
| Storage | **Supabase Storage** | `cert-images` bucket for certification file uploads |
| Styling | **Tailwind CSS v4** | CSS variables for theming, RTL Hebrew layout |
| Excel Import | **xlsx** (SheetJS) | Parses employee/cert data from Excel files |
| Icons | **lucide-react** | Used throughout the UI |
| Hosting | **Render** (Web Service) | Auto-deploys from master. Build: `npm install && npm run build` |

---

## 4. Database Schema

### Tables

```sql
managers (id UUID PK -> auth.users, email, full_name, created_at)
employees (id UUID PK, manager_id FK, first_name, last_name, employee_number, department, phone, email, status DEFAULT 'פעיל', notes, created_at, updated_at)
cert_types (id UUID PK, manager_id FK, name, default_validity_months DEFAULT 12, description, created_at)
certifications (id UUID PK, employee_id FK, cert_type_id FK, issue_date DATE NULL, expiry_date DATE NULL, image_url, notes, created_at, updated_at)
```

### Key Constraints
- `employees(manager_id, employee_number)` — unique per manager
- `cert_types(manager_id, name)` — unique per manager
- `certifications.cert_type_id` — `ON DELETE RESTRICT` (can't delete cert type with existing certs... but guest mode cascade-deletes in-memory)
- RLS: Every table has `manager_id = auth.uid()` policy

### Schema Files
- `supabase/schema.sql` — Full initial schema (tables, RLS, triggers, storage)
- `supabase/migration_phase3.sql` — Added `status` column, nullable dates, unique indexes

### Current Production Data
- **149 employees** (imported from Excel)
- **85 certifications** (most without dates — imported without issue/expiry data)
- **5 cert types:** PFI, כביש 6, כביש 6 + נתי"ע, נתי"ע, עבודה בגובה
- **1 department:** הנדסה
- **1 admin user:** admin@certimanager.co.il / Test123456

---

## 5. Project Structure

```
src/
├── app/
│   ├── layout.tsx                          # Root layout with RTL dir, Hebrew font
│   ├── page.tsx                            # Landing -> redirects to /dashboard
│   ├── not-found.tsx
│   ├── login/
│   │   ├── page.tsx                        # Login page
│   │   ├── login-form.tsx                  # Client component with guest login
│   │   └── actions.ts                      # login(), guestLogin(), logout()
│   ├── auth/callback/route.ts              # OAuth callback (open redirect patched)
│   └── dashboard/
│       ├── layout.tsx                      # Sidebar + top bar layout
│       ├── page.tsx                        # Dashboard home — stats cards
│       ├── error.tsx / loading.tsx
│       ├── employees/
│       │   ├── page.tsx                    # Employee list with search/filter
│       │   ├── actions.ts                  # CRUD + bulk delete
│       │   ├── new/page.tsx                # New employee form
│       │   └── [id]/
│       │       ├── page.tsx                # Employee detail + certs
│       │       ├── edit/page.tsx           # Edit employee form
│       │       ├── delete-button.tsx
│       │       ├── cert-file-viewer.tsx
│       │       └── certifications/new/page.tsx
│       ├── certifications/
│       │   ├── page.tsx                    # Cert list with filters
│       │   ├── actions.ts                  # CRUD + image upload/delete
│       │   ├── new/page.tsx                # New cert (employee + type dropdowns)
│       │   └── [id]/edit/page.tsx          # Edit cert
│       ├── cert-types/
│       │   ├── page.tsx                    # Cert type list + inline create form
│       │   ├── actions.ts                  # CRUD with validation
│       │   └── [id]/edit/page.tsx          # Edit cert type
│       ├── import/
│       │   ├── page.tsx                    # Import wizard wrapper
│       │   └── actions.ts                  # Excel parse + upsert logic
│       └── reports/page.tsx                # Stats, timeline, dept breakdown
├── components/
│   ├── layout/sidebar.tsx                  # Navigation sidebar
│   ├── employees/
│   │   ├── employee-form.tsx               # Shared create/edit form
│   │   ├── employee-list-client.tsx        # Client-side search/filter/sort
│   │   └── confirm-delete-dialog.tsx
│   ├── certifications/certification-form.tsx
│   ├── import/
│   │   ├── import-wizard.tsx               # 3-step wizard state machine
│   │   ├── upload-step.tsx / review-step.tsx / summary-step.tsx
│   └── ui/
│       ├── delete-button.tsx               # Reusable delete with confirm
│       ├── auto-submit-select.tsx
│       └── file-viewer.tsx
├── lib/
│   ├── supabase/client.ts                  # Browser Supabase client
│   ├── supabase/server.ts                  # Server Supabase client (cookies)
│   ├── guest-session.ts                    # Cookie-based guest session management
│   ├── guest-store.ts                      # In-memory data store for guest mode
│   └── excel-parser.ts                     # Excel -> employee/cert parser
├── middleware.ts                           # Auth gate + guest session validation
├── types/database.ts                       # TS interfaces + helper functions
└── globals.css                             # Tailwind + CSS variables
```

---

## 6. Architecture Patterns

### Multi-Tenancy
- **Every query** must filter by `manager_id = user.id`
- Supabase RLS is defense-in-depth, but app-level filtering is the primary guard
- Server actions in `actions.ts` files handle auth checks + `manager_id` scoping
- Page-level data fetching (in `page.tsx`) ALSO needs `manager_id` — this was a major bug source (fixed 2026-04-10)

### Guest Mode
- In-memory `Map<string, GuestData>` on the server (NOT in a database)
- Cookie: `guest_session` (httpOnly, session-scoped)
- `getGuestSessionId()` validates cookie against server-side Map via `hasGuestSession()`
- Max 100 concurrent guest sessions (LRU eviction)
- Guest data includes seeded sample employees, cert types, certifications
- Guest mode and authenticated mode share the same UI — branching happens via `if (guestSid) { ... } else { ... }`
- **Gotcha:** Middleware runs in Edge runtime, API routes in Node runtime — different `globalThis`. Guest sessions set via API routes won't be visible to middleware. Only server actions (same runtime) work for guest login.

### Server Actions Pattern
Every `actions.ts` file follows this pattern:
```typescript
export async function doSomething(formData: FormData) {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    // In-memory operation
    guestDoSomething(guestSid, ...);
    redirect("/dashboard/...");
  }
  // Supabase operation
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // ... query with .eq("manager_id", user.id)
}
```

### Page Data Loading Pattern
```typescript
export default async function SomePage() {
  const guestSid = await getGuestSessionId();
  if (guestSid) {
    // Load from in-memory store
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    // Load from Supabase with .eq("manager_id", user!.id)
  }
}
```
Note: Must use `user!.id` (non-null assertion) after the redirect guard because TypeScript can't narrow after `redirect()`. Do NOT use dynamic `await import("next/navigation")` — it breaks TypeScript control flow narrowing.

---

## 7. What Was Done in Recent Sessions

### Session 2026-04-10: QA Audit + Security Fixes (28 bugs)

**CRITICAL — Tenant Isolation (7 pages fixed):**
All page-level data fetching was missing `manager_id` filters, allowing cross-tenant data leakage via URL manipulation. Fixed in all employee, certification, and cert-type pages.

**HIGH — Security:**
- Open redirect in OAuth callback patched (validates `next` param is relative path)
- Guest session cookie validation against server-side Map + `crypto.randomUUID()`
- Max 100 guest sessions with LRU eviction
- Cascade delete certifications when deleting cert type in guest mode
- Ownership checks on `updateCertification`, `getSignedUrl`, `deleteCertImage`
- Security headers: X-Frame-Options DENY, HSTS, nosniff, Referrer-Policy

**MEDIUM — Validation:**
- Server-side input validation + trim on employee create
- NaN guard on `default_validity_months`, Hebrew error messages
- Empty array guards on `.in()` calls in import actions
- Fixed "10MB" -> "5MB" file size error message

**LOW — UX:**
- Error state display on employee and certification forms
- `formatDateHe()` timezone off-by-one fix
- Renamed "מספר עובד" -> "מספר זהות/דרכון" everywhere
- Removed "ציות" (compliance) section from reports page

### Session 2026-04-05-07: Phase 3 Bulk Import
- Built 3-step Excel import wizard
- Imported 148 workers from 7 Excel sheets with 4 cert types
- Parser handles Hebrew gershayim, deduplication by employee_number

### Earlier Sessions: Core App Build
- Full CRUD for employees, certifications, cert types
- Dashboard with stats, guest mode, reports page
- Mobile responsive Hebrew RTL UI

---

## 8. What Works (Complete Features)

- Full CRUD for employees, certifications, cert types
- Excel bulk import (3-step wizard)
- Guest mode with seeded data
- Reports dashboard (stats, expiry timeline, department breakdown, missing certs)
- Search/filter on employees and certifications
- Bulk delete employees
- Certificate image upload to Supabase Storage
- Hebrew RTL UI throughout
- Mobile responsive (bottom tab bar, card views)
- Security headers, tenant isolation, input validation
- Loading skeletons on all list pages
- Error boundaries with retry
- Delete confirmations
- Duplicate detection on cert creation
- Auto-expiry calculation from issue date + cert type validity

---

## 9. Known Issues & Technical Debt

1. **`middleware.ts` deprecation** — Next.js 16 says "middleware" is deprecated, use "proxy". Works for now.
2. **Storage RLS too permissive** — Any authenticated user can access any file in `cert-images`. Should scope to manager's employees' certs.
3. **No pagination** — All records load at once. Will be slow at 1000+ employees.
4. **`any` types everywhere** — Should use proper TypeScript interfaces from `database.ts`.
5. **No tests** — Zero unit, integration, or e2e tests.
6. **No registration page** — Admin account created manually in Supabase Auth dashboard.
7. **No password reset** — No forgot password flow.
8. **Employee status not wired** — `status` column exists (פעיל/חל"ת/פוטר) but not integrated into reports/filters.

### Gotchas to Remember
- **`<form>` alignment:** Add `className="flex"` to `<form>` elements inside flex containers
- **Phone/email in RTL:** Use `<span dir="ltr" className="inline-block">` around values
- **Excel parser:** Hebrew gershayim `״` (U+05F4) vs ASCII `"` — parser normalizes these
- **Employee numbers:** Treated as strings (leading zeros)
- **`redirect()` in try/catch:** Don't wrap — it throws NEXT_REDIRECT intentionally
- **Render cold starts:** 30-60s after inactivity on free tier

---

## 10. Feature Roadmap & Next Steps

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Visual polish | DONE | Mobile UX, loading, errors |
| 2 | Cert image upload | DONE | Supabase Storage |
| 3a | Bulk import (Excel) | DONE | 148 workers imported |
| 3b | Reports | DONE | Stats, timeline, dept breakdown |
| 3c | Search & filter | DONE | Employees + certifications |
| 4 | Export (Excel/PDF) | NOT STARTED | `xlsx` library already installed |
| 5 | Expiration reminders | NOT STARTED | Needs email service + cron |
| 6 | Deploy | DONE | Live on Render |

### Recommended Next Development Tasks (Priority Order)
1. **Export to Excel** — Use `xlsx` library to generate downloadable reports (employee list, cert status, missing certs)
2. **Employee status integration** — Wire `status` (פעיל/חל"ת/פוטר) into reports, filters, and dashboard stats
3. **Expiration email reminders** — Set up Resend/SendGrid + Render cron job or Supabase Edge Function
4. **Pagination** — Server-side cursor pagination for employee and cert lists
5. **Type safety** — Replace `any` with proper TS interfaces
6. **Tests** — Integration tests for server actions, at minimum
7. **Storage RLS** — Scope file access to manager's employees' certs only
8. **Registration + password reset** — Self-service signup and forgot password flows

### Potential Debugging Areas
- **Import edge cases** — New Excel formats, different sheet structures, non-standard employee numbers
- **Date handling** — `formatDateHe()` was buggy before; if dates look wrong, check timezone parsing in `database.ts`
- **Guest mode memory leaks** — If server runs long, guest sessions accumulate (LRU helps but monitor)
- **Middleware -> proxy migration** — Next.js 16 deprecation, will need to migrate eventually
- **File upload size** — Currently 5MB limit, may need adjustment for large PDF certs

---

## 11. Environment Setup

```bash
# Clone and install
git clone https://github.com/Maores/certimanager.git
cd certimanager
npm install

# Environment variables (create .env.local)
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>

# Run locally
npm run dev        # http://localhost:3000

# Build
npm run build      # Verifies TypeScript + compiles

# Deploy
git push origin master   # Auto-deploys to Render
```

---

## 12. Key Files Quick Reference

| What | File |
|------|------|
| Database types & helpers | `src/types/database.ts` |
| Supabase server client | `src/lib/supabase/server.ts` |
| Auth middleware | `src/middleware.ts` |
| Guest session logic | `src/lib/guest-session.ts` + `src/lib/guest-store.ts` |
| Excel parser | `src/lib/excel-parser.ts` |
| Employee CRUD | `src/app/dashboard/employees/actions.ts` |
| Certification CRUD | `src/app/dashboard/certifications/actions.ts` |
| Cert type CRUD | `src/app/dashboard/cert-types/actions.ts` |
| Import logic | `src/app/dashboard/import/actions.ts` |
| Reports page | `src/app/dashboard/reports/page.tsx` |
| Dashboard layout | `src/app/dashboard/layout.tsx` |
| DB schema | `supabase/schema.sql` + `supabase/migration_phase3.sql` |
| Security headers | `next.config.ts` |

---

## 13. Claude Code Behavior Preferences

- **ALWAYS** use installed skills (Superpowers/Octopus) before starting work. Announce which skill.
- **ALWAYS** verify visual fixes work — test in browser, don't just add CSS.
- Keep commits descriptive in English, referencing what changed and why.
- Mobile-first approach for all UI work.
- Hebrew UI, English code.
- Explain architecture decisions for the beginner developer user.
