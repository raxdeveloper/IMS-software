/** All diopter powers stored as integer × 100. Integer math only. */

export function encodeOptical(val: string | number): number {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function decodeOptical(val: number): string {
  if (val === 0) return "0.00";
  const sign = val > 0 ? "+" : "";
  return sign + (val / 100).toFixed(2);
}

export function decodeRxDisplay(val: number | null | undefined): string {
  if (val === null || val === undefined) return "---";
  if (val === 0) return "Plano";
  const sign = val > 0 ? "+" : "";
  return sign + (val / 100).toFixed(2);
}

/** PD stored as mm × 10 (63.5 → 635). */
export function encodePdMm(mm: number): number {
  return Math.round(mm * 10);
}

export function decodePdMm(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return (v / 10).toFixed(1);
}

export function transpose(
  sphInt: number,
  cylInt: number,
  axisInt: number | null,
): {
  sph: number;
  cyl: number;
  axis: number | null;
} {
  if (cylInt === 0) return { sph: sphInt, cyl: 0, axis: null };
  const newSph = sphInt + cylInt;
  const newCyl = cylInt * -1;
  if (axisInt === null || axisInt === undefined) {
    return { sph: newSph, cyl: newCyl, axis: null };
  }
  const newAxis = axisInt <= 90 ? axisInt + 90 : axisInt - 90;
  return { sph: newSph, cyl: newCyl, axis: newAxis };
}

export function transpositionLabel(cylInt: number): string {
  if (cylInt === 0) return "Spherical — no transposition needed";
  if (cylInt < 0) return "Plus Cylinder Form  (+CYL transposition)";
  return "Minus Cylinder Form  (−CYL transposition)";
}

export type RxRowInts = {
  sph: number;
  cyl: number;
  axis: number | null;
  add: number;
};

const AXIS_MIN = 1;
const AXIS_MAX = 180;

export function validateRxRow(row: RxRowInts, which: string): string[] {
  const errs: string[] = [];
  if (row.sph < -2000 || row.sph > 2000) errs.push(`${which}: SPH out of range (-20.00 to +20.00)`);
  if (row.cyl < -600 || row.cyl > 600) errs.push(`${which}: CYL out of range (-6.00 to +6.00)`);
  if (row.add < 0 || row.add > 400) errs.push(`${which}: ADD must be 0.00 to +4.00`);
  if (row.cyl !== 0) {
    if (row.axis === null || row.axis === undefined) errs.push(`${which}: AXIS required when CYL ≠ 0`);
    else if (row.axis < AXIS_MIN || row.axis > AXIS_MAX) errs.push(`${which}: AXIS must be ${AXIS_MIN}–${AXIS_MAX}`);
  }
  const sum = row.sph + row.cyl;
  if (sum < -2000 || sum > 2000) errs.push(`${which}: SPH + CYL (transposed sphere) out of range`);
  return errs;
}

export type PrescriptionPayload = {
  patientId: number;
  doctorName: string;
  rxDate: string;
  rxTime?: string;
  chiefComplaint?: string | null;
  vaReUnaided?: string | null;
  vaLeUnaided?: string | null;
  vaReAided?: string | null;
  vaLeAided?: string | null;
  dvReSph: number;
  dvReCyl: number;
  dvReAxis: number | null;
  dvReAdd: number;
  dvReVa?: string | null;
  dvLeSph: number;
  dvLeCyl: number;
  dvLeAxis: number | null;
  dvLeAdd: number;
  dvLeVa?: string | null;
  nvReSph: number;
  nvReCyl: number;
  nvReAxis: number | null;
  nvReAdd: number;
  nvReVa?: string | null;
  nvLeSph: number;
  nvLeCyl: number;
  nvLeAxis: number | null;
  nvLeAdd: number;
  nvLeVa?: string | null;
  pdType: "binocular" | "monocular";
  pdBinocular?: number | null;
  pdRe?: number | null;
  pdLe?: number | null;
  prismRePower?: number | null;
  prismReBase?: string | null;
  prismLePower?: number | null;
  prismLeBase?: string | null;
  lensType: string;
  frameType?: string | null;
  tint?: string | null;
  coating?: string[] | null;
  doctorNotes?: string | null;
  nextVisitDate?: string | null;
  followupReason?: string | null;
  appointmentId?: number | null;
};

function rowHasData(
  sph: number,
  cyl: number,
  add: number,
  va: string | null | undefined,
): boolean {
  if (sph !== 0 || cyl !== 0 || add !== 0) return true;
  return !!String(va ?? "").trim();
}

const LENS_NEED_PD = new Set(["Single Vision", "Bifocal", "Progressive"]);

export function validatePrescriptionPayload(p: PrescriptionPayload): string[] {
  const errs: string[] = [];
  if (!p.doctorName?.trim()) errs.push("Doctor name is required");
  if (!p.lensType?.trim()) errs.push("Lens type is required");

  const hasDv =
    rowHasData(p.dvReSph, p.dvReCyl, p.dvReAdd, p.dvReVa) ||
    rowHasData(p.dvLeSph, p.dvLeCyl, p.dvLeAdd, p.dvLeVa);
  const hasNv =
    rowHasData(p.nvReSph, p.nvReCyl, p.nvReAdd, p.nvReVa) ||
    rowHasData(p.nvLeSph, p.nvLeCyl, p.nvLeAdd, p.nvLeVa);

  if (!hasDv && !hasNv) errs.push("At least one eye must have data in Distance or Near vision");

  errs.push(
    ...validateRxRow(
      { sph: p.dvReSph, cyl: p.dvReCyl, axis: p.dvReAxis, add: p.dvReAdd },
      "DV RE",
    ),
  );
  errs.push(
    ...validateRxRow(
      { sph: p.dvLeSph, cyl: p.dvLeCyl, axis: p.dvLeAxis, add: p.dvLeAdd },
      "DV LE",
    ),
  );
  errs.push(
    ...validateRxRow(
      { sph: p.nvReSph, cyl: p.nvReCyl, axis: p.nvReAxis, add: p.nvReAdd },
      "NV RE",
    ),
  );
  errs.push(
    ...validateRxRow(
      { sph: p.nvLeSph, cyl: p.nvLeCyl, axis: p.nvLeAxis, add: p.nvLeAdd },
      "NV LE",
    ),
  );

  if (LENS_NEED_PD.has(p.lensType)) {
    if (p.pdType === "binocular") {
      if (p.pdBinocular === null || p.pdBinocular === undefined) errs.push("PD required for this lens type");
      else {
        const mm = p.pdBinocular / 10;
        if (mm < 50 || mm > 80) errs.push("Binocular PD must be 50.0–80.0 mm");
      }
    } else {
      if (p.pdRe === null || p.pdRe === undefined || p.pdLe === null || p.pdLe === undefined) {
        errs.push("Monocular PD required for both eyes for this lens type");
      } else {
        const r = p.pdRe / 10;
        const l = p.pdLe / 10;
        if (r < 25 || r > 45) errs.push("RE PD must be 25.0–45.0 mm");
        if (l < 25 || l > 45) errs.push("LE PD must be 25.0–45.0 mm");
      }
    }
  } else if (p.pdBinocular !== null && p.pdBinocular !== undefined && p.pdType === "binocular") {
    const mm = p.pdBinocular / 10;
    if (mm < 50 || mm > 80) errs.push("Binocular PD must be 50.0–80.0 mm");
  }

  return errs;
}
