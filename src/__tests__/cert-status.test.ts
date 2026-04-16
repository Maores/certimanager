import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCertStatus } from "@/types/database";

describe("getCertStatus", () => {
  // Freeze "today" at 2026-04-16 for deterministic tests.
  const FROZEN_TODAY = new Date(2026, 3, 16); // April 16, 2026 (month is 0-indexed)

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("legacy one-argument usage (expiry only)", () => {
    it("returns 'unknown' when expiry is null", () => {
      expect(getCertStatus(null)).toBe("unknown");
    });

    it("returns 'expired' when expiry is before today", () => {
      expect(getCertStatus("2026-04-15")).toBe("expired");
    });

    it("returns 'expiring_soon' when expiry is within 30 days", () => {
      expect(getCertStatus("2026-05-01")).toBe("expiring_soon");
    });

    it("returns 'valid' when expiry is more than 30 days out", () => {
      expect(getCertStatus("2026-06-01")).toBe("valid");
    });
  });

  describe("two-argument usage (expiry + refresh)", () => {
    it("returns 'unknown' when both are null", () => {
      expect(getCertStatus(null, null)).toBe("unknown");
    });

    it("uses refresh when expiry is null", () => {
      expect(getCertStatus(null, "2026-04-15")).toBe("expired");
      expect(getCertStatus(null, "2026-05-01")).toBe("expiring_soon");
      expect(getCertStatus(null, "2026-06-01")).toBe("valid");
    });

    it("uses expiry when refresh is null", () => {
      expect(getCertStatus("2026-04-15", null)).toBe("expired");
    });

    it("uses the earlier of the two when both are populated", () => {
      // Refresh 2026-04-15 (expired), expiry 2026-06-01 (valid) → expired (refresh earlier)
      expect(getCertStatus("2026-06-01", "2026-04-15")).toBe("expired");
      // Refresh 2026-06-01 (valid), expiry 2026-04-15 (expired) → expired (expiry earlier)
      expect(getCertStatus("2026-04-15", "2026-06-01")).toBe("expired");
      // Both within 30-day window → expiring_soon
      expect(getCertStatus("2026-05-10", "2026-05-05")).toBe("expiring_soon");
      // Both far out → valid
      expect(getCertStatus("2026-07-01", "2026-08-01")).toBe("valid");
    });
  });
});
