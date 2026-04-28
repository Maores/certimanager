# CertiManager - Employee Certificates Manager

A certification tracking and renewal management system for managers.
Built with Next.js, Supabase, and Tailwind CSS.

## Features

- **Employee Management** - Add, edit, and manage employee profiles
- **Certification Tracking** - Track certification types, issue dates, and expiry dates
- **Expiry Alerts** - Visual dashboard showing expiring and expired certifications
- **Image Upload** - Upload and store certification photos
- **Hebrew RTL Interface** - Full Hebrew right-to-left interface
- **Mobile Responsive** - Works on desktop and mobile devices
- **Secure** - Supabase Auth with Row Level Security

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS (RTL support)
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Hosting:** Vercel (free tier)

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
4. Go to **Authentication > Providers** and ensure Email provider is enabled

### 2. Configure Environment Variables

Create a `.env.local` file in the project root with the following two values from Supabase Dashboard → Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

- `NEXT_PUBLIC_SUPABASE_URL` — your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/public key (safe for client; do NOT use the service-role key)

### 3. Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Create Your Account

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User" and create a user with email/password
3. Log in to CertiManager with those credentials

## Project Structure

```
src/
  app/
    login/            # Login page and auth actions
    dashboard/        # Dashboard layout and pages
      employees/      # Employee management (list, add, edit, detail)
      certifications/ # Certification management
      cert-types/     # Certification type management
  components/
    layout/           # Sidebar navigation
    employees/        # Employee form component
    certifications/   # Certification form component
  lib/supabase/       # Supabase client utilities
  types/              # TypeScript type definitions
supabase/
  schema.sql          # Database schema (run in Supabase SQL Editor)
```

## Deployment (Vercel)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add environment variables in Vercel project settings
4. Deploy
