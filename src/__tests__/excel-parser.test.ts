import { describe, it, expect } from "vitest";
import {
  normalizeEmployeeNumber,
  normalizeStatus,
  normalizeCertTypeName,
  parseExcel,
  parseExcelDate,
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
    it('normalizes "PFI" to ["חוצה צפון (PFI)"]', () => {
      expect(normalizeCertTypeName("PFI")).toEqual(["חוצה צפון (PFI)"]);
    });

    it("is case insensitive — lowercase", () => {
      expect(normalizeCertTypeName("pfi")).toEqual(["חוצה צפון (PFI)"]);
    });

    it("is case insensitive — mixed case", () => {
      expect(normalizeCertTypeName("Pfi")).toEqual(["חוצה צפון (PFI)"]);
      expect(normalizeCertTypeName("pFi")).toEqual(["חוצה צפון (PFI)"]);
    });

    it("handles PFI with surrounding whitespace", () => {
      expect(normalizeCertTypeName("  PFI  ")).toEqual(["חוצה צפון (PFI)"]);
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
    expect(result.certTypeNames).toContain("חוצה צפון (PFI)");
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

  // -------------------------------------------------------------------------
  // Date column capture with two-regime disambiguation
  // -------------------------------------------------------------------------
  describe("date columns", () => {
    it("regime 1: both columns populated → issue + next_refresh, expiry null", () => {
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "01/06/2025", "01/06/2026"],
          ],
        },
      ]);
      const result = parseExcel(buf);
      const worker = result.sheets[0].workers[0];
      expect(worker.certDates).toEqual({
        issue_date: "2025-06-01",
        expiry_date: null,
        next_refresh_date: "2026-06-01",
      });
    });

    it("regime 2: only תוקף תעודה populated → expiry only", () => {
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "01/12/2026", ""],
          ],
        },
      ]);
      const result = parseExcel(buf);
      const worker = result.sheets[0].workers[0];
      expect(worker.certDates).toEqual({
        issue_date: null,
        expiry_date: "2026-12-01",
        next_refresh_date: null,
      });
    });

    it("both columns empty on a cert sheet → row is skipped as 'הסמכה ללא תאריכים'", () => {
      // Behavior updated 2026-04-19: silently accepting all-empty-dates on a
      // cert sheet creates unrecoverable "לא ידוע" certs that reminders can
      // never fire for. Parser now routes these into skippedRows instead.
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "", ""],
          ],
        },
      ]);
      const result = parseExcel(buf);
      expect(result.totalParsed).toBe(0);
      expect(result.sheets[0].skippedRows[0].reason).toContain("הסמכה ללא תאריכים");
    });

    it("garbage refresh value falls back to regime 2", () => {
      const buf = buildXlsx([
        {
          name: "מאושרי נת״ע",
          rows: [
            ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
            ["123456789", "כהן", "דוד", "01/12/2026", "not a date"],
          ],
        },
      ]);
      const result = parseExcel(buf);
      const worker = result.sheets[0].workers[0];
      // Invalid refresh → treat as regime 2 (expiry-only)
      expect(worker.certDates).toEqual({
        issue_date: null,
        expiry_date: "2026-12-01",
        next_refresh_date: null,
      });
    });
  });

  it("merges per-cert-type dates across sheets for the same worker", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          // regime 1 on נת״ע
          ["123456789", "כהן", "דוד", "01/06/2025", "01/06/2026"],
        ],
      },
      {
        name: "מאושרי כביש 6",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          // regime 2 on כביש 6
          ["123456789", "כהן", "דוד", "01/12/2027", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    const merged = result.uniqueWorkers.get("123456789")!;
    expect(merged.certTypeNames.sort()).toEqual(["כביש 6", "נת״ע"]);
    expect(merged.certDatesByType["נת״ע"]).toEqual({
      issue_date: "2025-06-01",
      expiry_date: null,
      next_refresh_date: "2026-06-01",
    });
    expect(merged.certDatesByType["כביש 6"]).toEqual({
      issue_date: null,
      expiry_date: "2027-12-01",
      next_refresh_date: null,
    });
  });

  // Regression: real נת״ע file exported April 2026 uses header "תעודת זהות"
  // (cert-of-identity) instead of "מספר זהות" (id number). Sheet name has
  // a suffix "לשיבוץ". Layout has title/summary/blank rows before the header.
  // Before this fix: all 71 rows were skipped with "מספר זהות לא תקין".
  it("parses the real-world נת״ע export whose ID column is named 'תעודת זהות'", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע לשיבוץ",
        rows: [
          [], // empty row (file has whitespace before title)
          ["רשימת מאושרי נת״ע לשיבוץ — פיקוח והכוונה"],
          [],
          ["עודכן: 09/04/2026  |  סה״כ: 71 עובדים  |  תעודות זהות מאומתות: 61/71"],
          [],
          [],
          ["מס׳", "שם פרטי", "שם משפחה", "תעודת זהות", "תוקף תעודה", "מועד רענון הבא", "סטטוס"],
          ["1", "ישראל", "ישראלי", "123456789", "24/07/2024", "26/06/2026", "מאומת"],
          ["2", "משה", "כהן", "987654321", "24/07/2024", "26/06/2026", "מאומת"],
        ],
      },
    ]);

    const result = parseExcel(buf);

    expect(result.totalSkipped).toBe(0);
    expect(result.totalParsed).toBe(2);
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].name).toBe("מאושרי נת״ע לשיבוץ");

    const first = result.sheets[0].workers[0];
    expect(first.employeeNumber).toBe("123456789");
    expect(first.firstName).toBe("ישראל");
    expect(first.lastName).toBe("ישראלי");
    // Sheet-name match ("מאושרי נת״ע") supplies the default cert type
    expect(first.certTypeName).toBe("נת״ע");
  });
});

