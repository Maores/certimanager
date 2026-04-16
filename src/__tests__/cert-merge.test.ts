import { describe, it, expect } from "vitest";
import { decideCertMerge } from "@/lib/cert-merge";
import type { CertDates } from "@/lib/excel-parser";

const EMPTY: CertDates = { issue_date: null, expiry_date: null, next_refresh_date: null };

describe("decideCertMerge", () => {
  describe("insert (no existing row)", () => {
    it("returns insert with file's dates when existing is null", () => {
      const file: CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      expect(decideCertMerge(file, null)).toEqual({ action: "insert", merged: file });
    });

    it("inserts regime-2 dates when existing is null", () => {
      const file: CertDates = { issue_date: null, expiry_date: "2026-12-01", next_refresh_date: null };
      expect(decideCertMerge(file, null)).toEqual({ action: "insert", merged: file });
    });

    it("inserts all-nulls row when existing is null (edge)", () => {
      expect(decideCertMerge(EMPTY, null)).toEqual({ action: "insert", merged: EMPTY });
    });
  });

  describe("skip", () => {
    it("skips when file has no dates at all", () => {
      const db: CertDates = { issue_date: "2024-01-01", expiry_date: null, next_refresh_date: "2025-01-01" };
      expect(decideCertMerge(EMPTY, db)).toEqual({ action: "skip" });
    });

    it("skips when db effective date is later than file", () => {
      const file: CertDates = { issue_date: null, expiry_date: "2025-06-01", next_refresh_date: null };
      const db: CertDates = { issue_date: null, expiry_date: "2026-06-01", next_refresh_date: null };
      expect(decideCertMerge(file, db)).toEqual({ action: "skip" });
    });

    it("skips when effective dates are equal (strict >)", () => {
      const same = "2026-06-01";
      const file: CertDates = { issue_date: null, expiry_date: same, next_refresh_date: null };
      const db: CertDates = { issue_date: null, expiry_date: same, next_refresh_date: null };
      expect(decideCertMerge(file, db)).toEqual({ action: "skip" });
    });
  });

  describe("update — field-level merge", () => {
    it("updates when db has all-null dates and file has data", () => {
      const file: CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      const db = EMPTY;
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" },
      });
    });

    it("updates file-wins, same regime (regime 1 → regime 1)", () => {
      const file: CertDates = { issue_date: "2026-06-01", expiry_date: null, next_refresh_date: "2027-06-01" };
      const db:   CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2026-06-01", expiry_date: null, next_refresh_date: "2027-06-01" },
      });
    });

    it("updates file-wins, cross-regime (regime 1 file, regime 2 db) — preserves db expiry (file null)", () => {
      const file: CertDates = { issue_date: "2026-06-01", expiry_date: null, next_refresh_date: "2027-06-01" };
      const db:   CertDates = { issue_date: null, expiry_date: "2025-12-01", next_refresh_date: null };
      // fileEffective = 2027-06-01, dbEffective = 2025-12-01 → file wins.
      // Merge: file's non-null fields overwrite. file.expiry is null → db.expiry kept.
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2026-06-01", expiry_date: "2025-12-01", next_refresh_date: "2027-06-01" },
      });
    });

    it("updates file-wins, cross-regime (regime 2 file, regime 1 db) — preserves db issue and refresh (both null in file)", () => {
      const file: CertDates = { issue_date: null, expiry_date: "2028-12-01", next_refresh_date: null };
      const db:   CertDates = { issue_date: "2025-06-01", expiry_date: null, next_refresh_date: "2026-06-01" };
      // fileEffective = 2028-12-01, dbEffective = 2026-06-01 → file wins.
      // Merge: file.issue and file.refresh are null → db values kept.
      expect(decideCertMerge(file, db)).toEqual({
        action: "update",
        merged: { issue_date: "2025-06-01", expiry_date: "2028-12-01", next_refresh_date: "2026-06-01" },
      });
    });

    it("never overwrites a non-null db field with a null file field (invariant)", () => {
      const file: CertDates = { issue_date: "2027-01-01", expiry_date: null, next_refresh_date: null };
      const db:   CertDates = { issue_date: "2024-01-01", expiry_date: "2025-06-01", next_refresh_date: "2026-06-01" };
      // fileEffective = 2027-01-01, dbEffective = 2026-06-01 → file wins.
      // Merge: only issue_date overwrites; expiry and refresh kept from db.
      const result = decideCertMerge(file, db);
      expect(result.action).toBe("update");
      if (result.action === "update") {
        expect(result.merged.issue_date).toBe("2027-01-01");
        expect(result.merged.expiry_date).toBe("2025-06-01");
        expect(result.merged.next_refresh_date).toBe("2026-06-01");
      }
    });
  });
});
