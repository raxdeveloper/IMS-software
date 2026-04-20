/** Integer × 100 for diopters; PD × 10 for mm. No float storage. */

export const OPTICAL_CONSTANTS = {
  SPH_MIN: -2000,
  SPH_MAX: 2000,
  CYL_MIN: -600,
  CYL_MAX: 600,
  ADD_MIN: 0,
  ADD_MAX: 400,
  AXIS_MIN: 1,
  AXIS_MAX: 180,
  PD_BINO_MIN: 500,
  PD_BINO_MAX: 800,
  PD_MONO_MIN: 250,
  PD_MONO_MAX: 450,
  STEP: 25,
} as const;

export function encodeOptical(displayValue: string | number): number {
  const num = typeof displayValue === "string" ? parseFloat(displayValue) : displayValue;
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function decodeOptical(storedInt: number | null | undefined): string {
  if (storedInt === null || storedInt === undefined) return "---";
  if (storedInt === 0) return "0.00";
  const sign = storedInt > 0 ? "+" : "";
  return sign + (storedInt / 100).toFixed(2);
}

export function decodeRxDisplay(storedInt: number | null | undefined): string {
  if (storedInt === null || storedInt === undefined) return "---";
  if (storedInt === 0) return "Plano";
  const sign = storedInt > 0 ? "+" : "";
  return sign + (storedInt / 100).toFixed(2);
}

export function decodeADD(storedInt: number | null | undefined): string {
  if (!storedInt || storedInt === 0) return "---";
  return "+" + (storedInt / 100).toFixed(2);
}

export function decodePD(storedInt: number | null | undefined): string {
  if (!storedInt) return "---";
  return (storedInt / 10).toFixed(1) + " mm";
}

/** NPR amounts stored as integer × 100 (same as paise). */
export function formatNPR(intValue: number): string {
  try {
    const amount = intValue / 100;
    const s =
      "रू " +
      amount.toLocaleString("ne-NP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    if (!s.includes("NaN")) return s;
  } catch {
    /* fall through */
  }
  const amount = (intValue / 100).toFixed(2);
  const [whole, dec] = amount.split(".");
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const formatted = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
    : lastThree;
  return "रू " + formatted + "." + dec;
}

export function transpose(
  sph_int: number,
  cyl_int: number,
  axis_int: number | null,
): { sph: number; cyl: number; axis: number | null } {
  if (cyl_int === 0) return { sph: sph_int, cyl: 0, axis: null };
  const new_sph = sph_int + cyl_int;
  const new_cyl = cyl_int * -1;
  if (axis_int === null || axis_int === undefined) {
    return { sph: new_sph, cyl: new_cyl, axis: null };
  }
  const new_axis = axis_int <= 90 ? axis_int + 90 : axis_int - 90;
  return { sph: new_sph, cyl: new_cyl, axis: new_axis };
}

export function transpositionLabel(cylInt: number): string {
  if (cylInt === 0) return "Spherical — no transposition needed";
  if (cylInt < 0) return "Plus Cylinder Form  (+CYL transposition)";
  return "Minus Cylinder Form  (−CYL transposition)";
}

export function encodePdMm(mm: number): number {
  return Math.round(mm * 10);
}

export function decodePdMm(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return (v / 10).toFixed(1);
}

/** Round typed value to nearest 0.25 D then encode. */
export function parseOpticalToInt(raw: string, min: number, max: number): number {
  const n = parseFloat(raw.replace(/[^\d.-]/g, ""));
  if (Number.isNaN(n)) return 0;
  const rounded = Math.round(n / 0.25) * 0.25;
  const v = Math.round(rounded * 100);
  return Math.min(max, Math.max(min, v));
}

export function formatPowerDisplay(
  val: number,
  zeroAs: "0.00" | "Plano" | "plano" | "—" = "0.00",
): string {
  if (val === 0) {
    if (zeroAs === "—") return "—";
    if (zeroAs === "Plano") return "Plano";
    if (zeroAs === "plano") return "plano";
    return "0.00";
  }
  return decodeOptical(val);
}

export function formatDiopter(val: number): string {
  if (val === 0) return "plano";
  return decodeOptical(val);
}

export function formatAddDiopter(val: number): string {
  if (val === 0) return "—";
  return decodeOptical(val);
}

export function formatAxisDisplay(cyl: number, axis: number | null | undefined): string {
  if (cyl === 0) return "—";
  if (axis === null || axis === undefined) return "—";
  return String(axis);
}
