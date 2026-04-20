/** Display ISO date (YYYY-MM-DD) as DD/MM/YYYY */
export function formatDateDMY(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const s = String(isoDate).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
