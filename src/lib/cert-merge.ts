import type { CertDates } from "./excel-parser";

export type CertMergeDecision =
  | { action: "insert"; merged: CertDates }
  | { action: "update"; merged: CertDates }
  | { action: "skip" };

/**
 * Decide how to merge an incoming file row against an existing DB cert row.
 *
 * Rules (monotonic field-level merge):
 *   1. If no existing row (db is null), INSERT with file's dates.
 *   2. If file has no dates at all, SKIP (nothing to contribute).
 *   3. If DB has no dates at all, UPDATE (any file data wins).
 *   4. If fileEffective > dbEffective (strict), UPDATE with field-level merge:
 *        for each of the 3 fields, file non-null overwrites; file null keeps DB value.
 *   5. Otherwise SKIP.
 *
 * fileEffective / dbEffective = max(populated { issue_date, expiry_date, next_refresh_date }).
 * Date strings are "YYYY-MM-DD" and lexicographically comparable.
 */
export function decideCertMerge(
  file: CertDates,
  db: CertDates | null,
): CertMergeDecision {
  if (db === null) {
    return { action: "insert", merged: file };
  }

  const fileEffective = effectiveMax(file);
  if (fileEffective === null) {
    return { action: "skip" };
  }

  const dbEffective = effectiveMax(db);
  if (dbEffective === null) {
    return { action: "update", merged: mergeFieldLevel(file, db) };
  }

  if (fileEffective > dbEffective) {
    return { action: "update", merged: mergeFieldLevel(file, db) };
  }

  return { action: "skip" };
}

function effectiveMax(d: CertDates): string | null {
  const populated = [d.issue_date, d.expiry_date, d.next_refresh_date].filter(
    (x): x is string => !!x,
  );
  if (populated.length === 0) return null;
  return populated.reduce((a, b) => (a > b ? a : b));
}

function mergeFieldLevel(file: CertDates, db: CertDates): CertDates {
  return {
    issue_date: file.issue_date ?? db.issue_date,
    expiry_date: file.expiry_date ?? db.expiry_date,
    next_refresh_date: file.next_refresh_date ?? db.next_refresh_date,
  };
}
