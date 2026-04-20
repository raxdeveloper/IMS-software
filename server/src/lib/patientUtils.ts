/** Age in whole years — floor((today − dob) / 365.25 days). */
export function calculateAge(dob: Date): number {
  const today = new Date();
  const diffMs = today.getTime() - dob.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Nepal mobile (10 digits, 96/97/98) or legacy Indian normalization stripped to 10 digits. */
export function normalizeNepalPhone(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  if (d.length === 12 && d.startsWith("977")) return d.slice(3);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  return d;
}

/** @deprecated use normalizeNepalPhone */
export function normalizePhone10(raw: string): string {
  return normalizeNepalPhone(raw);
}

/** Escape special LIKE chars in SQLite. */
export function escapeLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function validateNepalPrimaryPhone(raw: string): string | null {
  const n = normalizeNepalPhone(raw);
  if (n.length === 10 && /^9[678]\d{8}$/.test(n)) return null;
  if (n.length >= 9 && n.length <= 11 && n.startsWith("0")) return null;
  return "Primary phone must be a valid Nepal mobile (10 digits: 96/97/98…) or landline";
}

export function validateNepalPhoneOptional(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const n = normalizeNepalPhone(String(raw));
  if (n.length === 10 && /^9[678]\d{8}$/.test(n)) return null;
  if (n.length >= 9 && n.startsWith("0")) return null;
  return "Secondary phone must be valid if provided";
}

export function validateNepalPostal(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  if (!/^\d{5}$/.test(String(raw).trim())) return "Postal code must be 5 digits";
  return null;
}
