import { test, expect } from "@playwright/test";

/**
 * Sanity smoke for the test harness itself.
 *
 * Verifies that dev:test is serving Next.js on :3001 with the Hebrew RTL app,
 * and that key public routes respond. Does NOT log in or touch data — just
 * checks the harness plumbing (env file loaded → app boots → responds).
 *
 * Runs as part of `npm run test:agents:smoke`. Requires `npm run dev:test`
 * to already be running in a separate terminal. Without staging credentials
 * in .env.test, the dev server will fail to start at all, so the absence
 * of a running :3001 is itself a signal.
 */

test("root responds and is RTL Hebrew", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", /he/);
});

test("login page is reachable", async ({ page }) => {
  const response = await page.goto("/login");
  // Unauthed users should be able to reach /login without a redirect loop.
  expect(response?.ok()).toBeTruthy();
});
