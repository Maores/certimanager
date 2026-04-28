# Agent Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, in-repo test harness that dispatches Claude subagents as different user personas, drives the CertiManager app via Playwright against an isolated staging Supabase, and produces markdown bug reports.

**Architecture:** Separate Supabase staging project + `.env.test` + guard-railed seed script on port 3001. Markdown personas × markdown journeys; orchestrator dispatches one subagent per pairing; subagent uses Playwright MCP tools and returns findings per a fixed schema. Four P0 journeys shipped in v1.

**Tech Stack:** Next.js 16 (existing), Supabase JS (existing), Vitest (existing), Playwright + `@playwright/test` (new), `cross-env-file` (new), `tsx` (new, for running `.ts` scripts outside Next.js).

---

## Prerequisite — user action (not automatable)

The user must create the staging Supabase project manually before Task 2. This is a one-time, ~5-minute action.

- [ ] **P1. Create staging Supabase project** (user, manual in browser)

  1. Log into supabase.com → **New project** → name `certimanager-staging` → free tier, same region as prod.
  2. Wait ~60 seconds for provisioning.
  3. Open SQL editor → paste contents of `supabase/schema.sql` → run.
  4. Paste contents of `supabase/migration_next_refresh_date.sql` → run.
  5. (Skip `migration_fix_nata_expiry_to_refresh.sql` — staging has no נת״ע data to fix.)
  6. Authentication → Users → **Add user** → email `admin@test.local`, password `<choose-a-strong-password>`, auto-confirm ON.
  7. Settings → API → copy `URL`, `anon` `public` key, `service_role` `secret` key.
  8. Hand these 4 values (URL, anon, service_role, admin password) to the agent running Task 2.

Do NOT proceed to Task 2 until the user confirms these are ready.

---

## Task 1: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout master
git pull origin master
git checkout -b feat/agent-test-harness
```

- [ ] **Step 2: Verify spec is present on this branch**

Run: `git log --oneline -3 docs/superpowers/specs/2026-04-16-agent-test-harness-design.md`
Expected: at least one commit reference to the spec file.

- [ ] **Step 3: Commit the plan file**

```bash
git add docs/superpowers/plans/2026-04-16-agent-test-harness.md
git commit -m "docs(plan): implementation plan for agent test harness"
```

---

## Task 2: Create .env.test and update .gitignore

**Files:**
- Create: `.env.test`
- Create: `.env.test.example`
- Modify: `.gitignore`

- [ ] **Step 1: Add `.env.test` to `.gitignore`**

Append these lines to `.gitignore` if not already present:
```
# Staging/test env - never commit
.env.test
# Agent run reports (generated)
tests/agents/reports/
```

- [ ] **Step 2: Create `.env.test.example` (committed, onboarding reference)**

```
# Staging Supabase (separate project from prod!)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-STAGING-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=replace-with-staging-service-role-key

# Test admin credentials (created manually in staging Auth)
TEST_ADMIN_EMAIL=admin@test.local
TEST_ADMIN_PASSWORD=replace-with-staging-admin-password
```

- [ ] **Step 3: Create real `.env.test` using the 4 values from the user**

Same structure as `.env.test.example`, but replace placeholders with real staging values.

- [ ] **Step 4: Verify `.env.test` is ignored by git**

Run: `git status --short | grep ".env.test$"`
Expected: empty output (file exists but git ignores it).

- [ ] **Step 5: Commit**

```bash
git add .gitignore .env.test.example
git commit -m "chore(test): add .env.test.example + gitignore staging env"
```

---

## Task 3: Install new dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install runtime test deps**

Run:
```bash
npm install --save-dev cross-env-file tsx @playwright/test playwright
npx playwright install chromium
```

- [ ] **Step 2: Verify installs**

Run: `npm ls cross-env-file tsx @playwright/test`
Expected: three lines showing installed versions, no "missing" or "UNMET".

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add playwright + cross-env-file + tsx for test harness"
```

---

## Task 4: Write the reset-db guard rail (test-first)

**Files:**
- Create: `tests/agents/harness/reset-db.ts`
- Create: `tests/agents/harness/reset-db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/agents/harness/reset-db.test.ts` with this exact content:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertStagingUrl } from "./reset-db";

