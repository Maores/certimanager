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
 * Match priority: id_number → phone, both as raw strings.
 *
 * The spec originally restricted ID matches to checksum-valid IDs. In practice,
 * roughly a third of the source rows have invalid checksums (typos, partial
 * digits, or non-numeric placeholders), and they re-appear verbatim across
 * syncs. Using the raw string as the dedup key keeps re-syncs idempotent for
 * those rows; the cost — that a manager fixing a typo in the source produces a
 * "new" lead instead of an update — is rare and recoverable manually.
 *
 * `invalid_id` / `invalid_phone` flags continue to drive the visual warnings
 * in the UI but no longer gate dedup.
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
    if (lead.id_number && byIdNumber.has(lead.id_number)) {
      match = byIdNumber.get(lead.id_number);
    } else if (lead.phone && byPhone.has(lead.phone)) {
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
