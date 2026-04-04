# CertiManager — Session Handoff Document

## What Is This Project?

CertiManager is a **Certification Tracking and Renewal Management System** — a web app for Israeli managers to track ~150 employee certifications, expiration dates, and renewal reminders. It replaces a manual, error-prone process with a centralized, proactive management tool.

## User Profile

- **Role:** Manager responsible for ~150 employees with time-limited certifications
- **Web dev experience:** Beginner — needs guidance and explanations
- **Language:** Hebrew UI required for daily use; understands basic/average English
- **Location:** Israel (GMT+3)
- **Budget:** Free/low-cost tools and hosting only
- **Mobile:** Critical — manager works in the field
- **Preference:** Working solution fast, no over-engineering

## Tech Stack

| Layer       | Technology                          |
|-------------|--------------------------------------|
| Framework   | Next.js 16.2.2 (App Router)          |
| Language    | TypeScript                           |
| Database    | Supabase (PostgreSQL + Auth + Storage) |
| Styling     | Tailwind CSS v4                      |
| Auth        | Supabase Auth (email/password, PKCE) |
| Session     | @supabase/ssr (cookie-based)         |
| Hosting     | Vercel (planned, not yet deployed)   |

## Supabase Connection

```
NEXT_PUBLIC_SUPABASE_URL=https://uidxgisstzpsmepoatpm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZHhnaXNzdHpwc21lcG9hdHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDQ0NzksImV4cCI6MjA5MDc4MDQ3OX0.ebmKHRTmkpqP6r2oSZKQdXyZoHhr58A9Umvi95DkwF8
```

Test login: `test@certimanager.co.il` / `Test1234!`

## Database Schema

4 tables with RLS (Row Level Security) — each manager sees only their own data:

- **managers** — auto-created on signup via trigger, linked to `auth.users`
- **employees** — `manager_id` scoped, has name, number, department, phone, email, notes
- **cert_types** — certification types with `default_validity_months`
- **certifications** — links employee + cert_type, has issue_date, expiry_date, image_url, notes

Storage bucket: `cert-images` (private, authenticated upload/select).

