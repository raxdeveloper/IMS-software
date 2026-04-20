export function calculateAge(dobStr: string): number {
  const dob = new Date(dobStr + "T12:00:00");
  const diffMs = Date.now() - dob.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

export function initials(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  return (a + b) || "?";
}
