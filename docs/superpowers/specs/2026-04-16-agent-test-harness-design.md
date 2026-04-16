# Agent Test Harness — Design Spec

**Date:** 2026-04-16
**Status:** Draft, awaiting review
**Owner:** Maor

## Problem

CertiManager is in production with ~150 real employees' data. The existing Vitest suite (135 tests, all passing) covers unit logic — cert merge, status computation, excel parsing — but nothing about how the app behaves when a real user drives it end-to-end. Exploratory bugs in the import flow, mobile navigation, partial-date cert rendering, and Hebrew/RTL edge cases cannot be surfaced by unit tests alone. A release that passes `npm test` can still break for a user on their first click.

We want a reusable, in-repo harness that lets us dispatch Claude subagents as different user personas, drive the running app via Playwright, and get back structured bug reports. The harness must NEVER touch production data.

## Goals

1. Isolated staging environment that cannot contaminate prod data under any circumstance.
2. Deterministic, reset-able seed state so findings are reproducible.
3. Persona + journey definitions that are human-readable and editable without code changes.
4. Claude subagents drive a real browser, produce structured findings with screenshots.
5. Harness is committed to the repo, reusable before each release.

## Non-goals (YAGNI)

- CI integration / scheduled runs (can be added later once harness proves value).
- Auto-filing GitHub issues (manual triage of a markdown report is higher signal for a solo dev).
- Auth flow testing (auth is stable, not a known pain point).
- Performance benchmarking.
- Cross-browser matrix (Chromium-only; Chrome-vs-Edge caching is a separate concern).
- Testing against prod data (explicit non-goal — see Isolation section).

## Isolation (the load-bearing section)

Three independent layers, any one of which would prevent prod contact.

### Layer 1: separate Supabase project
- User creates a second free-tier project named `certimanager-staging`.
- Schema applied via `supabase/schema.sql` + existing migrations.
- Zero shared rows, users, or storage with the prod project.

### Layer 2: separate env file
- `.env.test` holds staging credentials only.
- Added to `.gitignore`.
- Existing `.env.local` (prod) is never touched by harness scripts.

### Layer 3: guard rail in reset-db.ts
- Reset script starts with a hard assertion:
  ```typescript
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url?.includes('staging')) {
    throw new Error(`SAFETY: refuses to run against '${url}'. URL must contain 'staging'.`);
  }
  ```
- Staging project name includes "staging"; prod does not. A misconfiguration aborts the run before touching any rows.

### Port separation
- Test-mode Next.js runs on port 3001 (`next dev -p 3001`); normal dev runs on 3000.
- Journey files and Playwright base URL point at `http://localhost:3001`.
- Agents cannot reach prod: they only know about 3001, which is wired to staging creds.

### Test auth
- A dedicated admin user (`admin@test.local`) created in the staging Supabase Auth.
- Credentials stored in `.env.test` as `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD`.
- Real admin credentials never used.

## Architecture

```
certimanager/
├── tests/agents/
│   ├── personas/                       # Markdown persona prompts
│   │   ├── dina-manager.md             # Hebrew-first office manager, Pikoh user
│   │   ├── yossi-power.md              # Bulk ops, keyboard-driven, impatient
│   │   ├── sarah-mobile.md             # 375px iPhone, on the go
│   │   └── adversarial.md              # Deliberately weird inputs
│   ├── journeys/                       # One MD file per journey
│   │   ├── 01-mobile-nav-8-tabs.md             (P0)
│   │   ├── 02-mobile-responsive-layouts.md     (P0)
│   │   ├── 03-import-happy-pikoh.md            (P0)
│   │   ├── 04-import-dirty-data.md             (P0)
│   │   ├── 05-cert-crud-partial-dates.md       (P0)
│   │   ├── 06-candidate-promotion.md           (P1)
│   │   └── 07-hebrew-search-filter.md          (P2)
│   ├── fixtures/
│   │   ├── seed.sql                    # Truncate + insert known state
│   │   ├── pikoh-happy.xlsx            # Clean 10-employee file
│   │   ├── pikoh-dirty.xlsx            # Missing cols, bad dates, odd Hebrew
│   │   └── pikoh-empty.xlsx            # Zero rows edge case
│   ├── harness/
│   │   ├── reset-db.ts                 # Guard-railed seed runner
│   │   ├── run-agent.md                # Subagent dispatch prompt template
│   │   └── report-template.md          # Finding schema
│   └── reports/                        # Gitignored — one MD per run
├── playwright.config.ts                # NEW — baseURL localhost:3001, Chromium
├── .env.test                           # GITIGNORED — staging creds
└── package.json                        # New scripts (below)
```

