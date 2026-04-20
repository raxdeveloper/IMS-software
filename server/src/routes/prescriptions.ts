import type { Express } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  decodeOptical,
  decodePdMm,
  transpose,
  transpositionLabel,
  validatePrescriptionPayload,
  type PrescriptionPayload,
} from "../lib/optical.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const writeAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const adminAuth = [authenticate, requireRoles("admin")];

async function generateRxNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ymd = `${y}${m}${d}`;
  const prefix = `RX-${ymd}-`;
  const last = await tx.prescription.findFirst({
    where: { rxNumber: { startsWith: prefix } },
    orderBy: { rxNumber: "desc" },
    select: { rxNumber: true },
  });
  let next = 1;
  if (last?.rxNumber) {
    const suf = last.rxNumber.slice(-4);
    const n = parseInt(suf, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function normalizeAxis(cyl: number, axis: number | null | undefined): number | null {
  if (cyl === 0) return null;
  return axis ?? null;
}

function payloadToUnchecked(
  p: PrescriptionPayload,
  rxNumber: string,
  rxTime: string,
  patientId: number,
  createdById: string | null,
): Prisma.PrescriptionUncheckedCreateInput {
  return {
    rxNumber,
    patientId,
    doctorName: p.doctorName.trim(),
    rxDate: new Date(p.rxDate + "T12:00:00"),
    rxTime,
    chiefComplaint: p.chiefComplaint ?? null,
    vaReUnaided: p.vaReUnaided ?? null,
    vaLeUnaided: p.vaLeUnaided ?? null,
    vaReAided: p.vaReAided ?? null,
    vaLeAided: p.vaLeAided ?? null,
    dvReSph: p.dvReSph,
    dvReCyl: p.dvReCyl,
    dvReAxis: normalizeAxis(p.dvReCyl, p.dvReAxis),
    dvReAdd: p.dvReAdd,
    dvReVa: p.dvReVa ?? null,
    dvLeSph: p.dvLeSph,
    dvLeCyl: p.dvLeCyl,
    dvLeAxis: normalizeAxis(p.dvLeCyl, p.dvLeAxis),
    dvLeAdd: p.dvLeAdd,
    dvLeVa: p.dvLeVa ?? null,
    nvReSph: p.nvReSph,
    nvReCyl: p.nvReCyl,
    nvReAxis: normalizeAxis(p.nvReCyl, p.nvReAxis),
    nvReAdd: p.nvReAdd,
    nvReVa: p.nvReVa ?? null,
    nvLeSph: p.nvLeSph,
    nvLeCyl: p.nvLeCyl,
    nvLeAxis: normalizeAxis(p.nvLeCyl, p.nvLeAxis),
    nvLeAdd: p.nvLeAdd,
    nvLeVa: p.nvLeVa ?? null,
    pdType: p.pdType,
    pdBinocular: p.pdBinocular ?? null,
    pdRe: p.pdRe ?? null,
    pdLe: p.pdLe ?? null,
    prismRePower: p.prismRePower ?? null,
    prismReBase: p.prismReBase ?? null,
    prismLePower: p.prismLePower ?? null,
    prismLeBase: p.prismLeBase ?? null,
    lensType: p.lensType,
    frameType: p.frameType ?? null,
    tint: p.tint ?? null,
    coating: p.coating?.length ? (p.coating as Prisma.InputJsonValue) : Prisma.JsonNull,
    doctorNotes: p.doctorNotes ?? null,
    nextVisitDate: p.nextVisitDate ? new Date(p.nextVisitDate + "T12:00:00") : null,
    followupReason: p.followupReason ?? null,
    appointmentId: p.appointmentId ?? null,
    createdById,
  };
}

function serializeRx(r: {
  id: number;
  rxNumber: string;
  patientId: number;
  doctorName: string;
  rxDate: Date;
  rxTime: string;
  chiefComplaint: string | null;
  vaReUnaided: string | null;
  vaLeUnaided: string | null;
  vaReAided: string | null;
  vaLeAided: string | null;
  dvReSph: number;
  dvReCyl: number;
  dvReAxis: number | null;
  dvReAdd: number;
  dvReVa: string | null;
  dvLeSph: number;
  dvLeCyl: number;
  dvLeAxis: number | null;
  dvLeAdd: number;
  dvLeVa: string | null;
  nvReSph: number;
  nvReCyl: number;
  nvReAxis: number | null;
  nvReAdd: number;
  nvReVa: string | null;
  nvLeSph: number;
  nvLeCyl: number;
  nvLeAxis: number | null;
  nvLeAdd: number;
  nvLeVa: string | null;
  pdBinocular: number | null;
  pdRe: number | null;
  pdLe: number | null;
  pdType: string;
  prismRePower: number | null;
  prismReBase: string | null;
  prismLePower: number | null;
  prismLeBase: string | null;
  lensType: string;
  frameType: string | null;
  tint: string | null;
  coating: Prisma.JsonValue | null;
  doctorNotes: string | null;
  nextVisitDate: Date | null;
  followupReason: string | null;
  appointmentId: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  isDeleted: boolean;
}) {
  const coatingArr = Array.isArray(r.coating)
    ? (r.coating as unknown[]).map(String)
    : [];
  return {
    id: r.id,
    rxNumber: r.rxNumber,
    patientId: r.patientId,
    doctorName: r.doctorName,
    rxDate: r.rxDate.toISOString().slice(0, 10),
    rxTime: r.rxTime,
    chiefComplaint: r.chiefComplaint,
    vaReUnaided: r.vaReUnaided,
    vaLeUnaided: r.vaLeUnaided,
    vaReAided: r.vaReAided,
    vaLeAided: r.vaLeAided,
    dvReSph: r.dvReSph,
    dvReCyl: r.dvReCyl,
    dvReAxis: r.dvReAxis,
    dvReAdd: r.dvReAdd,
    dvReVa: r.dvReVa,
    dvLeSph: r.dvLeSph,
    dvLeCyl: r.dvLeCyl,
    dvLeAxis: r.dvLeAxis,
    dvLeAdd: r.dvLeAdd,
    dvLeVa: r.dvLeVa,
    nvReSph: r.nvReSph,
    nvReCyl: r.nvReCyl,
    nvReAxis: r.nvReAxis,
    nvReAdd: r.nvReAdd,
    nvReVa: r.nvReVa,
    nvLeSph: r.nvLeSph,
    nvLeCyl: r.nvLeCyl,
    nvLeAxis: r.nvLeAxis,
    nvLeAdd: r.nvLeAdd,
    nvLeVa: r.nvLeVa,
    pdBinocular: r.pdBinocular,
    pdRe: r.pdRe,
    pdLe: r.pdLe,
    pdType: r.pdType,
    prismRePower: r.prismRePower,
    prismReBase: r.prismReBase,
    prismLePower: r.prismLePower,
    prismLeBase: r.prismLeBase,
    lensType: r.lensType,
    frameType: r.frameType,
    tint: r.tint,
    coating: coatingArr,
    doctorNotes: r.doctorNotes,
    nextVisitDate: r.nextVisitDate ? r.nextVisitDate.toISOString().slice(0, 10) : null,
    followupReason: r.followupReason,
    appointmentId: r.appointmentId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdById: r.createdById,
    isDeleted: r.isDeleted,
    display: buildDisplay(r, coatingArr),
    transposed: buildTransposedPayload(r),
  };
}

function buildTransposedInts(sph: number, cyl: number, axis: number | null) {
  if (cyl === 0) return { sph, cyl: 0, axis: null as number | null };
  if (axis === null || axis === undefined) return null;
  return transpose(sph, cyl, axis);
}

function buildTransposedPayload(r: {
  dvReSph: number;
  dvReCyl: number;
  dvReAxis: number | null;
  dvLeSph: number;
  dvLeCyl: number;
  dvLeAxis: number | null;
  nvReSph: number;
  nvReCyl: number;
  nvReAxis: number | null;
  nvLeSph: number;
  nvLeCyl: number;
  nvLeAxis: number | null;
}) {
  return {
    dv: {
      re: buildTransposedInts(r.dvReSph, r.dvReCyl, r.dvReAxis),
      le: buildTransposedInts(r.dvLeSph, r.dvLeCyl, r.dvLeAxis),
    },
    nv: {
      re: buildTransposedInts(r.nvReSph, r.nvReCyl, r.nvReAxis),
      le: buildTransposedInts(r.nvLeSph, r.nvLeCyl, r.nvLeAxis),
    },
  };
}

function buildDisplay(
  r: {
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
    pdBinocular: number | null;
    pdRe: number | null;
    pdLe: number | null;
    pdType: string;
    prismRePower: number | null;
    prismLePower: number | null;
  },
  coatingArr: string[],
) {
  const power = (n: number) => decodeOptical(n);
  const prism = (n: number | null | undefined) => (n === null || n === undefined ? "—" : decodeOptical(n) + " Δ");
  return {
    dv: {
      re: {
        sph: power(r.dvReSph),
        cyl: power(r.dvReCyl),
        axis: r.dvReAxis === null || r.dvReAxis === undefined ? "—" : String(r.dvReAxis),
        add: power(r.dvReAdd),
      },
      le: {
        sph: power(r.dvLeSph),
        cyl: power(r.dvLeCyl),
        axis: r.dvLeAxis === null || r.dvLeAxis === undefined ? "—" : String(r.dvLeAxis),
        add: power(r.dvLeAdd),
      },
    },
    nv: {
      re: {
        sph: power(r.nvReSph),
        cyl: power(r.nvReCyl),
        axis: r.nvReAxis === null || r.nvReAxis === undefined ? "—" : String(r.nvReAxis),
        add: power(r.nvReAdd),
      },
      le: {
        sph: power(r.nvLeSph),
        cyl: power(r.nvLeCyl),
        axis: r.nvLeAxis === null || r.nvLeAxis === undefined ? "—" : String(r.nvLeAxis),
        add: power(r.nvLeAdd),
      },
    },
    pd:
      r.pdType === "binocular"
        ? `${decodePdMm(r.pdBinocular)} mm (Binocular)`
        : `RE: ${decodePdMm(r.pdRe)} mm | LE: ${decodePdMm(r.pdLe)} mm (Monocular)`,
    prism: {
      re: { power: prism(r.prismRePower) },
      le: { power: prism(r.prismLePower) },
    },
    coating: coatingArr.join(", "),
  };
}

function buildTransposedBlock(sph: number, cyl: number, axis: number | null) {
  if (cyl === 0) {
    return {
      label: transpositionLabel(0),
      sph: decodeOptical(sph),
      cyl: decodeOptical(0),
      axis: "—",
    };
  }
  if (axis === null || axis === undefined) {
    return {
      label: transpositionLabel(cyl),
      sph: "—",
      cyl: "—",
      axis: "—",
    };
  }
  const t = transpose(sph, cyl, axis);
  return {
    label: transpositionLabel(cyl),
    sph: decodeOptical(t.sph),
    cyl: decodeOptical(t.cyl),
    axis: t.axis === null ? "—" : String(t.axis),
  };
}

const router = Router();

router.get("/doctors", ...readAuth, async (_req, res) => {
  const doctors = await prisma.user.findMany({
    where: { isActive: true, role: "doctor" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.json({ doctors });
});

router.get("/patient/:patientId", ...readAuth, async (req, res) => {
  const patientId = parseInt(req.params.patientId, 10);
  if (Number.isNaN(patientId)) {
    res.status(400).json({ error: "Invalid patient id" });
    return;
  }
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit ?? "10"), 10) || 10));
  const where = { patientId, isDeleted: false };
  const total = await prisma.prescription.count({ where });
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const skip = (safePage - 1) * limit;
  const rows = await prisma.prescription.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });
  res.json({
    data: rows.map((r) => serializeRx(r)),
    total,
    page: safePage,
    pages,
    limit,
  });
});

