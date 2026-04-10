import { describe, it, expect } from "vitest";
import {
  normalizeEmployeeNumber,
  normalizeStatus,
  normalizeCertTypeName,
  parseExcel,
} from "@/lib/excel-parser";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// normalizeEmployeeNumber
// ---------------------------------------------------------------------------
describe("normalizeEmployeeNumber", () => {
  it("returns alphanumeric characters only", () => {
    expect(normalizeEmployeeNumber("123456789")).toBe("123456789");
  });

  it("strips dashes and spaces", () => {
    expect(normalizeEmployeeNumber("123-456-789")).toBe("123456789");
    expect(normalizeEmployeeNumber(" 123 456 ")).toBe("123456");
  });

  it("strips special characters", () => {
    expect(normalizeEmployeeNumber("12/34.56")).toBe("123456");
    expect(normalizeEmployeeNumber("abc!@#123")).toBe("abc123");
  });

  it("handles leading/trailing whitespace", () => {
    expect(normalizeEmployeeNumber("  12345  ")).toBe("12345");
  });

  it("preserves letters (passport-style IDs)", () => {
    expect(normalizeEmployeeNumber("AB123456")).toBe("AB123456");
    expect(normalizeEmployeeNumber("ab-123-456")).toBe("ab123456");
  });

  it("handles numeric input via toString", () => {
    // The function calls raw.toString() so numbers are valid input
    expect(normalizeEmployeeNumber(12345 as unknown as string)).toBe("12345");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeEmployeeNumber("")).toBe("");
    expect(normalizeEmployeeNumber("   ")).toBe("");
  });

  it("strips Hebrew characters (non-alphanumeric)", () => {
    expect(normalizeEmployeeNumber("עובד123")).toBe("123");
  });
});

// ---------------------------------------------------------------------------
// normalizeStatus
// ---------------------------------------------------------------------------
describe("normalizeStatus", () => {
  describe("returns default when input is empty/missing/dash", () => {
    it("returns default for undefined", () => {
      expect(normalizeStatus(undefined)).toEqual({ value: "פעיל", warning: false });
    });

    it("returns default for empty string", () => {
      expect(normalizeStatus("")).toEqual({ value: "פעיל", warning: false });
    });

    it("returns default for whitespace-only string", () => {
      expect(normalizeStatus("   ")).toEqual({ value: "פעיל", warning: false });
    });

    it("returns default for dash", () => {
      expect(normalizeStatus("-")).toEqual({ value: "פעיל", warning: false });
    });

    it("uses custom defaultStatus when provided", () => {
      expect(normalizeStatus("", 'חל"ת')).toEqual({ value: 'חל"ת', warning: false });
      expect(normalizeStatus(undefined, "לא פעיל")).toEqual({ value: "לא פעיל", warning: false });
    });
  });

  describe("maps known Hebrew status values", () => {
    it('maps "פעיל" to "פעיל"', () => {
      expect(normalizeStatus("פעיל")).toEqual({ value: "פעיל", warning: false });
    });

    it('maps "חלת" to חל"ת', () => {
      expect(normalizeStatus("חלת")).toEqual({ value: 'חל"ת', warning: false });
    });

    it('maps חל"ת (with regular quotes) to חל"ת', () => {
      expect(normalizeStatus('חל"ת')).toEqual({ value: 'חל"ת', warning: false });
    });

    it("maps חל״ת (with gershayim) to חל\"ת", () => {
      expect(normalizeStatus("חל״ת")).toEqual({ value: 'חל"ת', warning: false });
    });

    it('maps "מחלה" to "מחלה"', () => {
      expect(normalizeStatus("מחלה")).toEqual({ value: "מחלה", warning: false });
    });

    it('maps "לא פעיל" to "לא פעיל"', () => {
      expect(normalizeStatus("לא פעיל")).toEqual({ value: "לא פעיל", warning: false });
    });

    it('maps "ללא הסמכה - לבירור" to itself', () => {
      expect(normalizeStatus("ללא הסמכה - לבירור")).toEqual({
        value: "ללא הסמכה - לבירור",
        warning: false,
      });
    });
  });

  describe("handles unknown status values with warning", () => {
    it("returns default with warning for unknown value", () => {
      expect(normalizeStatus("unknown")).toEqual({ value: "פעיל", warning: true });
    });

    it("uses custom defaultStatus with warning for unknown value", () => {
      expect(normalizeStatus("something", "לא פעיל")).toEqual({
        value: "לא פעיל",
        warning: true,
      });
    });
  });

  describe("trims input before matching", () => {
    it("trims leading/trailing whitespace", () => {
      expect(normalizeStatus("  פעיל  ")).toEqual({ value: "פעיל", warning: false });
    });

    it("trims dash with spaces", () => {
      expect(normalizeStatus(" - ")).toEqual({ value: "פעיל", warning: false });
    });
  });
});

