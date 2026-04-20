import type { Express } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { APPOINTMENT_TYPES } from "../lib/appointmentConstants.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const writeAuth = [authenticate, requireRoles("admin", "doctor", "staff")];

const typeEnum = z.enum(APPOINTMENT_TYPES);

const createSchema = z.object({
  patientId: z.number().int().positive(),
  doctorUserId: z.string().uuid().optional().nullable(),
  doctorDisplayName: z.string().min(1).max(200),
  startsAt: z.string().min(1),
  appointmentType: typeEnum,
  chiefComplaint: z.string().max(2000).optional().nullable(),
  staffNotes: z.string().max(5000).optional().nullable(),
});

const patchSchema = z.object({
  doctorUserId: z.string().uuid().optional().nullable(),
  doctorDisplayName: z.string().min(1).max(200).optional(),
  startsAt: z.string().optional(),
  appointmentType: typeEnum.optional(),
  chiefComplaint: z.string().max(2000).optional().nullable(),
  staffNotes: z.string().max(5000).optional().nullable(),
});

const statusSchema = z.object({
  status: z.enum(["booked", "checked_in", "consultation_done", "completed", "no_show", "cancelled"]),
});

function patientFullName(p: { firstName: string; middleName: string | null; lastName: string }): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

function serializeAppointment(a: {
  id: number;
  patientId: number;
  doctorUserId: string | null;
  doctorDisplayName: string;
  startsAt: Date;
  appointmentType: string;
  chiefComplaint: string | null;
  staffNotes: string | null;
  status: string;
  createdAt: Date;
  patient: { firstName: string; middleName: string | null; lastName: string; phone1: string };
  doctorUser: { name: string } | null;
}) {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: patientFullName(a.patient),
    patientPhone: a.patient.phone1,
    doctorUserId: a.doctorUserId,
    doctorDisplayName: a.doctorDisplayName,
    doctorUserName: a.doctorUser?.name ?? null,
    startsAt: a.startsAt.toISOString(),
    appointmentType: a.appointmentType,
    chiefComplaint: a.chiefComplaint,
    staffNotes: a.staffNotes,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}

async function findConflict(
  tx: Prisma.TransactionClient | typeof prisma,
  params: {
    excludeId?: number;
    startsAt: Date;
    doctorUserId: string | null;
    doctorDisplayName: string;
  },
): Promise<boolean> {
  const name = params.doctorDisplayName.trim();
  const where: Prisma.AppointmentWhereInput = {
    id: params.excludeId ? { not: params.excludeId } : undefined,
    startsAt: params.startsAt,
    status: { not: "cancelled" },
  };
  if (params.doctorUserId) {
    where.doctorUserId = params.doctorUserId;
  } else {
    where.doctorUserId = null;
    where.doctorDisplayName = name;
  }
  const n = await tx.appointment.count({ where });
  return n > 0;
}

