// src/lib/leads/parse.ts
import * as XLSX from "xlsx";
import type { RawLeadRow } from "./types";

const HEADER_VARIANTS = {
  first_name: ["first name", "first_name", "שם", "שם פרטי"],
  phone: ["phone", "טלפון", "מס' טלפון", "מס׳ טלפון"],
  city: ["עיר", "city", "מקום מגורים"],
  id_number: ["מס׳ תעודת זהות", "מס' תעודת זהות", "תעודת זהות", "ת.ז", "id", "id_number"],
};

function findColumn(headers: string[], variants: string[]): number {
  for (const v of variants) {
    const idx = headers.findIndex(
      (h) => h.trim().toLowerCase() === v.toLowerCase()
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

export interface ParseResult {
  rows: RawLeadRow[];
}

/** Parse the leads xlsx (raw column order: first_name, phone, city, id_number). */
export function parseLeadsXlsx(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  if (wb.SheetNames.length === 0) return { rows: [] };
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });
  if (matrix.length === 0) return { rows: [] };

  const headers = matrix[0].map((h) => String(h).trim());
  const cols = {
    first_name: findColumn(headers, HEADER_VARIANTS.first_name),
    phone: findColumn(headers, HEADER_VARIANTS.phone),
    city: findColumn(headers, HEADER_VARIANTS.city),
    id_number: findColumn(headers, HEADER_VARIANTS.id_number),
  };

  const rows: RawLeadRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    const first_name =
      cols.first_name >= 0 ? String(row[cols.first_name] ?? "").trim() : "";
    const phone =
      cols.phone >= 0 ? String(row[cols.phone] ?? "").trim() : "";
    const city = cols.city >= 0 ? String(row[cols.city] ?? "").trim() : "";
    const id_number =
      cols.id_number >= 0 ? String(row[cols.id_number] ?? "").trim() : "";

    // Skip entirely-empty rows
    if (!first_name && !phone && !city && !id_number) continue;

    rows.push({
      first_name,
      phone,
      city,
      id_number,
      source_row_number: i + 1,
    });
  }
  return { rows };
}
