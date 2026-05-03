// src/lib/leads/dedup.ts
import type { NormalizedLead } from "./types";

export interface ExistingCandidate {
  id: string;
  id_number: string;
  phone: string | null;
}

export interface DedupMatch {
  existing_id: string;
  lead: NormalizedLead;
}

export interface DedupResult {
  toInsert: NormalizedLead[];
  toUpdate: DedupMatch[];
}

/**
 * Match priority: valid id_number → phone (only if both sides are valid).
 * "Valid" for id_number means the lead's flags.invalid_id === false.
 * "Valid" for phone means the lead's flags.invalid_phone === false.
 */
export function dedupLeads(
  incoming: NormalizedLead[],
  existing: ExistingCandidate[]
): DedupResult {
  const byIdNumber = new Map<string, ExistingCandidate>();
  const byPhone = new Map<string, ExistingCandidate>();
  for (const e of existing) {
    if (e.id_number) byIdNumber.set(e.id_number, e);
    if (e.phone) byPhone.set(e.phone, e);
  }

  const toInsert: NormalizedLead[] = [];
  const toUpdate: DedupMatch[] = [];

  for (const lead of incoming) {
    let match: ExistingCandidate | undefined;
    if (!lead.flags.invalid_id && byIdNumber.has(lead.id_number)) {
      match = byIdNumber.get(lead.id_number);
    } else if (!lead.flags.invalid_phone && byPhone.has(lead.phone)) {
      match = byPhone.get(lead.phone);
    }
    if (match) {
      toUpdate.push({ existing_id: match.id, lead });
    } else {
      toInsert.push(lead);
    }
  }

  return { toInsert, toUpdate };
}
