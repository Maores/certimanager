import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { assertStagingEnv, runReset } from "./reset-db";

describe("reset-db guard rail", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env keys we touched
    for (const k of ["SUPABASE_ENV", "NEXT_PUBLIC_SUPABASE_URL"]) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it("throws when SUPABASE_ENV is unset", () => {
    delete process.env.SUPABASE_ENV;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://any.supabase.co";
    expect(() => assertStagingEnv()).toThrow(/^SAFETY:/);
  });

  it("throws when SUPABASE_ENV is something other than 'staging'", () => {
    process.env.SUPABASE_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://any.supabase.co";
    expect(() => assertStagingEnv()).toThrow(/^SAFETY:/);
    expect(() => assertStagingEnv()).toThrow(/production/);
  });

  it("throws when SUPABASE_ENV is 'Staging' (wrong case)", () => {
    process.env.SUPABASE_ENV = "Staging";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://any.supabase.co";
    expect(() => assertStagingEnv()).toThrow(/^SAFETY:/);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is unset, even if SUPABASE_ENV=staging", () => {
    process.env.SUPABASE_ENV = "staging";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => assertStagingEnv()).toThrow(/^SAFETY:/);
    expect(() => assertStagingEnv()).toThrow(/URL/);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is empty string", () => {
    process.env.SUPABASE_ENV = "staging";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    expect(() => assertStagingEnv()).toThrow(/^SAFETY:/);
  });

  it("passes silently when SUPABASE_ENV=staging and URL is set", () => {
    process.env.SUPABASE_ENV = "staging";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mnvzhveblcktmydsuzeo.supabase.co";
    expect(() => assertStagingEnv()).not.toThrow();
  });
});

/**
 * Integration test — requires .env.test loaded (via `cross-env-file -e .env.test`
 * in the npm script, or manually before calling vitest). Auto-skips when
 * SUPABASE_ENV or NEXT_PUBLIC_SUPABASE_URL are not set, so the unit suite
 * still passes without staging set up.
 */
const stagingConfigured =
  process.env.SUPABASE_ENV === "staging" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.runIf(stagingConfigured)("reset-db integration (staging only)", () => {
  it("resets staging to the seed baseline with expected row counts", async () => {
    await runReset();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const [mgrs, types, emps, certs] = await Promise.all([
      supabase.from("managers").select("id", { count: "exact", head: true }),
      supabase.from("cert_types").select("id", { count: "exact", head: true }),
      supabase.from("employees").select("id", { count: "exact", head: true }),
      supabase
        .from("certifications")
        .select("id", { count: "exact", head: true }),
    ]);

    // Managers may contain other test users in the future; at minimum the admin is there.
    expect(mgrs.count).toBeGreaterThanOrEqual(1);
    expect(types.count).toBe(4);
    expect(emps.count).toBe(5);
    expect(certs.count).toBe(3);
  }, 30_000);
});
