# CertiManager

Hebrew-language web app for tracking employees' time-limited certifications. Built for a single manager overseeing ~150 employees in the field.

Stack: Next.js 16 (App Router) on Render, Supabase for Postgres + Auth + Storage, Tailwind v4 for styling, vitest for tests.

## Local setup

1. Create a Supabase project, then run `supabase/schema.sql` in its SQL editor.
2. Create `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your project url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon/public key — never the service-role key>
   ```
3. `npm install && npm run dev` → http://localhost:3000.

To create the first user, add them in Supabase Dashboard → Authentication → Users.

## Layout

```
src/
  app/                       Next.js App Router pages
    login/                   Login + guest entry
    dashboard/
      employees/             Employee CRUD
      certifications/        Cert CRUD + image upload
      cert-types/            Cert-type management
      candidates/            Course candidates → promotion flow
      import/                Excel bulk import
      tasks/                 Task list
      reports/               Stats and timeline
      feedback/              Inbox for in-app reports
  components/                UI components grouped by feature
  lib/supabase/              Client + server Supabase factories
  lib/excel-parser.ts        Excel → workers + certs parser
  middleware.ts              Auth gate for /dashboard
  types/database.ts          Shared types + helper functions
supabase/
  schema.sql                 Initial schema
  migration_*.sql            Incremental migrations, applied in order
```

## Tests

```
npx vitest run --exclude '**/node_modules/**' --exclude '**/.claude/**'
```

## Deploy

Render auto-deploys on push to `master`. Build command: `npm install && npm run build`. Start command: `npm start`. Environment variables set in the Render dashboard.

## Multi-tenancy

Every query scopes by `manager_id = auth.uid()`. Supabase RLS is the second line of defense; the application layer is the first. When adding new data access, check both the server action and the page-level fetch include the filter.