Full schema in `supabase/schema.sql`.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                 # Root layout (Hebrew RTL: lang="he" dir="rtl")
│   ├── page.tsx                   # Redirects to /dashboard
│   ├── globals.css                # Tailwind + CSS variables + safe-area
│   ├── not-found.tsx              # Global 404 page (Hebrew)
│   ├── auth/callback/route.ts     # Supabase auth callback
│   ├── login/
│   │   ├── page.tsx               # Login page (gradient, shield icon)
│   │   ├── login-form.tsx         # Client component with useActionState
│   │   └── actions.ts             # login() and logout() server actions
│   └── dashboard/
│       ├── layout.tsx             # Auth check + sidebar + header
│       ├── page.tsx               # Dashboard home (real Supabase data)
│       ├── loading.tsx            # Dashboard skeleton loader
│       ├── error.tsx              # Error boundary with retry button
│       ├── not-found.tsx          # Dashboard 404
│       ├── employees/
│       │   ├── page.tsx           # Employee list (table desktop / cards mobile)
│       │   ├── loading.tsx        # Skeleton loader
│       │   ├── actions.ts         # CRUD server actions
│       │   ├── new/page.tsx       # Add employee form
│       │   └── [id]/
│       │       ├── page.tsx       # Employee detail + cert list
│       │       ├── edit/page.tsx  # Edit employee
│       │       ├── delete-button.tsx # Delete with confirmation
│       │       └── certifications/new/page.tsx # Add cert for this employee
│       ├── certifications/
│       │   ├── page.tsx           # Cert list with filter tabs + search
│       │   ├── loading.tsx        # Skeleton loader
│       │   ├── actions.ts         # CRUD + image upload server actions
│       │   ├── new/page.tsx       # Add new certification
│       │   └── [id]/edit/page.tsx # Edit certification
│       └── cert-types/
│           ├── page.tsx           # Cert types list with inline add form
│           ├── loading.tsx        # Skeleton loader
│           ├── actions.ts         # CRUD server actions
│           └── [id]/edit/page.tsx # Edit cert type
├── components/
│   ├── layout/sidebar.tsx         # Desktop sidebar + mobile bottom tab bar
│   ├── employees/employee-form.tsx # Reusable employee form
│   ├── certifications/certification-form.tsx # Cert form with duplicate detection
│   └── ui/delete-button.tsx       # Reusable inline delete confirmation
├── lib/supabase/
│   ├── server.ts                  # Server-side Supabase client (cookies)
│   └── client.ts                  # Browser-side Supabase client
├── types/database.ts              # TS interfaces + getCertStatus() + formatDateHe()
└── middleware.ts                  # Auth route protection
```

## What Works (Completed Features)

- **Authentication:** Login/logout with Supabase Auth, route protection via middleware
- **Employee CRUD:** Add, edit, delete, list, detail — with search
- **Certification CRUD:** Add, edit, delete, list — with status filter tabs (all/valid/expiring/expired)
- **Cert Types CRUD:** Add, edit, delete — with inline form
- **Dashboard:** Real-time stats (employee count, valid/expiring/expired cert counts), expiring-soon table
- **Duplicate Detection:** Warning when adding a cert type that already exists for an employee
- **Auto-Expiry Calc:** Selecting cert type + issue date auto-fills expiry date
- **Hebrew RTL UI:** Full Hebrew interface, proper RTL handling for phone/email fields
- **Mobile Responsive:** Bottom tab bar on mobile, card views on small screens, table on desktop
- **Loading Skeletons:** All list pages have animated loading states
- **Error Pages:** error.tsx (retry), not-found.tsx (Hebrew 404) at dashboard and root level
- **Delete Confirmations:** Inline "?בטוח" confirmation before deleting (employees, certs, cert-types)
- **Styled File Upload:** Dashed drop-zone with image icon and format hints

## Known Patterns & Gotchas

1. **`<form>` needs `className="flex"`** when inside flex containers — it's block-level and breaks alignment otherwise. This caused a bug 3 times.

2. **`redirect()` throws NEXT_REDIRECT** — server actions that call `redirect()` must NOT be wrapped in try/catch on the client side. The redirect error is intentional and propagates to trigger navigation.

3. **Phone/email in RTL** — use `<span dir="ltr" className="inline-block">` around the value, NOT `dir="ltr"` on the container `<dd>`.

4. **Dev server port:** User runs on port 3001 (`npm run dev -- -p 3001`).

5. **Supabase joins:** When selecting relations like `employees(first_name, last_name)`, the result type is `any` — cast appropriately.

## How to Run

```bash
npm install
npm run dev -- -p 3001
# Open http://localhost:3001
```

## Feature Roadmap (Agreed Order)

| # | Feature | Status |
|---|---------|--------|
| 1 | Visual polish (loading, errors, mobile nav, form UX) | **COMPLETED** |
| 2 | Certification image/file upload (Supabase Storage) | **NEXT** |
| 3 | Bulk operations + Reports/export + Search improvements | Pending |
| 4 | Automatic expiration reminders/alerts | Pending |
| 5 | Vercel deployment | Pending |

## Next Phase: #2 — Certification Image/File Upload

The form already has a styled file upload input and calls `uploadCertImage()` in `certifications/actions.ts`. What needs to be done:

- **Verify** the Supabase Storage bucket `cert-images` is working (upload + retrieve)
- **Test** actual image upload flow end-to-end (select file → upload to Supabase → save URL in certification record)
- **Display** uploaded cert images on the employee detail page and certification list
- **Add** image viewing (click to enlarge / lightbox)
- **Handle** upload errors gracefully (file too large, wrong format)
- **Consider** allowing PDF uploads in addition to images (cert documents)

The storage bucket and RLS policies are already defined in `supabase/schema.sql`. The `uploadCertImage` server action exists in `src/app/dashboard/certifications/actions.ts`.
