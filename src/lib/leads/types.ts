// src/lib/leads/types.ts

/** A row as it appears in the source xlsx after header detection. */
export interface RawLeadRow {
  first_name: string;
  phone: string;
  city: string;
  id_number: string;
  source_row_number: number;
}

/** A row after normalization. Flags signal display-time warnings. */
export interface NormalizedLead {
  first_name: string;
  phone: string;          // formatted ("05X-XXX-XXXX") OR raw if unparseable
  city: string;
  id_number: string;
  source_row_number: number;
  flags: {
    empty_name: boolean;     // first_name was empty → 'ללא שם'
    invalid_phone: boolean;  // not a 10-digit Israeli mobile
    invalid_id: boolean;     // checksum failed or wrong length
  };
}

/** Counts returned by the sync action and rendered in the toast. */
export interface SyncSummary {
  inserted: number;
  updated: number;
  rejected: {
    missing_name: number;     // currently always 0 (we substitute 'ללא שם')
    invalid_id: number;       // currently always 0 (we still import, just flag)
    invalid_phone: number;    // currently always 0 (we still import, just flag)
  };
  total_rows: number;
}
