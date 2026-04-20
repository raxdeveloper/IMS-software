import { OPTICAL_CONSTANTS } from "./optical";

export type PrescriptionFormInts = {
  doctorName: string;
  lensType: string;
  dvReSph: number;
  dvReCyl: number;
  dvReAxis: number | null;
  dvReAdd: number;
  dvLeSph: number;
  dvLeCyl: number;
  dvLeAxis: number | null;
  dvLeAdd: number;
  nvReSph: number;
  nvReCyl: number;
  nvReAxis: number | null;
  nvReAdd: number;
  nvLeSph: number;
  nvLeCyl: number;
  nvLeAxis: number | null;
  nvLeAdd: number;
  pdType: "binocular" | "monocular";
  pdBinocular: number | null;
  pdRe: number | null;
  pdLe: number | null;
};

function rowBlank(sph: number, cyl: number, add: number, va: string): boolean {
  return sph === 0 && cyl === 0 && add === 0 && !va?.trim();
}

function rowHasData(
  sph: number,
  cyl: number,
  add: number,
  _axis: number | null,
  va: string,
): boolean {
  if (sph !== 0 || cyl !== 0 || add !== 0) return true;
  return !!va?.trim();
}

function validateEyeRow(
  which: string,
  sph: number,
  cyl: number,
  axis: number | null,
  add: number,
  errors: string[],
): void {
  const { SPH_MIN, SPH_MAX, CYL_MIN, CYL_MAX, ADD_MIN, ADD_MAX } = OPTICAL_CONSTANTS;
  if (sph < SPH_MIN || sph > SPH_MAX) errors.push(`${which}: SPH out of allowed range`);
  if (cyl < CYL_MIN || cyl > CYL_MAX) errors.push(`${which}: CYL out of allowed range`);
  if (add < ADD_MIN || add > ADD_MAX) errors.push(`${which}: ADD must be 0.00 to +4.00`);
  if (cyl !== 0) {
    if (axis === null || axis === undefined) errors.push(`${which}: AXIS required when CYL is not zero`);
    else if (axis < OPTICAL_CONSTANTS.AXIS_MIN || axis > OPTICAL_CONSTANTS.AXIS_MAX)
      errors.push(`${which}: AXIS must be ${OPTICAL_CONSTANTS.AXIS_MIN}–${OPTICAL_CONSTANTS.AXIS_MAX}`);
  }
  const sum = sph + cyl;
  if (sum < SPH_MIN || sum > SPH_MAX) errors.push(`${which}: SPH + CYL (transposed sphere) out of range`);
}

const LENS_NEED_PD = new Set(["Single Vision", "Bifocal", "Progressive"]);
const LENS_NEED_ADD_NV = new Set(["Bifocal", "Progressive"]);

export function validatePrescription(
  p: PrescriptionFormInts & {
    dvReVa?: string;
    dvLeVa?: string;
    nvReVa?: string;
    nvLeVa?: string;
  },
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!p.doctorName?.trim()) errors.push("Doctor name is required");
  if (!p.lensType?.trim()) errors.push("Lens type recommendation is required");

  const dvReVa = p.dvReVa ?? "";
  const dvLeVa = p.dvLeVa ?? "";
  const nvReVa = p.nvReVa ?? "";
  const nvLeVa = p.nvLeVa ?? "";

  const dvReBlank = rowBlank(p.dvReSph, p.dvReCyl, p.dvReAdd, dvReVa);
  const dvLeBlank = rowBlank(p.dvLeSph, p.dvLeCyl, p.dvLeAdd, dvLeVa);
  const nvReBlank = rowBlank(p.nvReSph, p.nvReCyl, p.nvReAdd, nvReVa);
  const nvLeBlank = rowBlank(p.nvLeSph, p.nvLeCyl, p.nvLeAdd, nvLeVa);

  const hasDv =
    rowHasData(p.dvReSph, p.dvReCyl, p.dvReAdd, p.dvReAxis, dvReVa) ||
    rowHasData(p.dvLeSph, p.dvLeCyl, p.dvLeAdd, p.dvLeAxis, dvLeVa);
  const hasNv =
    rowHasData(p.nvReSph, p.nvReCyl, p.nvReAdd, p.nvReAxis, nvReVa) ||
    rowHasData(p.nvLeSph, p.nvLeCyl, p.nvLeAdd, p.nvLeAxis, nvLeVa);

  if (!hasDv && !hasNv) errors.push("At least one eye must have data in Distance or Near vision");

  validateEyeRow("DV RE", p.dvReSph, p.dvReCyl, p.dvReAxis, p.dvReAdd, errors);
  validateEyeRow("DV LE", p.dvLeSph, p.dvLeCyl, p.dvLeAxis, p.dvLeAdd, errors);
  validateEyeRow("NV RE", p.nvReSph, p.nvReCyl, p.nvReAxis, p.nvReAdd, errors);
  validateEyeRow("NV LE", p.nvLeSph, p.nvLeCyl, p.nvLeAxis, p.nvLeAdd, errors);

  if (LENS_NEED_PD.has(p.lensType)) {
    if (p.pdType === "binocular") {
      if (p.pdBinocular == null) errors.push("PD required for this lens type");
      else {
        const mm = p.pdBinocular / 10;
        if (mm < 50 || mm > 80) errors.push("Binocular PD must be 50.0–80.0 mm");
      }
    } else {
      if (p.pdRe == null || p.pdLe == null) errors.push("Monocular PD required for both eyes");
      else {
        const r = p.pdRe / 10;
        const l = p.pdLe / 10;
        if (r < 25 || r > 45) errors.push("RE PD must be 25.0–45.0 mm");
        if (l < 25 || l > 45) errors.push("LE PD must be 25.0–45.0 mm");
      }
    }
  }

  if (LENS_NEED_ADD_NV.has(p.lensType)) {
    if (p.nvReAdd === 0 && !nvReBlank) warnings.push("NV ADD often required for bifocal/progressive — confirm");
    if (p.nvLeAdd === 0 && !nvLeBlank) warnings.push("Check NV ADD for both eyes");
  }

  const warnAxis0 = (label: string, cyl: number, axis: number | null) => {
    if (cyl !== 0 && axis === 0) warnings.push(`${label}: AXIS 0 is unusual — did you mean 180?`);
  };
  warnAxis0("DV RE", p.dvReCyl, p.dvReAxis);
  warnAxis0("DV LE", p.dvLeCyl, p.dvLeAxis);
  warnAxis0("NV RE", p.nvReCyl, p.nvReAxis);
  warnAxis0("NV LE", p.nvLeCyl, p.nvLeAxis);

  const hiMyopia = (sph: number) => sph <= -800;
  const hiHyper = (sph: number) => sph >= 500;
  const hiCyl = (cyl: number) => Math.abs(cyl) >= 300;
  if (hiMyopia(p.dvReSph) || hiMyopia(p.dvLeSph)) warnings.push("High myopia — confirm value");
  if (hiHyper(p.dvReSph) || hiHyper(p.dvLeSph)) warnings.push("High hyperopia — confirm value");
  if (hiCyl(p.dvReCyl) || hiCyl(p.dvLeCyl) || hiCyl(p.nvReCyl) || hiCyl(p.nvLeCyl))
    warnings.push("High astigmatism — confirm value");
  if (p.nvReAdd > 350 || p.nvLeAdd > 350) warnings.push("High ADD value — confirm");

  if (!dvReBlank && !dvLeBlank && Math.abs(p.dvReSph - p.dvLeSph) >= 250) {
    warnings.push("Anisometropia detected — confirm");
  }

  return { valid: errors.length === 0, errors, warnings };
}