// ---------------------------------------------------------------------------
// normalizeCertTypeName
// ---------------------------------------------------------------------------
describe("normalizeCertTypeName", () => {
  describe("empty / null / undefined / dash input", () => {
    it("returns [] for empty string", () => {
      expect(normalizeCertTypeName("")).toEqual([]);
    });

    it("returns [] for null (coerced)", () => {
      expect(normalizeCertTypeName(null as unknown as string)).toEqual([]);
    });

    it("returns [] for undefined (coerced)", () => {
      expect(normalizeCertTypeName(undefined as unknown as string)).toEqual([]);
    });

    it('returns [] for "-"', () => {
      expect(normalizeCertTypeName("-")).toEqual([]);
    });

    it("returns [] for whitespace-only", () => {
      expect(normalizeCertTypeName("   ")).toEqual([]);
    });
  });

  describe("filters out status values that appear in cert column", () => {
    it('filters "חלת"', () => {
      expect(normalizeCertTypeName("חלת")).toEqual([]);
    });

    it('filters "מחלה"', () => {
      expect(normalizeCertTypeName("מחלה")).toEqual([]);
    });

    it('filters "פעיל"', () => {
      expect(normalizeCertTypeName("פעיל")).toEqual([]);
    });

    it('filters "לא פעיל"', () => {
      expect(normalizeCertTypeName("לא פעיל")).toEqual([]);
    });

    it('filters חל"ת (regular quotes)', () => {
      expect(normalizeCertTypeName('חל"ת')).toEqual([]);
    });

    it("filters חל״ת (gershayim)", () => {
      expect(normalizeCertTypeName("חל״ת")).toEqual([]);
    });
  });

  describe("PFI normalization", () => {
    it('normalizes "PFI" to ["PFI"]', () => {
      expect(normalizeCertTypeName("PFI")).toEqual(["PFI"]);
    });

    it("is case insensitive — lowercase", () => {
      expect(normalizeCertTypeName("pfi")).toEqual(["PFI"]);
    });

    it("is case insensitive — mixed case", () => {
      expect(normalizeCertTypeName("Pfi")).toEqual(["PFI"]);
      expect(normalizeCertTypeName("pFi")).toEqual(["PFI"]);
    });

    it("handles PFI with surrounding whitespace", () => {
      expect(normalizeCertTypeName("  PFI  ")).toEqual(["PFI"]);
    });
  });

  describe('נת״ע normalization', () => {
    it('returns ["נת״ע"] for exact נת״ע', () => {
      expect(normalizeCertTypeName("נת״ע")).toEqual(["נת״ע"]);
    });

    it("normalizes נתע (no quotes) to נת״ע", () => {
      expect(normalizeCertTypeName("נתע")).toEqual(["נת״ע"]);
    });

    it('normalizes נת"ע (regular quotes) to נת״ע', () => {
      expect(normalizeCertTypeName('נת"ע')).toEqual(["נת״ע"]);
    });

    it('normalizes "מאושר נתע" (with prefix) to ["נת״ע"]', () => {
      expect(normalizeCertTypeName("מאושר נתע")).toEqual(["נת״ע"]);
    });

    it('normalizes "מאושר נת״ע" to ["נת״ע"]', () => {
      expect(normalizeCertTypeName("מאושר נת״ע")).toEqual(["נת״ע"]);
    });

    it("normalizes נתי״ע variant to נת״ע", () => {
      // The regex /נת[י]?״?ע/ matches נתי after gershayim normalization + ע
      expect(normalizeCertTypeName("נתיע")).toEqual(["נת״ע"]);
    });
  });

  describe("כביש 6 normalization", () => {
    it('returns ["כביש 6"] for exact match', () => {
      expect(normalizeCertTypeName("כביש 6")).toEqual(["כביש 6"]);
    });

    it("handles כביש6 without space", () => {
      expect(normalizeCertTypeName("כביש6")).toEqual(["כביש 6"]);
    });
  });

  describe("dual cert detection", () => {
    it('parses "כביש 6 ונת״ע" to two certs', () => {
      expect(normalizeCertTypeName("כביש 6 ונת״ע")).toEqual(["כביש 6", "נת״ע"]);
    });

    it('parses "נת״ע כביש 6" (reverse order) to two certs', () => {
      const result = normalizeCertTypeName("נת״ע כביש 6");
      expect(result).toEqual(["כביש 6", "נת״ע"]);
    });

    it('parses "כביש 6 נת״ע" (no conjunction) to two certs', () => {
      const result = normalizeCertTypeName("כביש 6 נת״ע");
      expect(result).toEqual(["כביש 6", "נת״ע"]);
    });

    it('parses "כביש 6 ונתע" (no gershayim in nataa) to two certs', () => {
      const result = normalizeCertTypeName("כביש 6 ונתע");
      expect(result).toEqual(["כביש 6", "נת״ע"]);
    });

    it("always returns כביש 6 before נת״ע regardless of input order", () => {
      const a = normalizeCertTypeName("נת״ע וכביש 6");
      const b = normalizeCertTypeName("כביש 6 ונת״ע");
      expect(a).toEqual(["כביש 6", "נת״ע"]);
      expect(b).toEqual(["כביש 6", "נת״ע"]);
    });
  });

  describe("unknown values — passthrough", () => {
    it("returns unknown cert name as-is in array", () => {
      expect(normalizeCertTypeName("הסמכה מיוחדת")).toEqual(["הסמכה מיוחדת"]);
    });

    it("trims the passthrough value", () => {
      expect(normalizeCertTypeName("  unknown cert  ")).toEqual(["unknown cert"]);
    });
  });
});

