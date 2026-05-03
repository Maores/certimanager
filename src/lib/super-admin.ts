/**
 * Email allowlist for surfaces that should only be visible to the app owner.
 * Currently gates the דוחות (reports) and דיווחים (feedback) tabs.
 *
 * To grant another user access, append their email here. Comparison is
 * case-insensitive and trims surrounding whitespace.
 */
export const SUPER_ADMIN_EMAILS: readonly string[] = [
  "admin@certimanager.co.il",
];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
