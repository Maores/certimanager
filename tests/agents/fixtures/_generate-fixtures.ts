/**
 * _generate-fixtures.ts
 *
 * One-shot generator for the agent test harness xlsx fixtures.
 * Run with:   npx tsx tests/agents/fixtures/_generate-fixtures.ts
 *
 * Produces three files in this same directory:
 *   pikoh-happy.xlsx  — 10 clean data rows (4 cert types, 10 unique employees)
 *   pikoh-dirty.xlsx  — 10 rows, each seeded with one known problem
 *   pikoh-empty.xlsx  — header row only (0 data rows)
 *
 * Library: xlsx (SheetJS) — already installed in the project.
 *
 * Parser contract (src/lib/excel-parser.ts):
 *   - Sheet names must match a key in WORKER_SHEETS:
 *       "מאושרי נת״ע"   → cert type נת״ע
 *       "מאושרי כביש 6" → cert type כביש 6
 *   - Header row must contain "מספר זהות" (or aliases) AND "שם משפחה".
 *   - Per-row "הסמכה" column overrides the sheet-level cert type.
 *   - Two-regime date disambig:
 *       Regime 1: "מועד רענון הבא" present → תוקף תעודה = issue, מועד רענון הבא = next_refresh
 *       Regime 2: "מועד רענון הבא" absent/empty → תוקף תעודה = expiry
 *   - Employee number must normalise to ≥ 5 alphanumeric chars to survive skip.
 *   - Dates accepted as DD/MM/YYYY strings.
 */

import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUT_DIR = __dirname;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function outPath(name: string): string {
  return resolve(OUT_DIR, name);
}

function buildWorkbook(
  sheets: { name: string; rows: (string | number | null)[][] }[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }
  return wb;
}

function writeXlsx(wb: XLSX.WorkBook, filename: string): void {
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  writeFileSync(outPath(filename), buf);
  console.log(`Written: ${filename}  (${buf.length} bytes)`);
}

// Standard header columns that the parser can read.
// Parser looks for: מספר זהות, שם משפחה, שם פרטי, סטטוס, הסמכה, תוקף תעודה, מועד רענון הבא
const HEADERS = [
  "מספר זהות",
  "שם משפחה",
  "שם פרטי",
  "סטטוס",
  "הסמכה",
  "תוקף תעודה",
  "מועד רענון הבא",
];

// ---------------------------------------------------------------------------
// pikoh-happy.xlsx
//
// 10 unique employees, IDs not present in seed.sql (seed has 123456789,
// 234567890, 345678901, 456789012, 567890123).
//
// Distribution across 4 cert types: 4 נת״ע, 3 כביש 6, 2 חוצה ישראל, 1 נתיבי ישראל
//
// Regime 1 (נת״ע): "מועד רענון הבא" populated → תוקף תעודה=issue, מועד רענון הבא=next_refresh
// Regime 2 (כביש 6, חוצה ישראל, נתיבי ישראל): "מועד רענון הבא" empty → תוקף תעודה=expiry
//
// Per-row "הסמכה" column overrides sheet cert type, so we put all rows on
// "מאושרי נת״ע" but override the non-נת״ע rows via the הסמכה column.
// ---------------------------------------------------------------------------

function buildHappy(): XLSX.WorkBook {
  // [empNum, lastName, firstName, status, certType, tokefTeuda, moedRenoon]
  // Regime 1 rows (נת״ע): moedRenoon populated
  // Regime 2 rows (others): moedRenoon empty
  const dataRows: (string | number | null)[][] = [
    // נת״ע — regime 1 (4 rows)
    ["600001111", "גלעד",    "נועם",   "פעיל", "נת״ע",         "15/03/2025", "15/03/2027"],
    ["600002222", "שטרן",    "מיכל",   "פעיל", "נת״ע",         "01/07/2024", "01/07/2026"],
    ["600003333", "בן-דוד",  "עמית",   "פעיל", "נת״ע",         "10/11/2023", "10/11/2025"],
    ["600004444", "מזרחי",   "גלית",   "פעיל", "נת״ע",         "20/01/2026", "20/01/2028"],
    // כביש 6 — regime 2 (3 rows)
    ["600005555", "זוהר",    "ירון",   "פעיל", "כביש 6",       "30/06/2027", ""],
    ["600006666", "אלוש",    "שרה",    "פעיל", "כביש 6",       "15/09/2026", ""],
    ["600007777", "חדד",     "אלי",    "פעיל", "כביש 6",       "01/03/2028", ""],
    // חוצה ישראל — regime 2 (2 rows)
    ["600008888", "רוזן",    "תמר",    "פעיל", "חוצה ישראל",   "31/12/2026", ""],
    ["600009999", "ביטון",   "אורי",   "פעיל", "חוצה ישראל",   "28/02/2027", ""],
    // נתיבי ישראל — regime 2 (1 row)
    ["600010101", "עזרא",    "נורית",  "פעיל", "נתיבי ישראל",  "30/09/2025", ""],
  ];

  return buildWorkbook([
    {
      name: "מאושרי נת״ע",
      rows: [HEADERS, ...dataRows],
    },
  ]);
}

