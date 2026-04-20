import { describe, expect, it } from "vitest";
import {
  encodeOptical,
  decodeOptical,
  transpose,
  formatNPR,
} from "./optical";
import { validatePrescription } from "./validation";

describe("encodeOptical", () => {
  it("encodes samples", () => {
    expect(encodeOptical("-2.25")).toBe(-225);
    expect(encodeOptical("+1.50")).toBe(150);
    expect(encodeOptical("0.00")).toBe(0);
    expect(encodeOptical("-20.00")).toBe(-2000);
    expect(encodeOptical("+20.00")).toBe(2000);
    expect(encodeOptical("-0.25")).toBe(-25);
  });
});

describe("decodeOptical", () => {
  it("decodes samples", () => {
    expect(decodeOptical(-225)).toBe("-2.25");
    expect(decodeOptical(150)).toBe("+1.50");
    expect(decodeOptical(0)).toBe("0.00");
    expect(decodeOptical(-2000)).toBe("-20.00");
    expect(decodeOptical(2000)).toBe("+20.00");
  });
});

describe("transpose", () => {
  it("example 1: -2.25 / -0.50 × 90 → -2.75 / +0.50 × 180", () => {
    const t = transpose(-225, -50, 90);
    expect(t).toEqual({ sph: -275, cyl: 50, axis: 180 });
  });

  it("example 2: inverse transpose recovers", () => {
    const t = transpose(-275, 50, 180);
    expect(t).toEqual({ sph: -225, cyl: -50, axis: 90 });
  });

  it("example 3: plano + cyl", () => {
    const t = transpose(0, -150, 45);
    expect(t).toEqual({ sph: -150, cyl: 150, axis: 135 });
  });

  it("example 4: high myopia", () => {
    const t = transpose(-800, -250, 120);
    expect(t).toEqual({ sph: -1050, cyl: 250, axis: 30 });
  });

  it("spherical no cyl", () => {
    expect(transpose(-300, 0, null)).toEqual({ sph: -300, cyl: 0, axis: null });
  });

  it("double transposition recovers original", () => {
    const a = transpose(-225, -50, 90);
    const b = transpose(a.sph, a.cyl, a.axis!);
    expect(b).toEqual({ sph: -225, cyl: -50, axis: 90 });
  });
});

describe("formatNPR", () => {
  it("formats amounts with रू prefix (locale may use Devanagari numerals)", () => {
    expect(formatNPR(125000).startsWith("रू")).toBe(true);
    expect(formatNPR(0).length).toBeGreaterThan(3);
  });
});

describe("validatePrescription", () => {
  const base = {
    doctorName: "Dr. X",
    lensType: "Single Vision",
    pdType: "binocular" as const,
    pdBinocular: 640,
    pdRe: null,
    pdLe: null,
    dvReVa: "",
    dvLeVa: "",
    nvReVa: "",
    nvLeVa: "",
  };

  it("rejects all blank", () => {
    const r = validatePrescription({
      ...base,
      dvReSph: 0,
      dvReCyl: 0,
      dvReAxis: null,
      dvReAdd: 0,
      dvLeSph: 0,
      dvLeCyl: 0,
      dvLeAxis: null,
      dvLeAdd: 0,
      nvReSph: 0,
      nvReCyl: 0,
      nvReAxis: null,
      nvReAdd: 0,
      nvLeSph: 0,
      nvLeCyl: 0,
      nvLeAxis: null,
      nvLeAdd: 0,
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("At least one eye"))).toBe(true);
  });

  it("errors when CYL without axis", () => {
    const r = validatePrescription({
      ...base,
      dvReSph: 0,
      dvReCyl: -50,
      dvReAxis: null,
      dvReAdd: 0,
      dvLeSph: 0,
      dvLeCyl: 0,
      dvLeAxis: null,
      dvLeAdd: 0,
      nvReSph: 0,
      nvReCyl: 0,
      nvReAxis: null,
      nvReAdd: 0,
      nvLeSph: 0,
      nvLeCyl: 0,
      nvLeAxis: null,
      nvLeAdd: 0,
    });
    expect(r.errors.some((e) => e.includes("AXIS required"))).toBe(true);
  });

  it("errors when sph+cyl out of range", () => {
    const r = validatePrescription({
      ...base,
      dvReSph: -1800,
      dvReCyl: -250,
      dvReAxis: 90,
      dvReAdd: 0,
      dvLeSph: 0,
      dvLeCyl: 0,
      dvLeAxis: null,
      dvLeAdd: 0,
      nvReSph: 0,
      nvReCyl: 0,
      nvReAxis: null,
      nvReAdd: 0,
      nvLeSph: 0,
      nvLeCyl: 0,
      nvLeAxis: null,
      nvLeAdd: 0,
    });
    expect(r.errors.some((e) => e.includes("SPH + CYL"))).toBe(true);
  });

  it("warns high myopia", () => {
    const r = validatePrescription({
      ...base,
      dvReSph: -800,
      dvReCyl: 0,
      dvReAxis: null,
      dvReAdd: 0,
      dvLeSph: 0,
      dvLeCyl: 0,
      dvLeAxis: null,
      dvLeAdd: 0,
      nvReSph: 0,
      nvReCyl: 0,
      nvReAxis: null,
      nvReAdd: 0,
      nvLeSph: 0,
      nvLeCyl: 0,
      nvLeAxis: null,
      nvLeAdd: 0,
    });
    expect(r.warnings.some((w) => w.toLowerCase().includes("myopia"))).toBe(true);
  });
});