// ---------------------------------------------------------------------------
// parseExcelDate
// ---------------------------------------------------------------------------

describe("parseExcelDate", () => {
  it("returns null for empty, undefined, dash, whitespace", () => {
    expect(parseExcelDate(undefined)).toBeNull();
    expect(parseExcelDate(null)).toBeNull();
    expect(parseExcelDate("")).toBeNull();
    expect(parseExcelDate("-")).toBeNull();
    expect(parseExcelDate("   ")).toBeNull();
  });

  it("parses an Excel date serial number (days since 1900)", () => {
    // 45658 is 2025-01-01 in Excel's calendar (roughly — with the classic off-by-one)
    // 45292 is 2024-01-01
    expect(parseExcelDate(45292)).toBe("2024-01-01");
    expect(parseExcelDate(45658)).toBe("2025-01-01");
  });

  it("parses an ISO-style string date", () => {
    expect(parseExcelDate("2025-06-01")).toBe("2025-06-01");
    expect(parseExcelDate("2024-12-31")).toBe("2024-12-31");
  });

  it("parses a DD/MM/YYYY string (Hebrew locale format)", () => {
    expect(parseExcelDate("01/06/2025")).toBe("2025-06-01");
    expect(parseExcelDate("31/12/2024")).toBe("2024-12-31");
  });

  it("parses a DD.MM.YYYY string", () => {
    expect(parseExcelDate("01.06.2025")).toBe("2025-06-01");
  });

  it("parses a DD-MM-YYYY string", () => {
    expect(parseExcelDate("01-06-2025")).toBe("2025-06-01");
  });

  it("returns null for garbage strings", () => {
    expect(parseExcelDate("not a date")).toBeNull();
    expect(parseExcelDate("abc/def/ghi")).toBeNull();
  });

  it("returns null for impossible dates", () => {
    expect(parseExcelDate("32/01/2025")).toBeNull(); // day 32
    expect(parseExcelDate("01/13/2025")).toBeNull(); // month 13
  });

  it("accepts a Date object (xlsx sometimes parses serials eagerly)", () => {
    expect(parseExcelDate(new Date(2025, 5, 1))).toBe("2025-06-01"); // June is month index 5
  });
});