router.get("/:id/transposed", ...readAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const r = await prisma.prescription.findFirst({ where: { id, isDeleted: false } });
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const rawT = (sph: number, cyl: number, axis: number | null) => {
    if (cyl === 0) return { sph, cyl: 0, axis: null as number | null };
    if (axis === null || axis === undefined) return null;
    return transpose(sph, cyl, axis);
  };
  res.json({
    dv: {
      re: buildTransposedBlock(r.dvReSph, r.dvReCyl, r.dvReAxis),
      le: buildTransposedBlock(r.dvLeSph, r.dvLeCyl, r.dvLeAxis),
    },
    nv: {
      re: buildTransposedBlock(r.nvReSph, r.nvReCyl, r.nvReAxis),
      le: buildTransposedBlock(r.nvLeSph, r.nvLeCyl, r.nvLeAxis),
    },
    raw: {
      dvRe: rawT(r.dvReSph, r.dvReCyl, r.dvReAxis),
      dvLe: rawT(r.dvLeSph, r.dvLeCyl, r.dvLeAxis),
      nvRe: rawT(r.nvReSph, r.nvReCyl, r.nvReAxis),
      nvLe: rawT(r.nvLeSph, r.nvLeCyl, r.nvLeAxis),
    },
  });
});

router.get("/:id", ...readAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const r = await prisma.prescription.findFirst({
    where: { id, isDeleted: false },
    include: {
      patient: {
        select: {
          id: true,
          patientCode: true,
          firstName: true,
          lastName: true,
          middleName: true,
          dob: true,
        },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const base = serializeRx(r);
  const patientName = [r.patient.firstName, r.patient.middleName, r.patient.lastName].filter(Boolean).join(" ");
  res.json({
    ...base,
    patient: {
      id: r.patient.id,
      patientCode: r.patient.patientCode,
      fullName: patientName,
      dob: r.patient.dob.toISOString().slice(0, 10),
    },
    createdByName: r.createdBy?.name ?? null,
  });
});

function parseBody(body: unknown): PrescriptionPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const num = (k: string, d = 0) => {
    const v = b[k];
    if (typeof v === "number" && !Number.isNaN(v)) return Math.trunc(v);
    if (typeof v === "string" && v.trim() !== "") return Math.trunc(parseFloat(v));
    return d;
  };
  const maybeNum = (k: string): number | null => {
    const v = b[k];
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Math.trunc(v);
    if (typeof v === "string") return Math.trunc(parseFloat(v));
    return null;
  };
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : b[k] == null ? "" : String(b[k]));
  const coatingRaw = b.coating;
  let coating: string[] | null = null;
  if (Array.isArray(coatingRaw)) coating = coatingRaw.map(String);
  else if (typeof coatingRaw === "string" && coatingRaw) coating = [coatingRaw];

  return {
    patientId: num("patientId", NaN),
    doctorName: str("doctorName"),
    rxDate: str("rxDate"),
    rxTime: str("rxTime") || undefined,
    chiefComplaint: str("chiefComplaint") || null,
    vaReUnaided: str("vaReUnaided") || null,
    vaLeUnaided: str("vaLeUnaided") || null,
    vaReAided: str("vaReAided") || null,
    vaLeAided: str("vaLeAided") || null,
    dvReSph: num("dvReSph"),
    dvReCyl: num("dvReCyl"),
    dvReAxis: maybeNum("dvReAxis"),
    dvReAdd: num("dvReAdd"),
    dvReVa: str("dvReVa") || null,
    dvLeSph: num("dvLeSph"),
    dvLeCyl: num("dvLeCyl"),
    dvLeAxis: maybeNum("dvLeAxis"),
    dvLeAdd: num("dvLeAdd"),
    dvLeVa: str("dvLeVa") || null,
    nvReSph: num("nvReSph"),
    nvReCyl: num("nvReCyl"),
    nvReAxis: maybeNum("nvReAxis"),
    nvReAdd: num("nvReAdd"),
    nvReVa: str("nvReVa") || null,
    nvLeSph: num("nvLeSph"),
    nvLeCyl: num("nvLeCyl"),
    nvLeAxis: maybeNum("nvLeAxis"),
    nvLeAdd: num("nvLeAdd"),
    nvLeVa: str("nvLeVa") || null,
    pdType: (str("pdType") || "binocular") === "monocular" ? "monocular" : "binocular",
    pdBinocular: maybeNum("pdBinocular"),
    pdRe: maybeNum("pdRe"),
    pdLe: maybeNum("pdLe"),
    prismRePower: maybeNum("prismRePower"),
    prismReBase: str("prismReBase") || null,
    prismLePower: maybeNum("prismLePower"),
    prismLeBase: str("prismLeBase") || null,
    lensType: str("lensType"),
    frameType: str("frameType") || null,
    tint: str("tint") || null,
    coating,
    doctorNotes: str("doctorNotes") || null,
    nextVisitDate: str("nextVisitDate") || null,
    followupReason: str("followupReason") || null,
    appointmentId: maybeNum("appointmentId"),
  };
}

router.post("/", ...writeAuth, async (req: AuthedRequest, res) => {
  const p = parseBody(req.body);
  if (!p || Number.isNaN(p.patientId)) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const patient = await prisma.patient.findFirst({ where: { id: p.patientId, isDeleted: false } });
  if (!patient) {
    res.status(400).json({ error: "Patient not found" });
    return;
  }
  if (p.appointmentId != null) {
    const ap = await prisma.appointment.findFirst({
      where: { id: p.appointmentId, patientId: p.patientId },
    });
    if (!ap) {
      res.status(400).json({ error: "Appointment not found for this patient" });
      return;
    }
  }
  const errs = validatePrescriptionPayload(p);
  if (errs.length) {
    res.status(400).json({ errors: errs });
    return;
  }
  const now = new Date();
  const rxTime =
    p.rxTime && p.rxTime.includes(":")
      ? p.rxTime
      : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const created = await prisma.$transaction(async (tx) => {
    const rxNumber = await generateRxNumber(tx);
    const data = payloadToUnchecked(p, rxNumber, rxTime, p.patientId, req.user!.sub);
    return tx.prescription.create({ data });
  });

  res.status(201).json(serializeRx(created));
});

function auditValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

const AUDIT_FIELDS: (keyof Prisma.PrescriptionUncheckedUpdateInput)[] = [
  "doctorName",
  "chiefComplaint",
  "vaReUnaided",
  "vaLeUnaided",
  "vaReAided",
  "vaLeAided",
  "dvReSph",
  "dvReCyl",
  "dvReAxis",
  "dvReAdd",
  "dvReVa",
  "dvLeSph",
  "dvLeCyl",
  "dvLeAxis",
  "dvLeAdd",
  "dvLeVa",
  "nvReSph",
  "nvReCyl",
  "nvReAxis",
  "nvReAdd",
  "nvReVa",
  "nvLeSph",
  "nvLeCyl",
  "nvLeAxis",
  "nvLeAdd",
  "nvLeVa",
  "pdType",
  "pdBinocular",
  "pdRe",
  "pdLe",
  "prismRePower",
  "prismReBase",
  "prismLePower",
  "prismLeBase",
  "lensType",
  "frameType",
  "tint",
  "coating",
  "doctorNotes",
  "nextVisitDate",
  "followupReason",
];

router.put("/:id", ...writeAuth, async (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await prisma.prescription.findFirst({ where: { id, isDeleted: false } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const p = parseBody(req.body);
  if (!p || p.patientId !== existing.patientId) {
    res.status(400).json({ error: "Invalid body or patient mismatch" });
    return;
  }
  const errs = validatePrescriptionPayload(p);
  if (errs.length) {
    res.status(400).json({ errors: errs });
    return;
  }
  const now = new Date();
  const rxTime =
    p.rxTime && p.rxTime.includes(":")
      ? p.rxTime
      : existing.rxTime ||
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;

  const data = payloadToUnchecked(
    p,
    existing.rxNumber,
    rxTime,
    existing.patientId,
    existing.createdById ?? req.user!.sub,
  );
  const updateData: Prisma.PrescriptionUncheckedUpdateInput = {
    doctorName: data.doctorName,
    rxDate: data.rxDate,
    rxTime: data.rxTime,
    chiefComplaint: data.chiefComplaint,
    vaReUnaided: data.vaReUnaided,
    vaLeUnaided: data.vaLeUnaided,
    vaReAided: data.vaReAided,
    vaLeAided: data.vaLeAided,
    dvReSph: data.dvReSph,
    dvReCyl: data.dvReCyl,
    dvReAxis: data.dvReAxis,
    dvReAdd: data.dvReAdd,
    dvReVa: data.dvReVa,
    dvLeSph: data.dvLeSph,
    dvLeCyl: data.dvLeCyl,
    dvLeAxis: data.dvLeAxis,
    dvLeAdd: data.dvLeAdd,
    dvLeVa: data.dvLeVa,
    nvReSph: data.nvReSph,
    nvReCyl: data.nvReCyl,
    nvReAxis: data.nvReAxis,
    nvReAdd: data.nvReAdd,
    nvReVa: data.nvReVa,
    nvLeSph: data.nvLeSph,
    nvLeCyl: data.nvLeCyl,
    nvLeAxis: data.nvLeAxis,
    nvLeAdd: data.nvLeAdd,
    nvLeVa: data.nvLeVa,
    pdType: data.pdType,
    pdBinocular: data.pdBinocular,
    pdRe: data.pdRe,
    pdLe: data.pdLe,
    prismRePower: data.prismRePower,
    prismReBase: data.prismReBase,
    prismLePower: data.prismLePower,
    prismLeBase: data.prismLeBase,
    lensType: data.lensType,
    frameType: data.frameType,
    tint: data.tint,
    coating: data.coating,
    doctorNotes: data.doctorNotes,
    nextVisitDate: data.nextVisitDate,
    followupReason: data.followupReason,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.prescription.update({ where: { id }, data: updateData });
    for (const key of AUDIT_FIELDS) {
      const k = key as string;
      const oldVal = (existing as unknown as Record<string, unknown>)[k];
      const newVal = (row as unknown as Record<string, unknown>)[k];
      if (auditValue(oldVal) !== auditValue(newVal)) {
        await tx.prescriptionAudit.create({
          data: {
            prescriptionId: id,
            changedById: req.user!.sub,
            fieldName: k,
            oldValue: auditValue(oldVal),
            newValue: auditValue(newVal),
          },
        });
      }
    }
    return row;
  });

  res.json(serializeRx(updated));
});

router.delete("/:id", ...adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await prisma.prescription.findFirst({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await prisma.prescription.update({ where: { id }, data: { isDeleted: true } });
  res.status(204).send();
});

export function mountPrescriptions(app: Express): void {
  app.use("/api/prescriptions", router);
}
