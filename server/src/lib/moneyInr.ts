/** INR amounts stored as integer paise (rupees × 100), same pattern as optical powers. */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupeesString(paise: number): string {
  return (paise / 100).toFixed(2);
}

export function parseRupeesInput(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/[₹,\s]/g, "");
  if (s === "") return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}
