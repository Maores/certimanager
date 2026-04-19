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