## Journey contract

Each journey MD file contains these sections, in this order:

- **Goal** — one sentence describing what success looks like.
- **Priority** — P0 / P1 / P2.
- **Precondition** — what seed state is required (always "seed.sql applied" for v1).
- **Persona** — which persona file runs this.
- **Steps** — numbered imperative actions the agent must perform.
- **Acceptance** — observable outcomes the agent must verify after each relevant step.
- **Explore** — 1-2 open-ended nudges ("try resizing mid-flow", "what if you click Back?").

Example skeleton: see `tests/agents/journeys/03-import-happy-pikoh.md` after implementation.

## Persona contract

Each persona MD file contains:

- **Name + one-line identity**
- **Tone / habits** (clicks impatiently vs reads carefully, keyboard vs mouse, etc.)
- **Assumed knowledge** (knows Pikoh xlsx format, doesn't know what "cert_type" means, etc.)
- **Biases for this harness** ("will blame the UI before blaming the data", "will not read error messages").
- **Viewport** (defaults to 1280×800 desktop; `sarah-mobile` overrides to 375×812).

Personas are NOT test cases. They are behavioral filters applied to any journey. Any persona × any journey pairing is valid.

## Agent loop

1. Orchestrator (main Claude session) calls `npm run test:agents:reset` — DB reseeds against staging.
2. Orchestrator starts `npm run dev:test` — Next.js on :3001 with staging creds.
3. For each scheduled journey × persona pair, orchestrator dispatches a subagent using the `superpowers:dispatching-parallel-agents` skill.
4. Each subagent receives:
   - Playwright MCP tool access
   - The persona file contents
   - The journey file contents
   - Absolute path to fixtures
   - Explicit instruction to report in `report-template.md` format
5. Subagent executes steps, screenshots acceptance checkpoints, notes deviations, returns a findings block.
6. Orchestrator aggregates into `tests/agents/reports/YYYY-MM-DD-HHmm.md`.

## Finding schema

```markdown
### [SEV] Short title
- **Journey:** 02-import-dirty-data
- **Persona:** Adversarial
- **Steps to reproduce:** 1. … 2. … 3. …
- **Expected:** Error toast identifying the failing row.
- **Actual:** Silent failure, spinner hangs 30s.
- **Screenshot:** reports/media/2026-04-16-1730-finding-03.png
- **Classification:** bug | ux | perf | question | noise
```

- **Severity P0:** crash, data loss, data corruption.
- **Severity P1:** blocks the user from completing the journey.
- **Severity P2:** UX friction, confusing but not blocking.
- **Severity P3:** nit.

## New package.json scripts

```json
"dev:test": "cross-env-file -e .env.test next dev -p 3001",
"test:agents:reset": "cross-env-file -e .env.test tsx tests/agents/harness/reset-db.ts",
"test:agents": "npm run test:agents:reset && npm run dev:test"
```

`cross-env-file` is a new dev dependency. Chosen because:
- Cross-platform env loading (Windows-friendly).
- Does not pollute process env outside the scoped command.
- Keeps the prod `.env.local` path untouched.

## Testing the harness itself

- `tests/agents/harness/reset-db.test.ts` (Vitest): asserts the guard rail fires when URL does not contain "staging"; asserts row counts after a successful reseed.
- Fixture shape smoke tests in Vitest: parse each `pikoh-*.xlsx` with the existing `excel-parser` and assert expected row count + column presence.
- The agent runner is inherently integration-only. "Running journey 03 end-to-end produces a report file with expected shape" is the smoke check.

## Risks

1. **Staging Supabase free-tier limits** — 500MB DB, 2GB bandwidth/month. Each full run creates <1MB of data and resets. Should be well within limits. If we ever bump the ceiling, downgrade to a 50-employee seed.
2. **Agent noise rate** — expected ~60-70% of v1 findings will be false positives or questions. Mitigation: the `noise | question` classification in the schema, plus the markdown-only reporting means a human triages before anything is filed.
3. **Playwright MCP availability** — the `playwright-skill` plugin is installed; harness depends on it. If it's uninstalled, the runner errors loudly pointing at the skill.
4. **Port 3001 collisions** — if another service already uses 3001, `next dev -p 3001` errors clearly. User can change the port in one place (`package.json` + `playwright.config.ts`).

## Open questions for the plan phase

- Exact SQL for `seed.sql` — how many employees, which cert types, any pre-existing certs?
- Which Pikoh file in the user's filesystem becomes the `pikoh-happy.xlsx` fixture?
- Should `.env.test` template be committed as `.env.test.example` for onboarding?