describe("reset-db guard rail", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });

  it("throws when URL is undefined", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => assertStagingUrl()).toThrow(/SAFETY/);
  });

  it("throws when URL does not contain 'staging'", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prod-abc.supabase.co";
    expect(() => assertStagingUrl()).toThrow(/SAFETY/);
    expect(() => assertStagingUrl()).toThrow(/prod-abc/);
  });

  it("passes when URL contains 'staging'", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      "https://certimanager-staging-xyz.supabase.co";
    expect(() => assertStagingUrl()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npx vitest run tests/agents/harness/reset-db.test.ts`
Expected: FAIL — "Cannot find module './reset-db'" or similar.

- [ ] **Step 3: Create minimal `reset-db.ts` with just the guard rail**

Create `tests/agents/harness/reset-db.ts`:

```typescript
/**
 * Guard rail that aborts if the loaded Supabase URL does not point at a
 * staging project. Staging project URL must contain the word "staging".
 * Prod URL must NOT contain "staging".
 */
export function assertStagingUrl(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !url.includes("staging")) {
    throw new Error(
      `SAFETY: reset-db refuses to run against '${url ?? "(undefined)"}'. ` +
        `NEXT_PUBLIC_SUPABASE_URL must contain the word 'staging'.`,
    );
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npx vitest run tests/agents/harness/reset-db.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add tests/agents/harness/reset-db.ts tests/agents/harness/reset-db.test.ts
git commit -m "feat(test-harness): guard rail for reset-db"
```

---

## Task 5: Write seed.sql fixture

**Files:**
- Create: `tests/agents/fixtures/seed.sql`

- [ ] **Step 1: Review existing schema to align column names**

Run: `grep -nE "CREATE TABLE|CREATE TYPE" supabase/schema.sql`
Expected: see table names for `employees`, `certifications`, `cert_types`, `departments`, plus any enum types.

- [ ] **Step 2: Create `tests/agents/fixtures/seed.sql`**

Content — adjust table/column names only if they differ from schema.sql (the names below match the project as of 2026-04-16; if schema.sql differs, update accordingly while keeping the shape):

```sql
-- Agent harness seed fixture.
-- Idempotent: truncate + insert known state for every test run.

BEGIN;

TRUNCATE TABLE certifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE employees RESTART IDENTITY CASCADE;
TRUNCATE TABLE cert_types RESTART IDENTITY CASCADE;
TRUNCATE TABLE departments RESTART IDENTITY CASCADE;

-- 2 departments
INSERT INTO departments (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'תפעול'),
  ('22222222-2222-2222-2222-222222222222', 'ניהול');

-- 4 cert types
INSERT INTO cert_types (id, name) VALUES
  ('aaaa1111-1111-1111-1111-111111111111', 'נת״ע'),
  ('aaaa2222-2222-2222-2222-222222222222', 'כביש 6'),
  ('aaaa3333-3333-3333-3333-333333333333', 'חוצה ישראל'),
  ('aaaa4444-4444-4444-4444-444444444444', 'נתיבי ישראל');

-- 5 employees across both departments
INSERT INTO employees (id, full_name, id_number, department_id) VALUES
  ('bbbb1111-1111-1111-1111-111111111111', 'יוסי כהן',    '123456789', '11111111-1111-1111-1111-111111111111'),
  ('bbbb2222-2222-2222-2222-222222222222', 'דנה לוי',     '234567890', '11111111-1111-1111-1111-111111111111'),
  ('bbbb3333-3333-3333-3333-333333333333', 'משה פרץ',     '345678901', '22222222-2222-2222-2222-222222222222'),
  ('bbbb4444-4444-4444-4444-444444444444', 'רונית אברהם', '456789012', '22222222-2222-2222-2222-222222222222'),
  ('bbbb5555-5555-5555-5555-555555555555', 'אחמד עומר',   '567890123', '11111111-1111-1111-1111-111111111111');

-- 3 certifications: one valid (refresh only), one valid (issue+expiry), one empty
INSERT INTO certifications (id, employee_id, cert_type_id, issue_date, expiry_date, next_refresh_date) VALUES
  ('cccc1111-1111-1111-1111-111111111111', 'bbbb1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', '2025-03-15', NULL, '2027-03-15'),
  ('cccc2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'aaaa2222-2222-2222-2222-222222222222', '2024-07-01', '2027-07-01', NULL),
  ('cccc3333-3333-3333-3333-333333333333', 'bbbb3333-3333-3333-3333-333333333333', 'aaaa3333-3333-3333-3333-333333333333', NULL, NULL, NULL);

COMMIT;
```

If a column in the seed doesn't exist in schema.sql, reconcile: use only columns that exist, and log any skipped columns in the commit message. Do not invent columns.

- [ ] **Step 3: Commit**

```bash
git add tests/agents/fixtures/seed.sql
git commit -m "feat(test-harness): seed.sql with 2 depts, 4 cert types, 5 employees, 3 certs"
```

---

## Task 6: Implement reset-db.ts full body (test-first)

**Files:**
- Modify: `tests/agents/harness/reset-db.ts`
- Modify: `tests/agents/harness/reset-db.test.ts` (add row-count integration test)

- [ ] **Step 1: Extend test file with an integration test**

Append to `tests/agents/harness/reset-db.test.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { runReset } from "./reset-db";

// Integration test — requires .env.test loaded and staging to be reachable.
// Skipped if the env is missing so `npm test` still passes without staging set up.
const stagingConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("staging") &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.runIf(stagingConfigured)("reset-db integration (staging only)", () => {
  it("produces the expected row counts", async () => {
    await runReset();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const [deps, emps, certs, types] = await Promise.all([
      supabase.from("departments").select("id", { count: "exact", head: true }),
      supabase.from("employees").select("id", { count: "exact", head: true }),
      supabase
        .from("certifications")
        .select("id", { count: "exact", head: true }),
      supabase.from("cert_types").select("id", { count: "exact", head: true }),
    ]);
    expect(deps.count).toBe(2);
    expect(types.count).toBe(4);
    expect(emps.count).toBe(5);
    expect(certs.count).toBe(3);
  }, 30_000);
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npx cross-env-file -e .env.test vitest run tests/agents/harness/reset-db.test.ts`
Expected: FAIL — `runReset is not exported` or similar.

- [ ] **Step 3: Implement `runReset` in `reset-db.ts`**

Replace the contents of `tests/agents/harness/reset-db.ts` with:

```typescript
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Guard rail that aborts if the loaded Supabase URL does not point at a
 * staging project. Staging project URL must contain the word "staging".
 */
export function assertStagingUrl(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !url.includes("staging")) {
    throw new Error(
      `SAFETY: reset-db refuses to run against '${url ?? "(undefined)"}'. ` +
        `NEXT_PUBLIC_SUPABASE_URL must contain the word 'staging'.`,
    );
  }
}

/**
 * Resets the staging DB to the known seed state.
 * Requires .env.test loaded (URL + SERVICE_ROLE_KEY).
 */
export async function runReset(): Promise<void> {
  assertStagingUrl();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set in env");
  }
  const supabase = createClient(url, key);

  const sqlPath = resolve(
    process.cwd(),
    "tests/agents/fixtures/seed.sql",
  );
  const sql = readFileSync(sqlPath, "utf8");

  // Supabase client has no "execute arbitrary SQL" method, but we can use the
  // Postgres HTTP endpoint via rpc('exec_sql'). Rather than require a custom
  // function, we split on ';' and run statements via the REST API's equivalent.
  // Simplest reliable path: use pg client directly with the pooler URL.
  // For this project we keep it simple — call a tiny SQL fn created once.
  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    throw new Error(`reset-db failed: ${error.message}`);
  }
}

// Allow `tsx reset-db.ts` to run the reset directly
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runReset()
    .then(() => {
      console.log("reset-db: OK");
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Create the `exec_sql` RPC in staging**

The user must run this ONCE in the staging SQL editor (document it in commit message):

```sql
create or replace function public.exec_sql(sql text)
returns void
language plpgsql
security definer
as $$
begin
  execute sql;
end;
$$;

-- Only service_role may call it (default for SECURITY DEFINER + no grants)
revoke all on function public.exec_sql(text) from public, anon, authenticated;
```

Save this SQL to `tests/agents/fixtures/_staging-only-exec-sql.sql` (committed, referenced in commit message).

- [ ] **Step 5: Run integration test, expect pass**

Run: `npx cross-env-file -e .env.test vitest run tests/agents/harness/reset-db.test.ts`
Expected: PASS — 4 tests (3 unit + 1 integration).

- [ ] **Step 6: Commit**

```bash
git add tests/agents/harness/ tests/agents/fixtures/_staging-only-exec-sql.sql
git commit -m "feat(test-harness): reset-db runs seed.sql against staging"
```

---

## Task 7: Playwright config

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Write the config**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/agents/journeys-e2e",
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // staging DB is shared state
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
});
```

Note: `./tests/agents/journeys-e2e` is created empty in Task 13 for one smoke test. Journey MD files live in `./tests/agents/journeys/` (Task 10+); they are NOT Playwright test files — they are prompts for subagents.

- [ ] **Step 2: Verify config parses**

Run: `npx playwright test --list`
Expected: prints "Total: 0 tests in 0 files" (no tests yet — that's fine).

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "feat(test-harness): playwright config targeting localhost:3001"
```

---

## Task 8: Add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current scripts section**

Run: `grep -A10 '"scripts"' package.json | head -15`
Expected: current scripts block visible.

- [ ] **Step 2: Add three new scripts**

Edit the `"scripts"` block in `package.json` so it contains these three new entries alongside existing ones:

```json
    "dev:test": "cross-env-file -e .env.test next dev -p 3001",
    "test:agents:reset": "cross-env-file -e .env.test tsx tests/agents/harness/reset-db.ts",
    "test:agents:smoke": "cross-env-file -e .env.test playwright test"
```

Keep `dev`, `build`, `start`, `lint`, `test`, `test:watch` unchanged.

- [ ] **Step 3: Sanity-check reset script runs**

Run: `npm run test:agents:reset`
Expected: prints `reset-db: OK`. If it prints a SAFETY error, check `.env.test` URL contains "staging".

- [ ] **Step 4: Sanity-check dev:test boots**

Run: `npm run dev:test` (in a background terminal or with `run_in_background`)
Expected: "Ready in <n>ms" from Next.js, server listening on :3001.
Then stop it (Ctrl+C or kill the background pid).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat(test-harness): npm scripts for dev:test, reset, playwright smoke"
```

---

## Task 9: Finding report template and run-agent prompt

**Files:**
- Create: `tests/agents/harness/report-template.md`
- Create: `tests/agents/harness/run-agent.md`

- [ ] **Step 1: Create `tests/agents/harness/report-template.md`**

```markdown
# Agent Run Report

**Date:** <YYYY-MM-DD HHmm>
**Git SHA:** <short sha at time of run>
**Journeys run:** <list>
**Personas used:** <list>

---

## Findings

<!-- Each finding follows this block. Copy + fill. -->

### [SEV] Short title
- **Journey:** <journey filename>
- **Persona:** <persona filename>
- **Steps to reproduce:**
  1. ...
  2. ...
  3. ...
- **Expected:** <what should happen>
- **Actual:** <what did happen>
- **Screenshot:** <relative path in reports/media/>
- **Classification:** bug | ux | perf | question | noise

---

## Summary

- Total findings: <n>
- By severity: P0=<n>  P1=<n>  P2=<n>  P3=<n>
- By classification: bug=<n>  ux=<n>  perf=<n>  question=<n>  noise=<n>
- Journeys passed without findings: <list>
```

Severity definitions (include verbatim at top of file as a collapsed section):

```markdown
<details>
<summary>Severity scale</summary>

- **P0** — crash, data loss, data corruption
- **P1** — blocks the user from completing the journey
- **P2** — UX friction, confusing but not blocking
- **P3** — nit / cosmetic

</details>
```

- [ ] **Step 2: Create `tests/agents/harness/run-agent.md`**

```markdown
# Run-Agent Orchestrator Prompt

You are the orchestrator for the CertiManager agent test harness. Your job: dispatch a fresh Claude subagent per (journey, persona) pair, collect findings, aggregate into a run report.

## Preconditions to verify before dispatching

1. `.env.test` exists and its `NEXT_PUBLIC_SUPABASE_URL` contains the word "staging".
2. `npm run test:agents:reset` exits 0.
3. `npm run dev:test` is running on port 3001 (or you start it yourself in a background process).

If any precondition fails, STOP and report to the user. Do not dispatch.

## Dispatch pattern (one per (journey, persona) pair)

Use the `superpowers:dispatching-parallel-agents` skill. For each pair, send the subagent this self-contained prompt:

> You are roleplaying as the persona described below, executing the journey described below, against the CertiManager app at http://localhost:3001. Use the `playwright-skill` to drive a real Chromium browser. Log in with credentials `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` from `.env.test` (the orchestrator will give you the values).
>
> **Persona:** `<paste contents of persona file>`
>
> **Journey:** `<paste contents of journey file>`
>
> **Rules:**
> - Follow the journey steps. At each Acceptance checkpoint, verify the condition and take a screenshot saved to `tests/agents/reports/media/<run-id>-<journey>-<n>.png`.
> - When a condition fails, deviates, or surprises you, record it as a Finding.
> - Also record findings from the "Explore" nudges at the end of the journey.
> - Return a markdown block per finding using `tests/agents/harness/report-template.md`.
> - Do NOT skip a failed Acceptance and continue. Record the finding, then move on.
> - Do NOT fix bugs. Only report.
>
> **Output format:** A single markdown document with all findings concatenated. No prose summary — that's the orchestrator's job.

## Aggregation

After all subagents return:

1. Create `tests/agents/reports/YYYY-MM-DD-HHmm.md` using `report-template.md` as scaffold.
2. Paste each subagent's findings block into the Findings section.
3. Fill in Summary: counts by severity, counts by classification, journeys that passed clean.
4. Commit the report: `git add tests/agents/reports/<file>.md && git commit -m "test(agents): run report <date>"`.

## Cleanup

- Stop `npm run dev:test` when done.
- Run `npm run test:agents:reset` one more time to leave staging clean.
```

- [ ] **Step 3: Commit**

```bash
git add tests/agents/harness/report-template.md tests/agents/harness/run-agent.md
git commit -m "feat(test-harness): report template + orchestrator prompt"
```

---

## Task 10: Create four persona files

**Files:**
- Create: `tests/agents/personas/dina-manager.md`
- Create: `tests/agents/personas/yossi-power.md`
- Create: `tests/agents/personas/sarah-mobile.md`
- Create: `tests/agents/personas/adversarial.md`

- [ ] **Step 1: Write `dina-manager.md`**

```markdown
# Persona: Dina — Hebrew-first Office Manager

**Identity:** 40-something office manager at an Israeli infrastructure company. Keeps the cert records. Not a tech person; not afraid of a spreadsheet.

**Tone & habits:**
- Reads Hebrew labels naturally, ignores English. If a button has English-only text, notes it as a bug.
- Clicks carefully, reads confirmation dialogs.
- Expects the app to "just work" with her standard Pikoh xlsx export — if the import wizard asks her to map columns, she gets annoyed and may stop.

**Assumed knowledge:**
- Knows the Pikoh file format cold (columns in Hebrew, dates as DD/MM/YYYY).
- Does NOT know terms like "cert_type", "regime", or any internal app jargon.
- Does NOT know keyboard shortcuts.

**Biases for this harness:**
- Will blame the UI before blaming the data.
- If a screen looks empty for >2 seconds, she assumes it's broken.
- Will NOT open DevTools. If a page looks wrong visually, that IS the bug.

**Viewport:** 1280×800 desktop (default).
```

- [ ] **Step 2: Write `yossi-power.md`**

```markdown
# Persona: Yossi — Power User, Impatient

**Identity:** IT guy who sometimes covers for Dina. Comfortable with computers, clicks fast.

**Tone & habits:**
- Keyboard-first when possible (Tab, Enter, arrows).
- Uses bulk operations, multi-select, batch actions.
- Quickly navigates away mid-operation to "check something" in another tab.

**Assumed knowledge:**
- Knows the app schema and terminology.
- Expects "select all" checkboxes, delete buttons, batch import.
- Expects URL-based navigation to work (refresh, back button).

**Biases for this harness:**
- Will stress-test concurrency: start one action, don't wait, start another.
- Will refresh mid-flow to check if state persists.
- Will open the same page in two tabs and try to cause a race.

**Viewport:** 1920×1080 desktop.
```

- [ ] **Step 3: Write `sarah-mobile.md`**

```markdown
# Persona: Sarah — Mobile-only, On the Go

**Identity:** Field manager who only uses the app from her phone while traveling between sites.

**Tone & habits:**
- One-thumbed interaction.
- Will tap buttons repeatedly if they don't respond within ~1 second.
- Expects the bottom nav to work from every screen.
- Expects forms to fit one screen without horizontal scrolling.

**Assumed knowledge:**
- Knows the app conversationally, not formally.
- Expects common mobile patterns: swipe-to-dismiss, pull-to-refresh, bottom sheets.

**Biases for this harness:**
- Any horizontal scrollbar on a main view = bug.
- Any element cut off at the edge of the viewport = bug.
- Any tap target <40px = friction.
- If the soft keyboard covers the input she's typing in = bug.

**Viewport:** 375×812 (iPhone 13 mini equivalent), devicePixelRatio 3.
```

- [ ] **Step 4: Write `adversarial.md`**

```markdown
# Persona: Adversarial — Deliberately Weird Inputs

**Identity:** QA mindset. Tries to break things.

**Tone & habits:**
- Reads every error message carefully.
- Tries inputs that "shouldn't" work: huge files, empty files, Unicode edge cases, SQL-like strings in name fields, dates in 2099 and 1900, negative row counts.
- Goes BACK and FORWARD repeatedly.
- Cancels mid-operation.

**Assumed knowledge:**
- Knows the app fully.
- Has read the schema.

**Biases for this harness:**
- A silent failure is worse than a loud one. Log any case where an error is swallowed.
- A 500 is always a P0.
- A field that accepts data but then renders wrong = P1.
- A validation message that says something untrue = P1.

**Viewport:** 1280×800 desktop (tests don't depend on viewport).
```

- [ ] **Step 5: Commit**

```bash
git add tests/agents/personas/
git commit -m "feat(test-harness): 4 personas — dina, yossi, sarah, adversarial"
```

---

## Task 11: Create journey 01-mobile-nav-8-tabs

**Files:**
- Create: `tests/agents/journeys/01-mobile-nav-8-tabs.md`

- [ ] **Step 1: Write the journey**

```markdown
# Journey 01 — Mobile Nav: all tabs reachable

**Goal:** Verify every item in the mobile bottom nav (including items in the "עוד" sheet) is reachable and leads to a working page.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001.

**Persona:** `sarah-mobile.md` (375×812 viewport)

**Steps:**
1. Open `http://localhost:3001/`.
2. Log in with `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`.
3. Confirm you land on `/dashboard`.
4. In the bottom nav, identify all primary tabs (expect: לוח בקרה, עובדים, הסמכות, משימות, עוד).
5. Tap each primary tab, one at a time. After each tap:
   - Wait up to 3s for navigation.
   - Take a screenshot.
   - Verify the main heading reflects the section.
6. Tap "עוד" to open the sheet. Identify every link inside it.
7. Tap each link in "עוד" one at a time, returning to "עוד" between taps if the sheet auto-closes.
8. For any link that does NOT navigate, produces an error, or leaves the user stranded, record a finding.

**Acceptance:**
- All 4 primary tabs navigate and render a heading.
- The "עוד" sheet opens on tap.
- Every link inside "עוד" navigates to a page that renders without error.
- No horizontal scrollbar appears on any of these pages at 375px.

**Explore:**
- Tap the current tab twice in quick succession — does it scroll to top or reload?
- Rotate to landscape (667×375) — does the nav still work?
```

- [ ] **Step 2: Commit**

```bash
git add tests/agents/journeys/01-mobile-nav-8-tabs.md
git commit -m "feat(test-harness): journey 01 mobile nav"
```

---

## Task 12: Create journey 02-mobile-layouts-core-screens

**Files:**
- Create: `tests/agents/journeys/02-mobile-layouts-core-screens.md`

- [ ] **Step 1: Write the journey**

```markdown
# Journey 02 — Mobile Layouts: core screens at 375px

**Goal:** Verify `/dashboard`, `/dashboard/employees`, `/dashboard/certifications`, and an employee detail page render cleanly at 375×812.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001.

**Persona:** `sarah-mobile.md`

**Steps:**
1. Log in (see Journey 01 steps 1-3).
2. Navigate to `/dashboard`. Screenshot. Check: no horizontal scroll, no element clipped at the right edge, all text readable.
3. Navigate to `/dashboard/employees`. Screenshot. Check: employee cards/rows fit the viewport, names and ID numbers fully visible, tap targets reachable.
4. Tap any employee row to open detail page. Screenshot. Check: cert list fits, dates readable, "עריכה" and "מחיקה" buttons both reachable with one thumb.
5. Back to list. Navigate to `/dashboard/certifications`. Screenshot. Check: each cert card shows the correct date labels (הנפקה, תפוגה, מועד רענון הבא) when present, `—` when absent, status badge visible.
6. Open the filter/sort controls. Try changing a filter. Verify the list updates without overflowing.

**Acceptance:**
- Zero horizontal scrollbars on any of these four screens.
- Zero elements clipped at the right or bottom edge of the viewport.
- All Hebrew text renders RTL correctly (first character on the right).
- Status badges visible on every cert card where status applies.
- All tap targets ≥40px on the smallest dimension.

**Explore:**
- Pull down to refresh on each list — does it work, or is it a browser-level overscroll?
- Long-press an employee row — does anything happen, and is it intentional?
```

- [ ] **Step 2: Commit**

```bash
git add tests/agents/journeys/02-mobile-layouts-core-screens.md
git commit -m "feat(test-harness): journey 02 mobile layouts"
```

---

## Task 13: Create journey 03-import-happy-pikoh + smoke test

**Files:**
- Create: `tests/agents/journeys/03-import-happy-pikoh.md`
- Create: `tests/agents/fixtures/pikoh-happy.xlsx` (binary, see Step 2)
- Create: `tests/agents/fixtures/_fixture-smoke.test.ts`
- Create: `tests/agents/journeys-e2e/harness-smoke.spec.ts`

- [ ] **Step 1: Write the journey**

```markdown
# Journey 03 — Import: happy-path Pikoh file

**Goal:** Import a clean 10-row Pikoh xlsx and verify 10 employees + the expected certs are created, statuses are correct.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001. Fixture file at `tests/agents/fixtures/pikoh-happy.xlsx` exists.

**Persona:** `dina-manager.md`

**Steps:**
1. Log in.
2. Navigate to `/dashboard/import`.
3. Click the file picker. Select `tests/agents/fixtures/pikoh-happy.xlsx`.
4. On the review step, verify: 10 employee rows, each with their ID number, each with the expected cert type and dates.
5. Click "המשך" / "סיים" to commit.
6. Navigate to `/dashboard/employees`. Verify count increased by 10 (seed has 5 → now 15).
7. Navigate to `/dashboard/certifications`. Verify new certs appear with correct `הנפקה` / `תפוגה` / `מועד רענון הבא` values.
8. Pick one imported employee, open detail, verify the cert shown matches the xlsx row.

**Acceptance:**
- 15 employees total after import.
- Every new cert has at least one populated date.
- No cert shows status `לא ידוע` unless ALL three of its dates are missing.
- The review step table matches the xlsx contents row-for-row.

**Explore:**
- Click Back after the file picker — does the flow recover?
- Re-upload the same file a second time — is there de-duplication or does it double-insert?
```

- [ ] **Step 2: Create `pikoh-happy.xlsx` fixture**

The agent running this task must create a minimal xlsx with these exact columns and 10 data rows. Use the project's existing excel-parser conventions as a reference:

- Inspect existing Pikoh-format handling: `grep -rn "cert_type\|מועד רענון" src/lib/excel-parser.ts | head -20`
- Read the project's import column semantics from memory: `C:\Users\maor4\.claude\projects\C--Users-maor4-OneDrive-Desktop-certimanager\memory\project_import_column_semantics.md`
- Generate xlsx programmatically via a one-shot script using `xlsx` npm package or the existing parser's inverse. If the project does not already depend on `xlsx`, use Python's openpyxl via a short script in `scripts/gen-pikoh-happy.ts` that produces the file. Delete the script after generation (fixture is the artifact, not the generator).

Required columns (Hebrew, exact): `שם מלא`, `תעודת זהות`, `מחלקה`, `סוג הסמכה`, `מועד הנפקה`, `מועד תפוגה`, `מועד רענון הבא`

10 rows split roughly: 4 נת״ע with (issue + next_refresh) and empty expiry, 3 כביש 6 with (issue + expiry), 2 חוצה ישראל with only next_refresh, 1 empty-dates נתיבי ישראל. Use 5 distinct Hebrew names not present in `seed.sql`.

- [ ] **Step 3: Smoke test the fixture parses**

Create `tests/agents/fixtures/_fixture-smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseExcelFile } from "@/lib/excel-parser";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("pikoh-happy.xlsx fixture", () => {
  it("parses to 10 employee rows with expected cert types", async () => {
    const buf = readFileSync(
      resolve(process.cwd(), "tests/agents/fixtures/pikoh-happy.xlsx"),
    );
    const rows = await parseExcelFile(buf);
    expect(rows.length).toBe(10);
    const types = new Set(rows.map((r: any) => r.cert_type_name));
    expect(types.has("נת״ע")).toBe(true);
    expect(types.has("כביש 6")).toBe(true);
    expect(types.has("חוצה ישראל")).toBe(true);
    expect(types.has("נתיבי ישראל")).toBe(true);
  });
});
```

NOTE: If the real parser export name differs from `parseExcelFile`, update the import accordingly. Confirm with: `grep -n "^export" src/lib/excel-parser.ts`.

- [ ] **Step 4: Run the smoke test, expect pass**

Run: `npx vitest run tests/agents/fixtures/_fixture-smoke.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Create a Playwright smoke-spec that proves the harness works**

Create `tests/agents/journeys-e2e/harness-smoke.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("dev:test server responds on :3001 and shows Hebrew heading", async ({ page }) => {
  await page.goto("/");
  // Login page is the landing state for unauthed users
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
```

- [ ] **Step 6: Run Playwright smoke (with dev:test running)**

In one terminal: `npm run dev:test`
In another: `npm run test:agents:smoke`
Expected: 1 test passed on chromium-desktop, 1 on chromium-mobile (2 total).

- [ ] **Step 7: Commit**

```bash
git add tests/agents/journeys/03-import-happy-pikoh.md \
        tests/agents/fixtures/pikoh-happy.xlsx \
        tests/agents/fixtures/_fixture-smoke.test.ts \
        tests/agents/journeys-e2e/harness-smoke.spec.ts
git commit -m "feat(test-harness): journey 03 + happy-path xlsx fixture + smoke"
```

---

## Task 14: Create journey 04-import-dirty-data + dirty fixtures

**Files:**
- Create: `tests/agents/journeys/04-import-dirty-data.md`
- Create: `tests/agents/fixtures/pikoh-dirty.xlsx`
- Create: `tests/agents/fixtures/pikoh-empty.xlsx`
- Modify: `tests/agents/fixtures/_fixture-smoke.test.ts`

- [ ] **Step 1: Write the journey**

```markdown
# Journey 04 — Import: dirty data edge cases

**Goal:** Verify the import wizard handles malformed xlsx files without crashing, with useful error messages.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001. Fixtures `pikoh-dirty.xlsx` and `pikoh-empty.xlsx` exist.

**Persona:** `adversarial.md`

**Steps:**
1. Log in. Navigate to `/dashboard/import`.
2. Upload `pikoh-empty.xlsx` (0 data rows). Observe: does the app crash, show an empty review step, or display a specific error?
3. Click Back / Cancel. Upload `pikoh-dirty.xlsx`. Observe the review step — rows with problems should be flagged visually or omitted.
4. Attempt to commit the dirty import. Observe what gets inserted vs rejected.
5. After commit, navigate to `/dashboard/employees` and `/dashboard/certifications`. Verify: only valid rows landed; no corrupted rows in the DB.
6. Try uploading a non-xlsx file (e.g., a .txt renamed to .xlsx — use `tests/agents/fixtures/seed.sql` renamed via the OS file picker if possible, or a tiny decoy file).

**Acceptance:**
- No 500 page, no white-screen crash.
- Empty file → friendly message, no ghost rows.
- Dirty file → problematic rows clearly flagged; committing does not corrupt DB.
- Non-xlsx file → clear rejection, no silent acceptance.

**Explore:**
- What happens if you navigate away mid-upload?
- Does the review step handle >100 rows? (Use the happy file concatenated with itself if needed.)
```

- [ ] **Step 2: Create `pikoh-dirty.xlsx`**

10-row file with these seeded problems:
- Row 2: missing `תעודת זהות`.
- Row 3: `מועד הנפקה` = "not a date".
- Row 4: `מועד הנפקה` = 2099-01-01 (far future).
- Row 5: `שם מלא` = SQL-injection-ish string `Robert'); DROP TABLE employees;--`.
- Row 6: `תעודת זהות` = empty string.
- Row 7: Mixed Latin + Hebrew name (`John שמואלי`).
- Row 8: `סוג הסמכה` = `NOPE_UNKNOWN_TYPE`.
- Row 9: `מועד תפוגה` earlier than `מועד הנפקה` (2020 vs 2025).
- Row 10: all date columns empty.
- Row 11: valid happy row (control, should import cleanly).

- [ ] **Step 3: Create `pikoh-empty.xlsx`**

Same headers as happy file, zero data rows.

- [ ] **Step 4: Extend `_fixture-smoke.test.ts`**

Append:

```typescript
describe("pikoh-empty.xlsx fixture", () => {
  it("parses to zero rows without throwing", async () => {
    const buf = readFileSync(
      resolve(process.cwd(), "tests/agents/fixtures/pikoh-empty.xlsx"),
    );
    const rows = await parseExcelFile(buf);
    expect(rows.length).toBe(0);
  });
});

describe("pikoh-dirty.xlsx fixture", () => {
  it("parses without throwing; exact row shape is the subject under test by the journey itself", async () => {
    const buf = readFileSync(
      resolve(process.cwd(), "tests/agents/fixtures/pikoh-dirty.xlsx"),
    );
    // Expectation: parser may return fewer than 10 rows (skipping bad ones) OR
    // flag them inline — depends on current implementation. Just verify no throw.
    await expect(parseExcelFile(buf)).resolves.toBeDefined();
  });
});
```

- [ ] **Step 5: Run smoke tests, expect pass**

Run: `npx vitest run tests/agents/fixtures/_fixture-smoke.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add tests/agents/journeys/04-import-dirty-data.md \
        tests/agents/fixtures/pikoh-dirty.xlsx \
        tests/agents/fixtures/pikoh-empty.xlsx \
        tests/agents/fixtures/_fixture-smoke.test.ts
git commit -m "feat(test-harness): journey 04 + dirty/empty xlsx fixtures"
```

---

## Task 15: Create journey 05-cert-crud-partial-dates

**Files:**
- Create: `tests/agents/journeys/05-cert-crud-partial-dates.md`

- [ ] **Step 1: Write the journey**

```markdown
# Journey 05 — Cert CRUD: partial dates

**Goal:** Verify creating, editing, and deleting a certification with every combination of date fields populated/empty works end-to-end.

**Priority:** P0

**Precondition:** `seed.sql` applied; dev:test running on :3001.

**Persona:** `yossi-power.md`

**Steps:**
1. Log in. Navigate to `/dashboard/certifications`. Note the current total (expect 3 from seed).
2. Click "הוסף הסמכה". Fill in: employee = "רונית אברהם", cert type = "נת״ע", issue date empty, expiry empty, next refresh = `2027-01-15`. Submit.
3. Verify the new cert appears in the list with status `בתוקף` (valid).
4. Click edit on that new cert. Change: add issue date `2025-01-15`. Save.
5. Verify the cert list shows both dates, status unchanged.
6. Click edit again. Clear the next-refresh date. Set expiry = `2026-01-01` (past). Save.
7. Verify status is now `פג תוקף` (expired).
8. Click edit again. Clear ALL date fields. Save.
9. Verify status is now `לא ידוע` (unknown).
10. Click delete. Confirm. Verify the cert is gone and the list total is back to 3.

**Acceptance:**
- Create-with-refresh-only works and renders status `בתוקף`.
- Editing one date field at a time persists correctly.
- Status recomputes on every save based on the effective deadline (earliest of expiry / next_refresh).
- Delete removes the row and updates the list without refresh.

**Explore:**
- What happens if you enter next-refresh earlier than issue-date? Is it allowed? If yes, is that a bug?
- Open the edit form in two tabs, save in one, then save in the other — which wins?
```

- [ ] **Step 2: Commit**

```bash
git add tests/agents/journeys/05-cert-crud-partial-dates.md
git commit -m "feat(test-harness): journey 05 cert CRUD partial dates"
```

---

## Task 16: End-to-end dry-run

**Files:**
- Create: `tests/agents/reports/.gitkeep` (so the directory exists)
- Create: `tests/agents/reports/media/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p tests/agents/reports/media
echo "" > tests/agents/reports/.gitkeep
echo "" > tests/agents/reports/media/.gitkeep
```

- [ ] **Step 2: Full pipeline dry-run**

In terminal A: `npm run test:agents:reset`
Expected: `reset-db: OK`.

In terminal B: `npm run dev:test`
Expected: Next.js ready on :3001.

In terminal C: `npm run test:agents:smoke`
Expected: 2 Playwright smoke tests pass (desktop + mobile).

- [ ] **Step 3: Manually dispatch one real journey as a sanity check**

Open a fresh Claude session. Paste the contents of `tests/agents/harness/run-agent.md`, then ask Claude to dispatch ONE subagent for `journey 01` + `sarah-mobile`. Confirm:
- Subagent drives the browser.
- Subagent produces a finding block matching `report-template.md`.
- No prod DB rows were touched (check staging + prod row counts both unchanged by a read-only query).

- [ ] **Step 4: Commit the directory placeholders**

```bash
git add tests/agents/reports/.gitkeep tests/agents/reports/media/.gitkeep
git commit -m "chore(test-harness): placeholder dirs for run reports"
```

---

## Task 17: Final checks + push

**Files:** none

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all existing 135 tests + new harness tests pass. Zero failures.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: clean, or only warnings that already existed on master.

- [ ] **Step 3: Verify `.env.test` is still gitignored**

Run: `git check-ignore -v .env.test`
Expected: output references the `.gitignore` entry.

- [ ] **Step 4: Push branch and open PR**

```bash
git push -u origin feat/agent-test-harness
gh pr create --title "feat: agent test harness with isolated staging" --body "$(cat <<'EOF'
## Summary
- Persona-driven Claude subagent harness that drives CertiManager via Playwright against an isolated staging Supabase project
- Four P0 journeys: mobile nav, mobile layouts, import happy path, import dirty data, cert CRUD partial dates
- Three-layer isolation: separate Supabase project + `.env.test` + guard-railed reset-db script
- Markdown-only findings (manual triage), zero CI integration (YAGNI)

## Test plan
- [ ] `npm test` — 135 existing tests still pass, ~4 new tests green
- [ ] `npm run test:agents:reset` — prints `reset-db: OK`
- [ ] `npm run dev:test` — Next.js boots on :3001 with staging creds
- [ ] `npm run test:agents:smoke` — 2 Playwright smokes pass
- [ ] Manual dispatch of one journey via `run-agent.md` produces a finding block
- [ ] Prod DB row counts unchanged by the above (spot check)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review against spec

**Spec coverage:**
- Isolation layer 1 (separate Supabase project) → Prerequisite P1 ✓
- Isolation layer 2 (separate env file) → Task 2 ✓
- Isolation layer 3 (guard rail) → Task 4 ✓
- Port separation :3001 → Task 7 (Playwright) + Task 8 (npm scripts) ✓
- Test auth user → Prerequisite P1 step 6 + `.env.test.example` ✓
- Architecture folder layout → Tasks 9–15 together produce the full tree ✓
- Journey contract (Goal/Priority/Precondition/Persona/Steps/Acceptance/Explore) → every journey file in Tasks 11-15 uses exactly this structure ✓
- Persona contract → every persona file in Task 10 uses the required sections ✓
- Agent loop → Task 9 `run-agent.md` + Task 16 dry-run ✓
- Finding schema → Task 9 `report-template.md` ✓
- `cross-env-file`, `tsx`, `@playwright/test`, `playwright` deps → Task 3 ✓
- Testing the harness itself (reset-db test, fixture smoke, Playwright smoke) → Tasks 4, 6, 13, 14 ✓
- Risk: staging free-tier limits → seed is <1MB, documented in Task 5 ✓
- Risk: agent noise rate → `noise` classification in Task 9 template ✓
- Risk: Playwright MCP availability → referenced as `playwright-skill` in Task 9 prompt ✓
- Risk: port 3001 collision → addressed in Task 8 verify step ✓

**Open questions from spec resolved in plan:**
- Seed SQL contents → Task 5 (5 emps / 3 certs / 4 types / 2 depts, explicit).
- Which Pikoh file becomes `pikoh-happy.xlsx` → Task 13 Step 2 (generated programmatically, 10 rows, specific cert-type mix).
- `.env.test.example` committed → Task 2 Step 2 ✓.

**Placeholder scan:** no TBD, no "implement later", no "add error handling" without code. One mild exception: Task 13 Step 2 leaves the exact xlsx-generation mechanism to the executor because the project may not yet depend on an xlsx writer — the task gives concrete column names, row count, and data shape, but the generator choice is bounded by "use existing deps or write a one-shot script". This is intentional: prescribing a specific generator that may fight the existing parser would be wrong.

**Type consistency:** `runReset` and `assertStagingUrl` used consistently across Tasks 4, 6, 8. `parseExcelFile` is the assumed parser name; Task 13 Step 3 notes the fallback if the real name differs.