// ---------------------------------------------------------------------------
// pikoh-dirty.xlsx
//
// 10 rows, one problem each. The parser will skip some (bad ID, empty name)
// and pass others through with NULL dates or unknown cert types.
// Row J is the control — one clean row that SHOULD import cleanly.
// ---------------------------------------------------------------------------

function buildDirty(): XLSX.WorkBook {
  // [empNum, lastName, firstName, status, certType, tokefTeuda, moedRenoon]
  const dataRows: (string | number | null)[][] = [
    // Row A: invalid מספר זהות — too short (3 chars → normalises to length < 5 → skipped)
    // NOTE: first cell must be non-empty or the parser silently drops the row
    // without counting it. Use a short but non-empty value.
    ["123",       "כהן",    "ראובן",   "פעיל", "נת״ע",        "01/01/2026", "01/01/2027"],
    // Row B: issue date = "not a date" (parsed as null → regime 2 with null expiry)
    ["610001111", "לוי",    "שמעון",   "פעיל", "כביש 6",      "not a date", ""],
    // Row C: issue date = far future 2099-01-01 (valid date, unusual year)
    ["610002222", "הלוי",   "לוי",     "פעיל", "כביש 6",      "01/01/2099", ""],
    // Row D: SQL-injection-style name (parser treats as plain string — no injection risk)
    ["610003333", "Robert'); DROP TABLE employees;--", "innocent", "פעיל", "נת״ע", "01/06/2025", "01/06/2026"],
    // Row E: employee number = short placeholder (< 5 chars → skipped by empNum guard)
    ["456",       "פרץ",    "יהודה",   "פעיל", "נת״ע",        "15/04/2025", "15/04/2026"],
    // Row F: mixed Latin + Hebrew name
    ["610004444", "שמואלי", "John",    "פעיל", "נת״ע",        "01/08/2025", "01/08/2026"],
    // Row G: cert type = unknown (passes through as-is — unknown cert type name)
    ["610005555", "גורן",   "דינה",    "פעיל", "NOPE_UNKNOWN_TYPE", "01/09/2025", ""],
    // Row H: expiry earlier than issue (2020-01-01 < 2025-01-01) — parser does not validate order
    ["610006666", "אסולין", "יצחק",   "פעיל", "כביש 6",      "01/01/2020", ""],
    // Row I: all date columns empty → certDates all null
    ["610007777", "שפירא",  "חנה",     "פעיל", "נת״ע",        "",           ""],
    // Row J: clean control row — should import cleanly
    ["610008888", "דיין",   "שלמה",    "פעיל", "נת״ע",        "01/05/2025", "01/05/2027"],
  ];

  return buildWorkbook([
    {
      name: "מאושרי נת״ע",
      rows: [HEADERS, ...dataRows],
    },
  ]);
}

// ---------------------------------------------------------------------------
// pikoh-empty.xlsx — header only, zero data rows
// ---------------------------------------------------------------------------

function buildEmpty(): XLSX.WorkBook {
  return buildWorkbook([
    {
      name: "מאושרי נת״ע",
      rows: [HEADERS],
    },
  ]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

writeXlsx(buildHappy(), "pikoh-happy.xlsx");
writeXlsx(buildDirty(), "pikoh-dirty.xlsx");
writeXlsx(buildEmpty(), "pikoh-empty.xlsx");

console.log("All 3 fixtures generated successfully.");
