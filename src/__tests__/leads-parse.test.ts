import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseLeadsXlsx } from "@/lib/leads/parse";

function buildXlsx(rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

describe("parseLeadsXlsx", () => {
  it("parses the 4-column header in the expected order", () => {
    const buf = buildXlsx([
      ["first name", "phone", "עיר", "מס׳ תעודת זהות"],
      ["אברהם", "972502977325", "תל אביב", "123456782"],
    ]);
    const result = parseLeadsXlsx(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      first_name: "אברהם",
      phone: "972502977325",
      city: "תל אביב",
      id_number: "123456782",
      source_row_number: 2,
    });
  });

  it("skips rows that are entirely empty", () => {
    const buf = buildXlsx([
      ["first name", "phone", "עיר", "מס׳ תעודת זהות"],
      ["אברהם", "972502977325", "תל אביב", "123456782"],
      ["", "", "", ""],
      ["שרה", "972506404601", "חיפה", "111111118"],
    ]);
    const result = parseLeadsXlsx(buf);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1].first_name).toBe("שרה");
    expect(result.rows[1].source_row_number).toBe(4);
  });

  it("preserves Excel '=+' artifacts in the phone column verbatim (normalization happens later)", () => {
    const buf = buildXlsx([
      ["first name", "phone", "עיר", "מס׳ תעודת זהות"],
      ["אברהם", "=+972506404601", "תל אביב", "123456782"],
    ]);
    const result = parseLeadsXlsx(buf);
    expect(result.rows[0].phone).toBe("=+972506404601");
  });

  it("returns empty rows when the header row is missing", () => {
    const buf = buildXlsx([]);
    const result = parseLeadsXlsx(buf);
    expect(result.rows).toEqual([]);
  });

  it("matches the live sheet header 'מה מספר תעודת הזהות?' for the ID column", () => {
    const buf = buildXlsx([
      ["first name", "phone", "עיר", "מה מספר תעודת הזהות?"],
      ["אברהם", "972502977325", "תל אביב", "324374198"],
    ]);
    const result = parseLeadsXlsx(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id_number).toBe("324374198");
  });

  it("falls back to substring keyword match when the ID header is phrased unexpectedly", () => {
    const buf = buildXlsx([
      ["first name", "phone", "עיר", "אנא הזן תעודת זהות מלאה"],
      ["אברהם", "972502977325", "תל אביב", "324374198"],
    ]);
    const result = parseLeadsXlsx(buf);
    expect(result.rows[0].id_number).toBe("324374198");
  });
});