// ---------------------------------------------------------------------------
// parseExcel — integration tests using in-memory XLSX workbooks
// ---------------------------------------------------------------------------
describe("parseExcel", () => {
  /**
   * Helper: build a minimal XLSX buffer with the given sheets.
   * Each sheet is { name, rows } where rows[0] is the header row.
   */
  function buildXlsx(sheets: { name: string; rows: (string | number)[][] }[]): ArrayBuffer {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    }
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return buf;
  }

  it("parses a basic worker sheet with one worker", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס", "הסמכה", "הערות", "אחראי"],
          ["123456789", "כהן", "דוד", "פעיל", "נת״ע", "הערה", "מנהל"],
        ],
      },
    ]);

    const result = parseExcel(buf);

    expect(result.totalParsed).toBe(1);
    expect(result.totalSkipped).toBe(0);
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].name).toBe("מאושרי נת״ע");
    expect(result.sheets[0].isWorkerSheet).toBe(true);

    const worker = result.sheets[0].workers[0];
    expect(worker.employeeNumber).toBe("123456789");
    expect(worker.firstName).toBe("דוד");
    expect(worker.lastName).toBe("כהן");
    expect(worker.status).toBe("פעיל");
    expect(worker.notes).toBe("הערה");
    expect(worker.responsible).toBe("מנהל");
    expect(worker.certTypeName).toBe("נת״ע");
  });

  it("skips sheets listed in SKIP_SHEETS", () => {
    const buf = buildXlsx([
      {
        name: "ריכוז כל המשימות",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["123456789", "כהן", "דוד"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.sheets).toHaveLength(0);
    expect(result.totalParsed).toBe(0);
  });

  it("skips rows where employee number is too short (< 5 chars)", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123", "כהן", "דוד", "פעיל"],        // too short
          ["123456789", "לוי", "משה", "פעיל"],   // valid
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    expect(result.totalSkipped).toBe(1);
    expect(result.sheets[0].skippedRows).toHaveLength(1);
    expect(result.sheets[0].skippedRows[0].reason).toContain("מספר זהות לא תקין");
  });

  it("skips rows with missing first and last name", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["123456789", "", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(0);
    expect(result.totalSkipped).toBe(1);
    expect(result.sheets[0].skippedRows[0].reason).toContain("חסר שם פרטי ושם משפחה");
  });

  it("uses sheet-level default status when row status is empty", () => {
    const buf = buildXlsx([
      {
        name: "חלת - מחלה",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123456789", "כהן", "דוד", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.sheets[0].workers[0].status).toBe('חל"ת');
  });

  it("merges duplicate workers across sheets and accumulates cert types", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123456789", "כהן", "דוד", "פעיל"],
        ],
      },
      {
        name: "מאושרי כביש 6",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123456789", "כהן", "דוד", "פעיל"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(2);
    expect(result.uniqueWorkers.size).toBe(1);

    const merged = result.uniqueWorkers.get("123456789")!;
    expect(merged.certTypeNames).toContain("נת״ע");
    expect(merged.certTypeNames).toContain("כביש 6");
  });

  it("collects workers with no cert type into noCertWorkers (recomputed)", () => {
    const buf = buildXlsx([
      {
        name: "פעיל - ללא הסמכה מוגדרת",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123456789", "כהן", "דוד", "פעיל"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.noCertWorkers).toHaveLength(1);
    expect(result.noCertWorkers[0].employeeNumber).toBe("123456789");
  });

  it("worker who first appears without cert, then gets one via merge, is NOT in noCertWorkers", () => {
    const buf = buildXlsx([
      {
        name: "פעיל - ללא הסמכה מוגדרת",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123456789", "כהן", "דוד", "פעיל"],
        ],
      },
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123456789", "כהן", "דוד", "פעיל"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    // After merge, worker has נת״ע, so should NOT be in noCertWorkers
    expect(result.noCertWorkers).toHaveLength(0);
  });

  it("collects all discovered cert type names", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["123456789", "כהן", "דוד"],
        ],
      },
      {
        name: "PFI",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["987654321", "לוי", "משה"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.certTypeNames).toContain("נת״ע");
    expect(result.certTypeNames).toContain("PFI");
  });

  it("finds header row even if there are title rows before it", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["כותרת ראשית", "", ""],          // title row 1
          ["תת כותרת", "", ""],              // title row 2
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],  // header row at index 2
          ["123456789", "כהן", "דוד", "פעיל"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    expect(result.sheets[0].workers[0].employeeNumber).toBe("123456789");
  });

  it("replaces dash notes and responsible with empty string", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "הערות", "אחראי"],
          ["123456789", "כהן", "דוד", "-", "-"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.sheets[0].workers[0].notes).toBe("");
    expect(result.sheets[0].workers[0].responsible).toBe("");
  });

  it("skips section separator rows starting with emoji markers", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["✓ פעילים - תקינים (53)", "", ""],     // separator
          ["123456789", "כהן", "דוד"],              // valid worker
          ["⚠ דורשים תשומת לב", "", ""],            // separator
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    expect(result.sheets[0].workers).toHaveLength(1);
  });

  it("per-row cert type column overrides sheet-level cert type", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "הסמכה"],
          ["123456789", "כהן", "דוד", "כביש 6"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    // Row says כביש 6, which overrides the sheet-level נת״ע
    expect(result.sheets[0].workers[0].certTypeName).toBe("כביש 6");
  });

  it("falls back to sheet-level cert types when row cert column is empty", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי כביש 6",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "הסמכה"],
          ["123456789", "כהן", "דוד", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.sheets[0].workers[0].certTypeName).toBe("כביש 6");
  });

  it("sets statusWarning when row status is unknown", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס"],
          ["123456789", "כהן", "דוד", "סטטוס לא ידוע"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.sheets[0].workers[0].statusWarning).toBe(true);
    // Falls back to sheet default "פעיל"
    expect(result.sheets[0].workers[0].status).toBe("פעיל");
  });

  it("sets firstName/lastName to 'לא ידוע' when only one name is present", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["123456789", "כהן", ""],   // no first name
          ["987654321", "", "משה"],   // no last name
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.sheets[0].workers[0].firstName).toBe("לא ידוע");
    expect(result.sheets[0].workers[0].lastName).toBe("כהן");
    expect(result.sheets[0].workers[1].firstName).toBe("משה");
    expect(result.sheets[0].workers[1].lastName).toBe("לא ידוע");
  });

  it("merges notes from duplicate workers across sheets", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "הערות"],
          ["123456789", "כהן", "דוד", "הערה ראשונה"],
        ],
      },
      {
        name: "מאושרי כביש 6",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "הערות"],
          ["123456789", "כהן", "דוד", "הערה שנייה"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    const merged = result.uniqueWorkers.get("123456789")!;
    expect(merged.notes).toContain("הערה ראשונה");
    expect(merged.notes).toContain("הערה שנייה");
  });

  it("ignores sheets that do not match any WORKER_SHEETS key", () => {
    const buf = buildXlsx([
      {
        name: "גיליון לא מוכר",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["123456789", "כהן", "דוד"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.sheets).toHaveLength(0);
    expect(result.totalParsed).toBe(0);
  });
});
