import { describe, it, expect } from "vitest";
import { isSuperAdmin, SUPER_ADMIN_EMAILS } from "@/lib/super-admin";

describe("isSuperAdmin", () => {
  it("returns true for the admin email", () => {
    expect(isSuperAdmin("admin@certimanager.co.il")).toBe(true);
  });

  it("returns false for a different auth user", () => {
    expect(isSuperAdmin("ori@certimanager.com")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSuperAdmin(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSuperAdmin(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isSuperAdmin("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isSuperAdmin("Admin@Certimanager.CO.IL")).toBe(true);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(isSuperAdmin("  admin@certimanager.co.il  ")).toBe(true);
  });

  it("exposes the allowlist as a readonly constant", () => {
    expect(SUPER_ADMIN_EMAILS).toContain("admin@certimanager.co.il");
  });
});
