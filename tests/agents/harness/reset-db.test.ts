import { describe, it, expect, afterEach } from "vitest";
import { assertStagingEnv } from "./reset-db";

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