// ---------------------------------------------------------------------------
// parseExcel — header alias coverage for real-world Pikoh variants
//
// Real managers often upload files whose Hebrew headers differ from the
// canonical Pikoh export (e.g. "תאריך תוקף" instead of "תוקף תעודה",
// "רענון" instead of "מועד רענון הבא", "מצב" instead of "סטטוס"). Journey 06
// of the agent test harness (report 2026-04-19-1554) surfaced a P0 where
// such variants silently dropped data. These tests fix the alias map.
// ---------------------------------------------------------------------------
describe("parseExcel — header alias coverage", () => {
  function buildXlsx(sheets: { name: string; rows: (string | number)[][] }[]): ArrayBuffer {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    }
    return XLSX.write(wb, { type: "array", bookType: "xlsx" });
  }

  it("reads status from the 'מצב' header variant", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "מצב", "הסמכה"],
          ["123456789", "כהן", "דוד", "לא פעיל", "נת״ע"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    expect(result.sheets[0].workers[0].status).toBe("לא פעיל");
  });

  it("reads issue date from the 'תאריך תוקף' header variant (regime 1 with refresh)", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס", "הסמכה", "תאריך תוקף", "רענון"],
          ["123456789", "כהן", "דוד", "פעיל", "נת״ע", "15/03/2025", "15/03/2027"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    const worker = result.sheets[0].workers[0];
    expect(worker.certDates.issue_date).toBe("2025-03-15");
    expect(worker.certDates.next_refresh_date).toBe("2027-03-15");
    expect(worker.certDates.expiry_date).toBeNull();
  });

  it("reads expiry date from the 'תאריך תוקף' header variant (regime 2, no refresh)", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס", "הסמכה", "תאריך תוקף"],
          ["123456789", "כהן", "דוד", "פעיל", "כביש 6", "30/06/2027"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    const worker = result.sheets[0].workers[0];
    expect(worker.certDates.expiry_date).toBe("2027-06-30");
    expect(worker.certDates.issue_date).toBeNull();
    expect(worker.certDates.next_refresh_date).toBeNull();
  });

  it("reads refresh date from the 'רענון' header variant", () => {
    // Regime 1 is triggered when moedRenoon is populated, so both the
    // variant refresh header AND the issue date must land correctly.
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס", "הסמכה", "תוקף תעודה", "רענון"],
          ["123456789", "לוי", "מיכל", "פעיל", "נת״ע", "01/07/2024", "01/07/2026"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    const worker = result.sheets[0].workers[0];
    expect(worker.certDates.next_refresh_date).toBe("2026-07-01");
    expect(worker.certDates.issue_date).toBe("2024-07-01");
  });

  it("canonical headers continue to work (regression guard)", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "סטטוס", "הסמכה", "תוקף תעודה", "מועד רענון הבא"],
          ["123456789", "כהן", "דוד", "פעיל", "נת״ע", "15/03/2025", "15/03/2027"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    const worker = result.sheets[0].workers[0];
    expect(worker.status).toBe("פעיל");
    expect(worker.certDates.issue_date).toBe("2025-03-15");
    expect(worker.certDates.next_refresh_date).toBe("2027-03-15");
  });
});

