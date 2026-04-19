import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the agent test harness.
 *
 * Test dir `./tests/agents/journeys-e2e` will hold deterministic smoke specs
 * (created later by Task 13). Journey markdown files under `./tests/agents/journeys/`
 * are NOT Playwright tests — they are prompts that subagents execute via the
 * Playwright MCP tools.
 *
 * baseURL targets port 3001, where `npm run dev:test` serves Next.js with
 * staging Supabase credentials. Never 3000 (that is the prod-creds dev server).
 */
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
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
});
