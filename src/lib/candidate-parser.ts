import * as XLSX from "xlsx";
import { normalizeCertTypeName } from "./excel-parser";

export interface ParsedCandidate {
  first_name: string;
  last_name: string;
  id_number: string;
  phone: string | null;
  city: string | null;
  cert_type_name: string | null;
  status: string | null;
  row_number: number;
}

export interface CandidateParseResult {
  candidates: ParsedCandidate[];
  skipped: { row: number; reason: string }[];
  totalRows: number;
}

const COL_MAPS: Record<string, string[]> = {
  first_name: ["שם פרטי", "שם_פרטי", "first_name"],
  last_name: ["שם משפחה", "שם_משפחה", "last_name"],
  id_number: ["ת.ז", "ת.ז.", "תעודת זהות", "ת\"ז", "id_number", "id"],
  phone: ["טלפון", "מס' טלפון", "מס׳ טלפון", "phone"],
  city: ["עיר", "מקום מגורים", "city"],
  cert_type: ["סוג הסמכה", "הסמכה", "cert_type"],
  status: ["סטטוס", "status"],
};

function findColumn(headers: string[], field: string): number {
  const variants = COL_MAPS[field] || [];
  for (const v of variants) {
    const idx = headers.findIndex(h => h.trim().toLowerCase() === v.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseCandidateExcel(buffer: ArrayBuffer): CandidateParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (rows.length < 2) {
    return { candidates: [], skipped: [], totalRows: 0 };
  }

  const headers = rows[0].map(h => String(h).trim());
  const colIdx = {
    first_name: findColumn(headers, "first_name"),
    last_name: findColumn(headers, "last_name"),
    id_number: findColumn(headers, "id_number"),
    phone: findColumn(headers, "phone"),
    city: findColumn(headers, "city"),
    cert_type: findColumn(headers, "cert_type"),
    status: findColumn(headers, "status"),
  };

  if (colIdx.id_number === -1) {
    return {
      candidates: [],
      skipped: [{ row: 1, reason: "לא נמצאה עמודת ת.ז בכותרות" }],
      totalRows: rows.length - 1,
    };
  }

  const candidates: ParsedCandidate[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id_number = String(row[colIdx.id_number] || "").trim();

    if (!id_number) {
      skipped.push({ row: i + 1, reason: "ת.ז חסר" });
      continue;
    }

    const first_name = colIdx.first_name >= 0 ? String(row[colIdx.first_name] || "").trim() : "";
    const last_name = colIdx.last_name >= 0 ? String(row[colIdx.last_name] || "").trim() : "";

    if (!first_name && !last_name) {
      skipped.push({ row: i + 1, reason: "שם חסר" });
      continue;
    }

    const rawCertType = colIdx.cert_type >= 0 ? String(row[colIdx.cert_type] || "").trim() : null;
    let cert_type_name: string | null = null;
    if (rawCertType) {
      const normalized = normalizeCertTypeName(rawCertType);
      cert_type_name = normalized.length > 0 ? normalized[0] : rawCertType;
    }

    candidates.push({
      first_name: first_name || "",
      last_name: last_name || "",
      id_number,
      phone: colIdx.phone >= 0 ? String(row[colIdx.phone] || "").trim() || null : null,
      city: colIdx.city >= 0 ? String(row[colIdx.city] || "").trim() || null : null,
      cert_type_name,
      status: colIdx.status >= 0 ? String(row[colIdx.status] || "").trim() || null : null,
      row_number: i + 1,
    });
  }

  return { candidates, skipped, totalRows: rows.length - 1 };
}