export function mountAppointments(app: Express): void {
  const router = Router();

  router.get("/doctors", ...readAuth, async (_req, res) => {
    const rows = await prisma.user.findMany({
      where: { role: "doctor", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    res.json({ doctors: rows });
  });

  router.get("/counts-by-day", ...readAuth, async (req, res) => {
    const y = parseInt(String(req.query.year ?? ""), 10);
    const m = parseInt(String(req.query.month ?? ""), 10);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
      res.status(400).json({ error: "year and month (1-12) required" });
      return;
    }
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59, 999);
    const doctorUserId = typeof req.query.doctorUserId === "string" && req.query.doctorUserId ? req.query.doctorUserId : undefined;

    const rows = await prisma.appointment.findMany({
      where: {
        startsAt: { gte: from, lte: to },
        ...(doctorUserId ? { doctorUserId } : {}),
      },
      select: { startsAt: true },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const d = r.startsAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    res.json({ counts });
  });

  router.get("/", ...readAuth, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const doctorUserId = typeof req.query.doctorUserId === "string" ? req.query.doctorUserId.trim() : "";
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : "";
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : "";
    const todayOnly = req.query.today === "true";

    const where: Prisma.AppointmentWhereInput = {};
    if (status && status !== "all") where.status = status;
    if (type && type !== "all") where.appointmentType = type;
    if (doctorUserId) where.doctorUserId = doctorUserId;

    if (todayOnly) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      where.startsAt = { gte: start, lte: end };
    } else {
      const sf = dateFrom ? new Date(dateFrom) : null;
      const st = dateTo ? new Date(dateTo) : null;
      if (st) st.setHours(23, 59, 59, 999);
      if (sf || st) {
        where.startsAt = {};
        if (sf) (where.startsAt as { gte?: Date }).gte = sf;
        if (st) (where.startsAt as { lte?: Date }).lte = st;
      }
    }

    if (q) {
      const digits = q.replace(/\D/g, "");
      where.OR = [
        { patient: { firstName: { contains: q } } },
        { patient: { lastName: { contains: q } } },
        { doctorDisplayName: { contains: q } },
        ...(digits.length >= 3 ? [{ patient: { phone1: { contains: digits } } }] : []),
      ];
    }

    const total = await prisma.appointment.count({ where });
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const skip = (safePage - 1) * limit;

    const rows = await prisma.appointment.findMany({
      where,
      orderBy: { startsAt: "asc" },
      skip,
      take: limit,
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
        doctorUser: { select: { name: true } },
      },
    });

    res.json({
      data: rows.map(serializeAppointment),
      total,
      page: safePage,
      pages,
      limit,
    });
  });

  router.get("/range", ...readAuth, async (req, res) => {
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : null;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : null;
    if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
      res.status(400).json({ error: "from and to ISO dates required" });
      return;
    }
    to.setHours(23, 59, 59, 999);
    const doctorUserId = typeof req.query.doctorUserId === "string" && req.query.doctorUserId ? req.query.doctorUserId : undefined;

    const rows = await prisma.appointment.findMany({
      where: {
        startsAt: { gte: from, lte: to },
        ...(doctorUserId ? { doctorUserId } : {}),
      },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
        doctorUser: { select: { name: true } },
      },
    });
    res.json({ data: rows.map(serializeAppointment) });
  });

  router.get("/queue/today", ...readAuth, async (_req, res) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const rows = await prisma.appointment.findMany({
      where: { startsAt: { gte: start, lte: end } },
      orderBy: { startsAt: "asc" },
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
        doctorUser: { select: { name: true } },
      },
    });
    res.json({ data: rows.map(serializeAppointment) });
  });

  router.get("/:id", ...readAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const a = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
        doctorUser: { select: { name: true } },
      },
    });
    if (!a) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeAppointment(a));
  });

  router.post("/", ...writeAuth, async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      res.status(400).json({ error: "Invalid startsAt" });
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startsAt < today) {
      res.status(400).json({ error: "Cannot book in the past" });
      return;
    }

    const patient = await prisma.patient.findFirst({ where: { id: body.patientId, isDeleted: false } });
    if (!patient) {
      res.status(400).json({ error: "Patient not found" });
      return;
    }

    let doctorUserId: string | null = body.doctorUserId ?? null;
    if (doctorUserId) {
      const u = await prisma.user.findFirst({ where: { id: doctorUserId, role: "doctor", isActive: true } });
      if (!u) {
        res.status(400).json({ error: "Invalid doctor user" });
        return;
      }
    }

    const uid = req.user?.sub ?? null;

    try {
      const conflict = await findConflict(prisma, {
        startsAt,
        doctorUserId,
        doctorDisplayName: body.doctorDisplayName,
      });
      if (conflict) {
        res.status(409).json({ error: "This doctor already has an appointment at this time (not cancelled)." });
        return;
      }

      const row = await prisma.appointment.create({
        data: {
          patientId: body.patientId,
          doctorUserId,
          doctorDisplayName: body.doctorDisplayName.trim(),
          startsAt,
          appointmentType: body.appointmentType,
          chiefComplaint: body.chiefComplaint ?? null,
          staffNotes: body.staffNotes ?? null,
          status: "booked",
          createdById: uid,
        },
        include: {
          patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
          doctorUser: { select: { name: true } },
        },
      });
      res.status(201).json(serializeAppointment(row));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  router.patch("/:id", ...writeAuth, async (req: AuthedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = parsed.data;
    const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
    if (body.startsAt && Number.isNaN(startsAt.getTime())) {
      res.status(400).json({ error: "Invalid startsAt" });
      return;
    }
    if (body.startsAt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startsAt < today) {
        res.status(400).json({ error: "Cannot move appointment to the past" });
        return;
      }
    }

    let doctorUserId = body.doctorUserId !== undefined ? body.doctorUserId : existing.doctorUserId;
    if (body.doctorUserId !== undefined && body.doctorUserId) {
      const u = await prisma.user.findFirst({ where: { id: body.doctorUserId, role: "doctor", isActive: true } });
      if (!u) {
        res.status(400).json({ error: "Invalid doctor user" });
        return;
      }
    }
    const doctorDisplayName = body.doctorDisplayName ?? existing.doctorDisplayName;

    const conflict = await findConflict(prisma, {
      excludeId: id,
      startsAt,
      doctorUserId,
      doctorDisplayName,
    });
    if (conflict) {
      res.status(409).json({ error: "This doctor already has an appointment at this time (not cancelled)." });
      return;
    }

    const row = await prisma.appointment.update({
      where: { id },
      data: {
        doctorUserId,
        doctorDisplayName: doctorDisplayName.trim(),
        startsAt,
        appointmentType: body.appointmentType,
        chiefComplaint: body.chiefComplaint !== undefined ? body.chiefComplaint : undefined,
        staffNotes: body.staffNotes !== undefined ? body.staffNotes : undefined,
      },
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
        doctorUser: { select: { name: true } },
      },
    });
    res.json(serializeAppointment(row));
  });

  router.patch("/:id/status", ...writeAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const row = await prisma.appointment.update({
      where: { id },
      data: { status: parsed.data.status },
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
        doctorUser: { select: { name: true } },
      },
    });
    res.json(serializeAppointment(row));
  });

  app.use("/api/appointments", router);
}
