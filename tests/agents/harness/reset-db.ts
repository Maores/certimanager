import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Guard rail for the reset-db harness script.
 *
 * Aborts unless SUPABASE_ENV is exactly "staging" (lowercase) AND
 * NEXT_PUBLIC_SUPABASE_URL is set.
 *
 * Rationale: Supabase project URLs use random hash IDs, not project names,
 * so we cannot use the URL alone to distinguish staging from prod. The
 * explicit SUPABASE_ENV opt-in is the primary signal; the URL presence
 * check is defense-in-depth against configuration errors.
 *
 * The thrown error message always starts with "SAFETY:" so callers can
 * regex-match. Callers should not catch this — let it abort the script.
 */
export function assertStagingEnv(): void {
  const env = process.env.SUPABASE_ENV;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (env !== "staging") {
    throw new Error(
      `SAFETY: reset-db refuses to run because SUPABASE_ENV is '${env ?? "(unset)"}'. ` +
        `Must be exactly 'staging'. Check your .env.test file.`,
    );
  }

  if (!url || url.length === 0) {
    throw new Error(
      `SAFETY: reset-db refuses to run because NEXT_PUBLIC_SUPABASE_URL is unset or empty. ` +
        `Check your .env.test file.`,
    );
  }
}

/**
 * Resets the staging Supabase to the known seed state defined by
 * tests/agents/fixtures/seed.sql.
 *
 * Preconditions:
 * - .env.test is loaded (use cross-env-file in the npm script).
 * - SUPABASE_ENV=staging
 * - NEXT_PUBLIC_SUPABASE_URL points at the staging project.
 * - SUPABASE_SERVICE_ROLE_KEY is set (RLS bypass needed for TRUNCATE).
 * - The exec_sql RPC exists on staging (applied as part of schema setup).
 *
 * On any failure, throws with a descriptive message.
 */
export async function runReset(): Promise<void> {
  assertStagingEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "reset-db failed: SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Check .env.test — you need the service_role secret key (not the anon key).",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sqlPath = resolve(process.cwd(), "tests/agents/fixtures/seed.sql");
  const sql = readFileSync(sqlPath, "utf8");

  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    throw new Error(
      `reset-db failed during exec_sql RPC: ${error.message}. ` +
        `Hint: verify the exec_sql function exists on staging and that ` +
        `SUPABASE_SERVICE_ROLE_KEY has permission to call it.`,
    );
  }
}

// Allow `tsx tests/agents/harness/reset-db.ts` to run the reset directly
// (this is how the npm script `test:agents:reset` invokes it).
const isDirectInvocation = (() => {
  if (typeof process === "undefined") return false;
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return import.meta.url === pathToFileURL(arg).href;
  } catch {
    return false;
  }
})();

if (isDirectInvocation) {
  runReset()
    .then(() => {
      console.log("reset-db: OK");
    })
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
