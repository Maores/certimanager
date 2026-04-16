import * as XLSX from "xlsx";

// --- Types ---

export interface CertDates {
  issue_date: string | null;
  expiry_date: string | null;
  next_refresh_date: string | null;
}

export interface ParsedWorker {
  employeeNumber: string;
  rawEmployeeNumber: string;
  firstName: string;
  lastName: string;
  status: string;
  statusWarning: boolean;
  notes: string;
  responsible: string;
  sourceSheet: string;
  certTypeName: string | null;
  certDates: CertDates;
}

export interface ParsedSheet {
  name: string;
  isWorkerSheet: boolean;
  certTypeName: string | null;
  workers: ParsedWorker[];
  skippedRows: SkippedRow[];
}

export interface SkippedRow {
  row: number;
  reason: string;
}

export interface ParseResult {
  sheets: ParsedSheet[];
  uniqueWorkers: Map<string, ParsedWorker & { certTypeNames: string[] }>;
  certTypeNames: string[];
  noCertWorkers: ParsedWorker[];
  totalParsed: number;
  totalSkipped: number;
}

// --- Constants ---
// NOTE: "כביש 6 + נת\"ע" must come BEFORE "כביש 6" to match the longer string first

interface SheetConfig {
  certTypes: string[];
  defaultStatus: string;
}

const WORKER_SHEETS: Record<string, SheetConfig> = {
  "מאושרי נת״ע": { certTypes: ["נת״ע"], defaultStatus: "פעיל" },
  "מאושרי כביש 6 + נת״ע": { certTypes: ["נת״ע", "כביש 6"], defaultStatus: "פעיל" },
  "מאושרי כביש 6": { certTypes: ["כביש 6"], defaultStatus: "פעיל" },
  "PFI": { certTypes: ["חוצה צפון (PFI)"], defaultStatus: "פעיל" },
  "פעיל - ללא הסמכה מוגדרת": { certTypes: [], defaultStatus: "פעיל" },
  "חלת - מחלה": { certTypes: [], defaultStatus: 'חל"ת' },
  "משימות להמשך טיפול": { certTypes: [], defaultStatus: "לא פעיל" },
  "ללא הסמכה - לבירור": { certTypes: [], defaultStatus: "ללא הסמכה - לבירור" },
};

const SKIP_SHEETS = [
  "ריכוז כל המשימות",
  "משימות לפי אחראי",
  "סיכום כללי",
];

const STATUS_MAP: Record<string, string> = {
  "פעיל": "פעיל",
  "חלת": 'חל"ת',
  'חל"ת': 'חל"ת',
  'חל״ת': 'חל"ת',
  "מחלה": "מחלה",
  "לא פעיל": "לא פעיל",
  "ללא הסמכה - לבירור": "ללא הסמכה - לבירור",
};

// --- Cert type normalization ---

/** Status values that sometimes appear in the cert-type column — filter these out */
const STATUS_VALUES_AS_CERT = new Set(["חלת", "מחלה", "פעיל", "לא פעיל", 'חל"ת', "חל״ת"]);

/** Canonical cert type names */
const CANONICAL_CERT_TYPES = ["נת״ע", "כביש 6", "חוצה ישראל", "נתיבי ישראל", "חוצה צפון (PFI)"] as const;

/**
 * Normalize a raw cert-type string from the "הסמכה" column into canonical names.
 * Returns an array because some values map to multiple cert types
 * (e.g. "כביש 6 ונת״ע" → ["כביש 6", "נת״ע"]).
 */
