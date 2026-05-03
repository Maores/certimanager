// src/lib/leads/normalize.ts

export interface PhoneResult {
  value: string;
  valid: boolean;
}

/**
 * Normalize an Israeli mobile number to "05X-XXX-XXXX" form.
 * If the result is not a 10-digit mobile starting with "05",
 * return the raw input with valid=false so the UI can flag it.
 */
export function normalizePhone(raw: string): PhoneResult {
  const stripped = (raw || "").replace(/\D/g, "");
  let digits = stripped;
  if (digits.startsWith("972")) digits = digits.slice(3);
  if (digits && !digits.startsWith("0")) digits = "0" + digits;
  if (/^05\d{8}$/.test(digits)) {
    return {
      value: `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`,
      valid: true,
    };
  }
  return { value: raw, valid: false };
}

/**
 * Israeli teudat-zehut checksum:
 *   multiply digits by 1,2,1,2,...; for products >= 10 sum the digits;
 *   total must be divisible by 10.
 */
export function isValidIsraeliId(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(id[i]) * (i % 2 === 0 ? 1 : 2);
    if (d >= 10) d = Math.floor(d / 10) + (d % 10);
    sum += d;
  }
  return sum % 10 === 0;
}

export interface NameResult {
  value: string;
  empty: boolean;
}

/**
 * Trim, preserve the whole name string verbatim, and substitute
 * 'ללא שם' (with empty flag) for blank input.
 */
export function normalizeName(raw: string): NameResult {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { value: "ללא שם", empty: true };
  return { value: trimmed, empty: false };
}