// ---------------------------------------------------------------------------
// parseExcel — data-quality sanity checks (Group B from 2026-04-19 triage)
//
// Journey 04 × adversarial (report 2026-04-19-1519) surfaced five silent-
// acceptance bugs where the parser had two code paths ("hard skip with
// reason" vs. "soft fill with null"). The soft path dropped information
// without telling the user. These tests unify them — every compromised
// row must appear in `skippedRows` with a specific reason.
// ---------------------------------------------------------------------------
describe("parseExcel — data-quality sanity checks", () => {
  function buildXlsx(sheets: { name: string; rows: (string | number)[][] }[]): ArrayBuffer {
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    }
    return XLSX.write(wb, { type: "array", bookType: "xlsx" });
  }

  // B1: invalid date string in תוקף תעודה is silently dropped today.
  // Should: skip the row with reason "תאריך תוקף לא תקין".
  it("B1: non-parseable תוקף תעודה value skips the row with a dedicated reason", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          ["123456789", "כהן", "דוד", "not a date", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(0);
    expect(result.totalSkipped).toBe(1);
    const skipped = result.sheets[0].skippedRows[0];
    expect(skipped.reason).toContain("תאריך תוקף לא תקין");
    expect(skipped.reason).toContain("not a date");
  });

  // B1 companion: even if refresh IS valid (regime 1), a bad primary cell
  // still hides data. Must still skip with the primary-field reason.
  it("B1: bad primary date still skips even when refresh is valid", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          ["123456789", "כהן", "דוד", "not a date", "01/06/2026"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(0);
    expect(result.sheets[0].skippedRows[0].reason).toContain("תאריך תוקף לא תקין");
  });

  // B3: far-future date (>10y from now) is silently accepted today.
  // Should: skip with a dedicated reason so the manager can correct it.
  it("B3: date more than 10 years in the future skips with a dedicated reason", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          ["123456789", "כהן", "דוד", "01/01/2099", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(0);
    expect(result.sheets[0].skippedRows[0].reason).toContain("תאריך בעתיד רחוק");
  });

  // B3 companion: near-future dates (within 10 years) MUST still parse.
  // Regression guard — the real-world Pikoh file has dates in 2026/2027.
  it("B3: date within 10 years continues to parse (regression guard)", () => {
    const nearFuture = `01/01/${new Date().getFullYear() + 5}`;
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          ["123456789", "כהן", "דוד", nearFuture, ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(1);
    expect(result.totalSkipped).toBe(0);
  });

  // B4: name with SQL-injection-style punctuation is rendered verbatim.
  // DB is safe via parameterized queries, but the UI shows junk names.
  // Should: reject names containing characters outside [letters, space, ', -, .].
  it("B4: name with SQL-injection-style punctuation skips with a dedicated reason", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["123456789", "Robert'); DROP TABLE employees;--", "דוד"],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(0);
    const skipped = result.sheets[0].skippedRows[0];
    expect(skipped.reason).toContain("שם לא תקין");
  });

  // B4 companion: realistic names must still parse. Hebrew, Arabic, English,
  // apostrophe ("O'Brien"), hyphen ("Ben-David"), period ("St. John").
  it("B4: realistic names (Hebrew / apostrophe / hyphen / English) continue to parse", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי"],
          ["111111111", "כהן-לוי", "אבנר"],   // hyphen + Hebrew
          ["222222222", "O'Brien", "Patrick"], // apostrophe + English
          ["333333333", "St. John", "Mary"],   // period
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(3);
    expect(result.totalSkipped).toBe(0);
  });

  // B5: cert sheet row with ALL three dates empty is silently imported
  // today. The resulting cert has status `לא ידוע`, and reminders can
  // never fire for it. Should: skip with reason "הסמכה ללא תאריכים"
  // when the sheet expects certs.
  it("B5: all-empty-dates on a cert sheet skips with a dedicated reason", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          ["123456789", "כהן", "דוד", "", ""],
        ],
      },
    ]);

    const result = parseExcel(buf);
    expect(result.totalParsed).toBe(0);
    expect(result.sheets[0].skippedRows[0].reason).toContain("הסמכה ללא תאריכים");
  });

  // B5 companion: sheets that do NOT expect a cert type (e.g. "פעיל - ללא הסמכה מוגדרת")
  // must still import rows with empty dates — the row legitimately has no cert.
  it("B5: no-cert sheets still accept rows with empty dates", () => {
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
    expect(result.totalParsed).toBe(1);
    expect(result.totalSkipped).toBe(0);
  });

  // B2: the `שורות שדולגו` panel should now surface ALL of the above
  // drop reasons, not just bad Israeli IDs. Rolling into one composite.
  it("B2: skippedRows panel reports each specific data-quality reason", () => {
    const buf = buildXlsx([
      {
        name: "מאושרי נת״ע",
        rows: [
          ["מספר זהות", "שם משפחה", "שם פרטי", "תוקף תעודה", "מועד רענון הבא"],
          ["111111111", "כהן", "דוד", "not a date", ""],         // B1
          ["222222222", "לוי", "משה", "01/01/2099", ""],          // B3
          ["333333333", "DROP;--", "רחל", "01/01/2026", ""],      // B4
          ["444444444", "גרין", "יואב", "", ""],                  // B5
          ["abc", "תקף", "שם", "01/01/2026", ""],                 // classic bad ID
        ],
      },
    ]);

    const result = parseExcel(buf);
    const reasons = result.sheets[0].skippedRows.map(r => r.reason);
    expect(reasons.length).toBe(5);
    expect(reasons.some(r => r.includes("תאריך תוקף לא תקין"))).toBe(true);
    expect(reasons.some(r => r.includes("תאריך בעתיד רחוק"))).toBe(true);
    expect(reasons.some(r => r.includes("שם לא תקין"))).toBe(true);
    expect(reasons.some(r => r.includes("הסמכה ללא תאריכים"))).toBe(true);
    expect(reasons.some(r => r.includes("מספר זהות לא תקין"))).toBe(true);
  });
});