export function normalizeCertTypeName(raw: string): string[] {
  if (!raw) return [];
  let s = raw.trim();
  if (!s || s === "-") return [];

  // Filter out status values that were mistakenly placed in the cert column
  if (STATUS_VALUES_AS_CERT.has(s)) return [];

  // חוצה ישראל
  if (s === "חוצה ישראל") return ["חוצה ישראל"];

  // נתיבי ישראל
  if (s === "נתיבי ישראל") return ["נתיבי ישראל"];

  // חוצה צפון (PFI) — case-insensitive PFI + Hebrew variants
  if (/^pfi$/i.test(s) || s.includes("חוצה צפון")) {
    return ["חוצה צפון (PFI)"];
  }

  // Normalize all Hebrew gershayim variants for נת״ע:
  //   נתי"ע  נת"ע  נת״ע  נתע  מאושר נתע  → נת״ע
  const nativeNormalized = s
    .replace(/["""״]/g, "״") // unify quote marks
    .replace(/מאושר\s*/g, "") // strip "מאושר" prefix
    .trim();

  // Check for dual cert: "כביש 6 ונת״ע" / "נת״ע כביש 6" / "כביש 6 נת״ע" (any order, optional ו)
  const hasKvish6 = /כביש\s*6/.test(nativeNormalized);
  const hasNataa = /נת[י]?״?ע/.test(nativeNormalized);

  if (hasKvish6 && hasNataa) return ["כביש 6", "נת״ע"];
  if (hasKvish6) return ["כביש 6"];
  if (hasNataa) return ["נת״ע"];

  // If no pattern matched, return the trimmed original as-is (unknown cert type)
  return s ? [s] : [];
}

// --- Functions ---

export function normalizeEmployeeNumber(raw: string): string {
  return raw.toString().trim().replace(/[^a-zA-Z0-9]/g, "");
}

export function normalizeStatus(raw: string | undefined, defaultStatus = "פעיל"): { value: string; warning: boolean } {
  if (!raw || !raw.trim() || raw.trim() === "-") return { value: defaultStatus, warning: false };
  const trimmed = raw.trim();
  const mapped = STATUS_MAP[trimmed];
  if (mapped) return { value: mapped, warning: false };
  return { value: defaultStatus, warning: true };
}

/**
 * Parse a cell value from xlsx into a "YYYY-MM-DD" string or null.
 * Accepts Excel date serials (number), Date objects, and common string formats
 * including ISO (YYYY-MM-DD) and Hebrew-locale DD/MM/YYYY (also .- separators).
 * Returns null for empty, invalid, or impossible dates.
 */
export function parseExcelDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  // Date object: xlsx with cellDates:true produces these.
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return formatDateLocal(raw);
  }

  // Excel date serial (number): days since 1899-12-30 (Excel's epoch).
  if (typeof raw === "number") {
    if (!isFinite(raw) || raw <= 0) return null;
    // Excel serial 1 = 1900-01-01 (actually 1899-12-31 due to the 1900 leap bug).
    // The well-known formula: days since 1899-12-30.
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return formatDateLocalUTC(d);
  }

  // String: trim, reject empty/dash/whitespace, then try known formats.
  const s = String(raw).trim();
  if (!s || s === "-") return null;

  // ISO-like: YYYY-MM-DD (optionally with time suffix)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return validateYmd(+y, +m, +d);
  }

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY (Hebrew-locale common formats)
  const dmy = /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return validateYmd(+y, +m, +d);
  }

  return null;
}

function validateYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  // Use UTC to avoid timezone drift; validate that the round-trip matches.
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLocalUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function findHeaderRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const joined = row.map((c: any) => String(c || "")).join(" ");
    if (joined.includes("מספר זהות") || joined.includes("שם משפחה")) {
      return i;
    }
  }
  return -1;
}

export function parseExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets: ParsedSheet[] = [];
  const uniqueWorkers = new Map<string, ParsedWorker & { certTypeNames: string[] }>();
  const certTypeNames = new Set<string>();
  const noCertWorkers: ParsedWorker[] = [];
  let totalParsed = 0;
  let totalSkipped = 0;

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.some(s => sheetName.includes(s))) continue;

    const matchedKey = Object.keys(WORKER_SHEETS).find(k => sheetName.includes(k));
    if (!matchedKey) continue;

    const sheetConfig = WORKER_SHEETS[matchedKey];
    for (const ct of sheetConfig.certTypes) certTypeNames.add(ct);

    const worksheet = workbook.Sheets[sheetName];

    // Find header row dynamically (sheets have title + summary rows before headers)
    const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { defval: "", header: 1 });
    const headerIdx = findHeaderRow(rawRows);
    if (headerIdx < 0) continue;

    // Re-parse using discovered header row
    const headers = rawRows[headerIdx].map((h: any) => String(h || "").trim());
    const dataRows = rawRows.slice(headerIdx + 1);

    const parsedWorkers: ParsedWorker[] = [];
    const skippedRows: SkippedRow[] = [];

    // Build column index map
    const colIdx = (names: string[]) => {
      for (const n of names) {
        const idx = headers.findIndex((h: string) => h.includes(n));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const empNumCol = colIdx(["מספר זהות", "דרכון", "ת.ז", "תעודת זהות"]);
    const lastNameCol = colIdx(["שם משפחה"]);
    const firstNameCol = colIdx(["שם פרטי"]);
    const statusCol = colIdx(["סטטוס", "סטאטוס"]);
    const certNameCol = colIdx(["הסמכה"]);
    const notesCol = colIdx(["הערות", "משימות", "הערה"]);
    const responsibleCol = colIdx(["אחראי"]);
    const tokefTeudaCol = colIdx(["תוקף תעודה"]);
    const moedRenoonCol = colIdx(["מועד רענון הבא"]);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = headerIdx + i + 2; // 1-based Excel row

      // Skip section separator rows (e.g. "✓ פעילים - תקינים (53)")
      const firstCell = String(row[0] || "").trim();
      if (firstCell.startsWith("✓") || firstCell.startsWith("⚠") ||
          firstCell.startsWith("📋") || firstCell.startsWith("❓") ||
          firstCell.startsWith("❌") || firstCell === "") continue;

      const empNumRaw = empNumCol >= 0 ? String(row[empNumCol] || "") : "";
      const empNum = normalizeEmployeeNumber(empNumRaw);

      if (empNum.length < 5) {
        skippedRows.push({ row: rowNum, reason: `מספר זהות לא תקין: "${empNumRaw}"` });
        totalSkipped++;
        continue;
      }

      const firstName = firstNameCol >= 0 ? String(row[firstNameCol] || "").trim() : "";
      const lastName = lastNameCol >= 0 ? String(row[lastNameCol] || "").trim() : "";

      if (!firstName && !lastName) {
        skippedRows.push({ row: rowNum, reason: "חסר שם פרטי ושם משפחה" });
        totalSkipped++;
        continue;
      }

      const statusRaw = statusCol >= 0 ? String(row[statusCol] || "").trim() : "";
      const { value: status, warning: statusWarning } = normalizeStatus(statusRaw, sheetConfig.defaultStatus);

      const notesRaw = notesCol >= 0 ? String(row[notesCol] || "").trim() : "";
      const notes = notesRaw === "-" ? "" : notesRaw;
      const responsibleRaw = responsibleCol >= 0 ? String(row[responsibleCol] || "").trim() : "";
      const responsible = responsibleRaw === "-" ? "" : responsibleRaw;

      // --- Date columns with two-regime disambiguation ---
      const tokefTeudaRaw = tokefTeudaCol >= 0 ? row[tokefTeudaCol] : undefined;
      const moedRenoonRaw = moedRenoonCol >= 0 ? row[moedRenoonCol] : undefined;
      const moedRenoonParsed = parseExcelDate(moedRenoonRaw);
      const tokefTeudaParsed = parseExcelDate(tokefTeudaRaw);

      const certDates: CertDates =
        moedRenoonParsed !== null
          ? {
              issue_date: tokefTeudaParsed,
              expiry_date: null,
              next_refresh_date: moedRenoonParsed,
            }
          : {
              issue_date: null,
              expiry_date: tokefTeudaParsed,
              next_refresh_date: null,
            };

      // Determine cert types: prefer per-row "הסמכה" column, fall back to sheet-level
      const rowCertRaw = certNameCol >= 0 ? String(row[certNameCol] || "").trim() : "";
      const rowCertTypes = normalizeCertTypeName(rowCertRaw);
      const effectiveCertTypes = rowCertTypes.length > 0 ? rowCertTypes : sheetConfig.certTypes;

      // Add any discovered cert type names to the global set
      for (const ct of effectiveCertTypes) certTypeNames.add(ct);

      const worker: ParsedWorker = {
        employeeNumber: empNum,
        rawEmployeeNumber: empNumRaw,
        firstName: firstName || "לא ידוע",
        lastName: lastName || "לא ידוע",
        status,
        statusWarning,
        notes,
        responsible,
        sourceSheet: sheetName,
        certTypeName: effectiveCertTypes[0] ?? null,
        certDates,
      };

      parsedWorkers.push(worker);
      totalParsed++;

      if (uniqueWorkers.has(empNum)) {
        const existing = uniqueWorkers.get(empNum)!;
        for (const ct of effectiveCertTypes) {
          if (!existing.certTypeNames.includes(ct)) {
            existing.certTypeNames.push(ct);
          }
        }
        if (notes && !existing.notes.includes(notes)) {
          existing.notes = existing.notes ? `${existing.notes}\n${notes}` : notes;
        }
      } else {
        uniqueWorkers.set(empNum, {
          ...worker,
          certTypeNames: [...effectiveCertTypes],
        });
        if (effectiveCertTypes.length === 0) {
          noCertWorkers.push(worker);
        }
      }
    }

    sheets.push({
      name: sheetName,
      isWorkerSheet: true,
      certTypeName: sheetConfig.certTypes[0] ?? null,
      workers: parsedWorkers,
      skippedRows,
    });
  }

  // Recompute noCertWorkers from final state (a worker may have gained certs via merge)
  const finalNoCertWorkers = Array.from(uniqueWorkers.values()).filter(w => w.certTypeNames.length === 0);

  return {
    sheets,
    uniqueWorkers,
    certTypeNames: Array.from(certTypeNames),
    noCertWorkers: finalNoCertWorkers,
    totalParsed,
    totalSkipped,
  };
}
