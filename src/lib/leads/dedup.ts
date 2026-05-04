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
 * A "strong" id is at least 5 digits and all-numeric — covers real Israeli
 * teudat-zehut (9 digits) plus partial/typo variants that still uniquely
 * identify a person across sync runs. Garbage like `"0"`, `"ירושלים"`, or
 * `"בהא"` is treated as weak — multiple distinct people in the source share
 * such values, so using them as dedup keys collapses different leads into
 * one row.
 */
function isStrongId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^\d{5,}$/.test(id);
}

/**
 * A "strong" phone is the canonical Israeli mobile format produced by
 * `normalizePhone`. Other shapes (landlines, foreign numbers, `#ERROR!`)
 * shouldn't anchor dedup — they may be shared or garbage.
 */
function isStrongPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return /^05\d-\d{3}-\d{4}$/.test(phone);
}

/**
 * Match priority: strong id_number → strong phone.
 *
 * 1-to-1 claim: each existing row can only be matched by one incoming lead.
 * Without the claim set, multiple incoming rows sharing a key would all
 * collapse onto the same DB row and the extras would be silently lost (the
 * actual bug that hit prod with id values like "0" and "ירושלים").
 *
 * Weak keys are skipped on both sides:
 *   - id "0", Hebrew strings, or anything < 5 digits ⇒ not used for matching
 *   - phones not in `05X-XXX-XXXX` shape ⇒ not used for matching
 *
 * Rows whose only identifiers are weak fall through to insert. They will
 * dedupe as new on every sync, which is the documented behavior for
 * unidentifiable leads.
 */
export function dedupLeads(
  incoming: NormalizedLead[],
  existing: ExistingCandidate[]
): DedupResult {
  // Each existing row indexed in BOTH maps (if both keys are strong) so an
  // incoming lead whose id doesn't match can still fall through to phone.
  const idMap = new Map<string, ExistingCandidate[]>();
  const phoneMap = new Map<string, ExistingCandidate[]>();
  for (const e of existing) {
    if (isStrongId(e.id_number)) {
      const arr = idMap.get(e.id_number) ?? [];
      arr.push(e);
      idMap.set(e.id_number, arr);
    }
    if (isStrongPhone(e.phone)) {
      const arr = phoneMap.get(e.phone as string) ?? [];
      arr.push(e);
      phoneMap.set(e.phone as string, arr);
    }
  }

  const claimed = new Set<string>();
  const toInsert: NormalizedLead[] = [];
  const toUpdate: DedupMatch[] = [];

  function pickUnclaimed(
    bucket: ExistingCandidate[] | undefined
  ): ExistingCandidate | undefined {
    if (!bucket) return undefined;
    return bucket.find((e) => !claimed.has(e.id));
  }

  for (const lead of incoming) {
    let match: ExistingCandidate | undefined;
    if (isStrongId(lead.id_number)) {
      match = pickUnclaimed(idMap.get(lead.id_number));
    }
    if (!match && isStrongPhone(lead.phone)) {
      match = pickUnclaimed(phoneMap.get(lead.phone));
    }
    if (match) {
      claimed.add(match.id);
      toUpdate.push({ existing_id: match.id, lead });
    } else {
      toInsert.push(lead);
    }
  }

  return { toInsert, toUpdate };
}
