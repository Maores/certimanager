import * as XLSX from "xlsx";

// --- Types ---

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

const WORKER_SHEETS: Record<string, string | null> = {
  "מאושרי נת\"ע": "נת\"ע",
  "מאושרי כביש 6 + נת\"ע": "כביש 6 + נת\"ע",
  "מאושרי כביש 6": "כביש 6",
  "PFI": "PFI",
  "פעיל - ללא הסמכה מוגדרת": null,
  "חלת - מחלה": null,
  "ללא הסמכה - לבירור": null,
};

const SKIP_SHEETS = [
  "ריכוז כל המשימות",
  "משימות לפי אחראי",
  "סיכום כללי",
  "משימות להמשך טיפול",
];

const STATUS_MAP: Record<string, string> = {
  "פעיל": "פעיל",
  "חלת": 'חל"ת',
  'חל"ת': 'חל"ת',
  'חל״ת': 'חל"ת',
  "מחלה": "מחלה",
  "לא פעיל": "לא פעיל",
};

// --- Functions ---

export function normalizeEmployeeNumber(raw: string): string {
  return raw.toString().trim().replace(/[^a-zA-Z0-9]/g, "");
}

export function normalizeStatus(raw: string | undefined): { value: string; warning: boolean } {
  if (!raw || !raw.trim()) return { value: "פעיל", warning: false };
  const trimmed = raw.trim();
  const mapped = STATUS_MAP[trimmed];
  if (mapped) return { value: mapped, warning: false };
  return { value: "פעיל", warning: true };
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

    const certTypeName = WORKER_SHEETS[matchedKey];
    if (certTypeName) certTypeNames.add(certTypeName);

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "" });

    const parsedWorkers: ParsedWorker[] = [];
    const skippedRows: SkippedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const empNumRaw = String(
        row["מספר זהות"] || row["דרכון"] || row["מספר זהות / דרכון"] ||
        row["ת.ז"] || row["ת.ז."] || row["מס זהות"] || ""
      );
      const empNum = normalizeEmployeeNumber(empNumRaw);

      if (empNum.length < 5) {
        skippedRows.push({ row: rowNum, reason: `מספר זהות לא תקין: "${empNumRaw}"` });
        totalSkipped++;
        continue;
      }

      const firstName = String(row["שם פרטי"] || "").trim();
      const lastName = String(row["שם משפחה"] || "").trim();

      if (!firstName && !lastName) {
        skippedRows.push({ row: rowNum, reason: "חסר שם פרטי ושם משפחה" });
        totalSkipped++;
        continue;
      }

      const statusRaw = String(row["סטטוס"] || row["סטאטוס"] || "").trim();
      const { value: status, warning: statusWarning } = normalizeStatus(statusRaw);

      const notes = String(row["הערות"] || row["משימות"] || row["הערה"] || "").trim();
      const responsible = String(row["אחראי"] || "").trim();

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
        certTypeName,
      };

      parsedWorkers.push(worker);
      totalParsed++;

      if (uniqueWorkers.has(empNum)) {
        const existing = uniqueWorkers.get(empNum)!;
        if (certTypeName && !existing.certTypeNames.includes(certTypeName)) {
          existing.certTypeNames.push(certTypeName);
        }
        if (notes && !existing.notes.includes(notes)) {
          existing.notes = existing.notes ? `${existing.notes}\n${notes}` : notes;
        }
      } else {
        uniqueWorkers.set(empNum, {
          ...worker,
          certTypeNames: certTypeName ? [certTypeName] : [],
        });
        if (!certTypeName) {
          noCertWorkers.push(worker);
        }
      }
    }

    sheets.push({
      name: sheetName,
      isWorkerSheet: true,
      certTypeName,
      workers: parsedWorkers,
      skippedRows,
    });
  }

  return {
    sheets,
    uniqueWorkers,
    certTypeNames: Array.from(certTypeNames),
    noCertWorkers,
    totalParsed,
    totalSkipped,
  };
}
