import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  isValidIsraeliId,
  normalizeName,
} from "@/lib/leads/normalize";

describe("normalizePhone", () => {
  it("formats a 972-prefixed string as 05X-XXX-XXXX", () => {
    expect(normalizePhone("972502977325")).toEqual({
      value: "050-297-7325",
      valid: true,
    });
  });

  it("strips Excel '=+' artifact and 972 prefix", () => {
    expect(normalizePhone("=+972506404601")).toEqual({
      value: "050-640-4601",
      valid: true,
    });
  });

  it("formats an already-correct 05X number", () => {
    expect(normalizePhone("050-297-7325")).toEqual({
      value: "050-297-7325",
      valid: true,
    });
  });

  it("flags a landline as invalid and keeps the raw value", () => {
    expect(normalizePhone("02-1234567")).toEqual({
      value: "02-1234567",
      valid: false,
    });
  });

  it("flags unparseable input and keeps the raw value", () => {
    expect(normalizePhone("abc")).toEqual({
      value: "abc",
      valid: false,
    });
  });

  it("flags empty string as invalid", () => {
    expect(normalizePhone("")).toEqual({
      value: "",
      valid: false,
    });
  });
});

describe("isValidIsraeliId", () => {
  it("returns true for a valid checksum (123456782)", () => {
    expect(isValidIsraeliId("123456782")).toBe(true);
  });

  it("returns false for a wrong checksum (123456789)", () => {
    expect(isValidIsraeliId("123456789")).toBe(false);
  });

  it("returns false for too-short input", () => {
    expect(isValidIsraeliId("12345")).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isValidIsraeliId("")).toBe(false);
  });

  it("returns false for non-digit characters", () => {
    expect(isValidIsraeliId("12345678a")).toBe(false);
  });
});

describe("normalizeName", () => {
  it("returns the trimmed name when present", () => {
    expect(normalizeName("  אברהם כהן ")).toEqual({
      value: "אברהם כהן",
      empty: false,
    });
  });

  it("returns 'ללא שם' and flags empty when input is blank", () => {
    expect(normalizeName("")).toEqual({ value: "ללא שם", empty: true });
    expect(normalizeName("   ")).toEqual({ value: "ללא שם", empty: true });
  });

  it("does not split first/last name", () => {
    expect(normalizeName("Sara bint-Ahmed").value).toBe("Sara bint-Ahmed");
  });
});
