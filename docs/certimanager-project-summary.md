# CertiManager — High-Level Project Summary

## What Is CertiManager?

CertiManager is a web application for managing employee certifications. A manager logs in, adds their employees, defines certification types (like safety training, first aid, forklift license), and tracks which employees have which certifications, when they expire, and who is missing required certs.

It's built for Hebrew-speaking Israeli managers tracking ~150 employees.

---

## The Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend** | Next.js 16 (React 19) | Server-rendered pages, routing, UI |
| **Styling** | Tailwind CSS 4 | Utility-first CSS with custom design tokens |
| **Icons** | Lucide React | SVG icon library |
| **Database** | Supabase (PostgreSQL) | Data storage, authentication, file storage |
| **Auth** | Supabase Auth | Email/password login, session cookies |
| **Hosting** | Render (free tier) | Auto-deploys from master branch |

---

## How the App Is Structured

```
src/
  app/                          # Next.js App Router (pages and routes)
    login/page.tsx              # Login page
    auth/callback/route.ts      # Auth callback handler
    dashboard/                  # Protected area (requires login)
      layout.tsx                # Sidebar + mobile nav wrapper
      page.tsx                  # Main dashboard with stats
      employees/
        page.tsx                # Employee list with search/filter
        new/page.tsx            # Add new employee form
        [id]/edit/page.tsx      # Edit employee form
        actions.ts              # Server actions: create, update, delete employees
      certifications/
        page.tsx                # Certification list with filters
        new/page.tsx            # Add new certification form
        [id]/edit/page.tsx      # Edit certification form
        actions.ts              # Server actions: create, update, delete certs
      import/
        page.tsx                # Bulk import from Excel
        actions.ts              # Parse Excel + bulk insert
      reports/
        page.tsx                # Analytics dashboard
        loading.tsx             # Loading skeleton
  components/
    layout/sidebar.tsx          # Sidebar navigation with Lucide icons
    employees/                  # Employee-specific UI components
    certifications/             # Certification-specific UI components
    ui/                         # Shared UI components (buttons, dialogs, selects)
  lib/
    supabase/
      server.ts                 # Creates Supabase client for server components
      client.ts                 # Creates Supabase client for browser
      middleware.ts             # Auth middleware (protects /dashboard routes)
  types/
    database.ts                 # TypeScript types + helper functions
```

---

## The Database (4 Tables)

### employees
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| manager_id | uuid | Links to auth user (data isolation) |
| employee_number | text | Optional ID number |
| first_name | text | Required |
| last_name | text | Required |
| department | text | Optional grouping |
| phone, email | text | Optional contact info |
| created_at, updated_at | timestamp | Auto-managed |

### certifications
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| employee_id | uuid | FK to employees (CASCADE delete) |
| cert_type_id | uuid | FK to cert_types |
| manager_id | uuid | Data isolation |
| issue_date | date | When cert was issued |
| expiry_date | date | When cert expires |
| image_url | text | Link to uploaded cert image/PDF |
| notes | text | Optional |

### cert_types
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| manager_id | uuid | Each manager has their own types |
| name | text | e.g., "הסמכת בטיחות", "עזרה ראשונה" |

### profiles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Links to auth.users |
| full_name | text | Display name |

**Key relationship:** Deleting an employee automatically deletes all their certifications (CASCADE).

---

## How Data Flows

### Reading Data (Server Components)
```
Browser request
  → Next.js route (server component)
    → createClient() gets Supabase client with user's cookies
      → Supabase query (filtered by manager_id)
        → Returns data
          → Server renders HTML
            → Sent to browser
```

Every page that shows data is a **server component**. It runs on the server, queries Supabase directly, and sends rendered HTML to the browser. No API routes needed.

### Writing Data (Server Actions)
```
User clicks "Save" on form
  → Form submits to server action ("use server" function)
    → Action validates auth (getUser())
    → Action writes to Supabase (with manager_id)
    → Action calls revalidatePath() to refresh cached pages
    → Action calls redirect() to navigate user
```

Server actions are functions marked with `"use server"` that run on the server when called from forms or buttons. They handle all creates, updates, and deletes.

### Authentication Flow
```
Login page → Supabase signInWithPassword()
  → Supabase sets auth cookie
    → Middleware checks cookie on every /dashboard request
      → No cookie? Redirect to /login
      → Has cookie? Allow access
```

---

## Data Isolation

Every query includes `.eq("manager_id", user.id)`. This means:
- Manager A can only see Manager A's employees and certifications
- Manager B's data is completely invisible to Manager A
- This is enforced at the query level in every server action and page

---

## Key Features

### 1. Employee Management
- Add, edit, delete employees
- Search by name, employee number, department
- Filter by department
- Bulk delete with multi-select checkboxes

### 2. Certification Tracking
- Add certifications to employees with issue/expiry dates
- Upload certification images or PDFs
- Filter by status (valid, expiring soon, expired), department, cert type
- Search across employee names and cert type names

### 3. Bulk Import
- Upload Excel file with employee + certification data
- Review parsed data before importing
- Maps columns to database fields

### 4. Reports Dashboard
- **Compliance overview**: Total employees, certs, compliance percentage
- **Expiring timeline**: Certs expiring this month, next month, within 3 months
- **Department breakdown**: Compliance rate per department
- **Missing certs**: Which employees are missing which cert types

### 5. Status Calculation
The `getCertStatus()` function determines certification status:
- **valid**: Expiry date > 30 days from now
- **expiring_soon**: Expiry date within 30 days
- **expired**: Expiry date has passed
- **unknown**: No expiry date set

---

## Design System

The app uses a custom design system defined as CSS custom properties in `globals.css`:

- **Colors**: Primary blue (#2563eb), semantic colors for status badges
- **Shadows**: Three levels (sm, md, lg) using custom shadow tokens
- **Typography**: Noto Sans Hebrew from Google Fonts
- **Layout**: RTL direction (`dir="rtl"`), Hebrew language (`lang="he"`)
- **Icons**: Lucide React library (e.g., Users, Award, BarChart3, AlertTriangle)
- **Responsive**: Mobile-first with `sm:` and `md:` breakpoints

---

## Deployment

- **Hosting**: Render.com (free tier)
- **Deploy method**: Auto-deploy on push to `master` branch
- **Build command**: `npm install && npm run build`
- **Environment variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set in Render dashboard)
- **Known limitation**: Free tier has cold starts causing ~2-3 second delays on first request after inactivity

---

## What's Not Built Yet

From the project roadmap:
- Email/SMS reminders for expiring certifications
- Image upload for certification documents (storage bucket exists but upload UI not connected)
- Advanced analytics and export features
- Multi-language support beyond Hebrew
