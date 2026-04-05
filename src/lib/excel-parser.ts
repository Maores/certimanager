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
  "מאושרי נת״ע": "נת״ע",
  "מאושרי כביש 6 + נת״ע": "כביש 6 + נת״ע",
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
  if (!raw || !raw.trim() || raw.trim() === "-") return { value: "פעיל", warning: false };
  const trimmed = raw.trim();
  const mapped = STATUS_MAP[trimmed];
  if (mapped) return { value: mapped, warning: false };
  return { value: "פעיל", warning: true };
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

    const certTypeName = WORKER_SHEETS[matchedKey];
    if (certTypeName) certTypeNames.add(certTypeName);

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

    const empNumCol = colIdx(["מספר זהות", "דרכון", "ת.ז"]);
    const lastNameCol = colIdx(["שם משפחה"]);
    const firstNameCol = colIdx(["שם פרטי"]);
    const statusCol = colIdx(["סטטוס", "סטאטוס"]);
    const notesCol = colIdx(["הערות", "משימות", "הערה"]);
    const responsibleCol = colIdx(["אחראי"]);

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
      const { value: status, warning: statusWarning } = normalizeStatus(statusRaw);

      const notesRaw = notesCol >= 0 ? String(row[notesCol] || "").trim() : "";
      const notes = notesRaw === "-" ? "" : notesRaw;
      const responsibleRaw = responsibleCol >= 0 ? String(row[responsibleCol] || "").trim() : "";
      const responsible = responsibleRaw === "-" ? "" : responsibleRaw;

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
