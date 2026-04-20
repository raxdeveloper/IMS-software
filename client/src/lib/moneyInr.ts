/** Money stored as integer × 100 (NPR paisa). Never use ₹ or INR. */
import { formatNPR } from "../utils/optical";

/** Full display: रू 1,250.00 */
export function formatInrPaiseDisplay(paise: number): string {
  return formatNPR(paise);
}

/** Amount only (no currency prefix) for dense tables — still Nepali grouping */
export function formatInrPaise(paise: number): string {
  const full = formatNPR(paise);
  return full.replace(/^रू\s*/, "").trim();
}

export function parseRupeesToPaise(raw: string): number | null {
  const s = raw.trim().replace(/[रूRs.,\s]/gi, "");
  if (s === "") return null;
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}
