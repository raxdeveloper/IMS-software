import type { Express, NextFunction, Request, Response } from "express";
import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  calculateAge,
  digitsOnly,
  escapeLikePattern,
  normalizeNepalPhone,
  validateNepalPrimaryPhone,
  validateNepalPhoneOptional,
  validateNepalPostal,
} from "../lib/patientUtils.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const uploadsRoot = path.join(process.cwd(), "uploads", "patients");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 },
});

function optionalPhoto(req: Request, res: Response, next: NextFunction): void {
  const ct = req.headers["content-type"] ?? "";
  if (ct.includes("multipart/form-data")) {
    upload.single("photo")(req, res, next);
  } else {
    next();
  }
}

const genderEnum = z.enum(["Male", "Female", "Other"]);

const basePatientFields = {
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional().nullable(),
  lastName: z.string().min(1).max(100),
  dob: z.coerce.date(),
  gender: genderEnum,
  phone1: z.string().min(1),
  phone2: z.string().optional().nullable(),
  email: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.union([z.string().email(), z.null()]).optional(),
  ),
  address: z.string().max(5000).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  province: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  postalCode: z.string().optional().nullable(),
  occupation: z.string().max(100).optional().nullable(),
  referredBy: z.string().max(150).optional().nullable(),
  bloodGroup: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).nullable(),
  ),
  knownAllergies: z.string().max(5000).optional().nullable(),
  medicalHistory: z.string().max(5000).optional().nullable(),
};

function validateDob(d: Date): string | null {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d.getTime() > today.getTime()) return "Date of birth cannot be in the future";
  const oldest = new Date();
  oldest.setFullYear(oldest.getFullYear() - 120);
  if (d < oldest) return "Date of birth cannot be more than 120 years ago";
  return null;
}


async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(uploadsRoot, { recursive: true });
}

async function generatePatientCode(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ymd = `${y}${m}${d}`;
  const prefix = `PAT-${ymd}-`;
  const last = await tx.patient.findFirst({
    where: { patientCode: { startsWith: prefix } },
    orderBy: { patientCode: "desc" },
    select: { patientCode: true },
  });
  let next = 1;
  if (last?.patientCode) {
    const suf = last.patientCode.slice(-4);
    const n = parseInt(suf, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function serializePatient(p: {
  id: number;
  patientCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dob: Date;
  age: number | null;
  gender: string;
  phone1: string;
  phone2: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  district: string | null;
  postalCode: string | null;
  occupation: string | null;
  referredBy: string | null;
  bloodGroup: string | null;
  knownAllergies: string | null;
  medicalHistory: string | null;
  photoUrl: string | null;
  profileComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  isDeleted: boolean;
}) {
  return {
    id: p.id,
    patientCode: p.patientCode,
    firstName: p.firstName,
    middleName: p.middleName,
    lastName: p.lastName,
    dob: p.dob.toISOString().slice(0, 10),
    age: p.age,
    gender: p.gender,
    phone1: p.phone1,
    phone2: p.phone2,
    email: p.email,
    address: p.address,
    city: p.city,
    province: p.province,
    district: p.district,
    postalCode: p.postalCode,
    occupation: p.occupation,
    referredBy: p.referredBy,
    bloodGroup: p.bloodGroup,
    knownAllergies: p.knownAllergies,
    medicalHistory: p.medicalHistory,
    photoUrl: p.photoUrl,
    profileComplete: p.profileComplete,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    createdById: p.createdById,
    isDeleted: p.isDeleted,
  };
}

const quickCreateSchema = z.object({
  quick: z.literal(true).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone1: z.string().min(1),
  dob: z.coerce.date(),
  gender: genderEnum,
  province: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
});

const profileCompleteField = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  return v === true || v === "true" || v === "1";
}, z.boolean().optional());

const fullCreateSchema = z.object({
  ...basePatientFields,
  profileComplete: profileCompleteField,
  quick: z.literal(false).optional(),
});

const updateSchema = z.object({
  ...basePatientFields,
  profileComplete: profileCompleteField,
});

const router = Router();

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const writeAuth = [authenticate, requireRoles("admin", "staff")];
const adminAuth = [authenticate, requireRoles("admin")];

router.get("/cities", ...readAuth, async (_req, res) => {
  const rows = await prisma.patient.groupBy({
    by: ["city"],
    where: {
      isDeleted: false,
      AND: [{ city: { not: null } }, { city: { not: "" } }],
    },
  });
  const cities = rows
    .map((r) => r.city)
    .filter((c): c is string => Boolean(c && String(c).trim()))
    .sort((a, b) => a.localeCompare(b));
  res.json({ cities });
});

router.get("/check-phone", ...readAuth, async (req, res) => {
  const phone = typeof req.query.phone === "string" ? req.query.phone : "";
  const normalized = normalizeNepalPhone(phone);
  if (normalized.length !== 10) {
    res.status(400).json({ error: "phone query must be 10 digits" });
    return;
  }
  const patient = await prisma.patient.findFirst({
    where: { phone1: normalized, isDeleted: false },
    select: {
      id: true,
      patientCode: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!patient) {
    res.json({ exists: false });
    return;
  }
  res.json({
    exists: true,
    patient: {
      id: patient.id,
      patientCode: patient.patientCode,
      firstName: patient.firstName,
      lastName: patient.lastName,
    },
  });
});

router.get("/", ...readAuth, async (req, res) => {
  const q = z
    .object({
      search: z.string().optional(),
      gender: z.enum(["", "Male", "Female", "Other"]).optional(),
      city: z.string().optional(),
      sort: z.enum(["newest", "name_asc", "name_desc"]).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      include_deleted: z.enum(["true", "false", "1", "0"]).optional(),
      incomplete: z.enum(["true", "false", "1", "0"]).optional(),
    })
    .parse({
      search:
        typeof req.query.search === "string"
          ? req.query.search
          : typeof req.query.q === "string"
            ? req.query.q
            : undefined,
      gender: req.query.gender,
      city: req.query.city,
      sort: req.query.sort,
      page: req.query.page,
      limit: req.query.limit,
      include_deleted: req.query.include_deleted,
      incomplete: req.query.incomplete,
    });

  const page = q.page ?? 1;
  const limit = q.limit ?? 20;
  const includeDeleted =
    q.include_deleted === "true" || q.include_deleted === "1";
  const incompleteOnly = q.incomplete === "true" || q.incomplete === "1";
  const sort = q.sort ?? "newest";

  const base: Prisma.PatientWhereInput = {};
  if (!includeDeleted) base.isDeleted = false;
  if (q.gender) base.gender = q.gender;
  if (q.city && q.city.trim()) base.city = q.city.trim();
  if (incompleteOnly) base.profileComplete = false;

  const searchRaw = q.search?.trim();
  let searchIds: number[] | undefined;
  if (searchRaw) {
    const esc = escapeLikePattern(searchRaw);
    const pattern = `%${esc.toLowerCase()}%`;
    const digitPattern = `%${digitsOnly(searchRaw)}%`;
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM patients
      WHERE (
        LOWER(first_name) LIKE ${pattern}
        OR LOWER(COALESCE(middle_name, '')) LIKE ${pattern}
        OR LOWER(last_name) LIKE ${pattern}
        OR LOWER(patient_code) LIKE ${pattern}
        OR phone1 LIKE ${digitPattern}
        OR COALESCE(phone2, '') LIKE ${digitPattern}
      )
    `;
    searchIds = rows.map((r) => r.id);
    if (searchIds.length === 0) {
      res.json({ data: [], total: 0, page: 1, pages: 1, limit });
      return;
    }
  }

  const where: Prisma.PatientWhereInput = {
    AND: [base, searchIds ? { id: { in: searchIds } } : {}],
  };

  let orderBy: Prisma.PatientOrderByWithRelationInput | Prisma.PatientOrderByWithRelationInput[];
  if (sort === "name_asc") orderBy = [{ lastName: "asc" }, { firstName: "asc" }];
  else if (sort === "name_desc") orderBy = [{ lastName: "desc" }, { firstName: "desc" }];
  else orderBy = { createdAt: "desc" };

  const total = await prisma.patient.count({ where });
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const skip = (safePage - 1) * limit;

  const data = await prisma.patient.findMany({
    where,
    orderBy,
    skip,
    take: limit,
    include: { createdBy: { select: { name: true } } },
  });

  res.json({
    data: data.map((p) => ({
      ...serializePatient(p),
      registeredByName: p.createdBy?.name ?? null,
    })),
    total,
    page: safePage,
    pages,
    limit,
  });
});

router.get("/:id", ...readAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const patient = await prisma.patient.findUnique({
    where: { id },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  res.json({
    ...serializePatient(patient),
    registeredByName: patient.createdBy?.name ?? null,
    registeredByEmail: patient.createdBy?.email ?? null,
    prescriptionCount: 0,
    orderCount: 0,
    lastVisit: null as string | null,
  });
});

router.post("/", ...writeAuth, optionalPhoto, async (req: AuthedRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const qv = body.quick;
  const isQuick =
    qv === true ||
    qv === "true" ||
    qv === "1" ||
    (typeof qv === "string" && qv.toLowerCase() === "true");

  if (isQuick) {
    const parsed = quickCreateSchema.safeParse({
      quick: true,
      firstName: body.firstName,
      lastName: body.lastName,
      phone1: body.phone1,
      dob: body.dob,
      gender: body.gender,
      province: body.province,
      district: body.district,
    } as Record<string, unknown>);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const errDob = validateDob(parsed.data.dob);
    if (errDob) {
      res.status(400).json({ error: errDob });
      return;
    }
    const errP = validateNepalPrimaryPhone(parsed.data.phone1);
    if (errP) {
      res.status(400).json({ error: errP });
      return;
    }
    const phone1 = normalizeNepalPhone(parsed.data.phone1);
    const age = calculateAge(parsed.data.dob);

    const created = await prisma.$transaction(async (tx) => {
      const patientCode = await generatePatientCode(tx);
      return tx.patient.create({
        data: {
          patientCode,
          firstName: parsed.data.firstName.trim(),
          middleName: null,
          lastName: parsed.data.lastName.trim(),
          dob: parsed.data.dob,
          age,
          gender: parsed.data.gender,
          phone1,
          phone2: null,
          email: null,
          address: null,
          city: null,
          province: parsed.data.province?.trim() || null,
          district: parsed.data.district?.trim() || null,
          postalCode: null,
          occupation: null,
          referredBy: null,
          bloodGroup: null,
          knownAllergies: null,
          medicalHistory: null,
          photoUrl: null,
          profileComplete: false,
          createdById: req.user!.sub,
          isDeleted: false,
        },
      });
    });

    res.status(201).json(serializePatient(created));
    return;
  }

  const jsonPayload = {
    firstName: body.firstName,
    middleName: body.middleName,
    lastName: body.lastName,
    dob: body.dob,
    gender: body.gender,
    phone1: body.phone1,
    phone2: body.phone2,
    email: body.email,
    address: body.address,
    city: body.city,
    province: body.province,
    district: body.district,
    postalCode: body.postalCode,
    occupation: body.occupation,
    referredBy: body.referredBy,
    bloodGroup: body.bloodGroup,
    knownAllergies: body.knownAllergies,
    medicalHistory: body.medicalHistory,
    profileComplete: body.profileComplete,
  };

  const parsed = fullCreateSchema.safeParse(jsonPayload);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const errDob = validateDob(parsed.data.dob);
  if (errDob) {
    res.status(400).json({ error: errDob });
    return;
  }
  const errP = validateNepalPrimaryPhone(parsed.data.phone1);
  if (errP) {
    res.status(400).json({ error: errP });
    return;
  }
  const errP2 = validateNepalPhoneOptional(parsed.data.phone2 ?? null);
  if (errP2) {
    res.status(400).json({ error: errP2 });
    return;
  }
  const errPin = validateNepalPostal(parsed.data.postalCode ?? null);
  if (errPin) {
    res.status(400).json({ error: errPin });
    return;
  }

  const phone1 = normalizeNepalPhone(parsed.data.phone1);
  const phone2 = parsed.data.phone2?.trim()
    ? normalizeNepalPhone(parsed.data.phone2)
    : null;
  const age = calculateAge(parsed.data.dob);
  const email =
    parsed.data.email && String(parsed.data.email).trim()
      ? String(parsed.data.email).trim().toLowerCase()
      : null;

  const file = req.file;
  if (file && file.size > 200 * 1024) {
    res.status(400).json({ error: "Photo must be 200KB or smaller" });
    return;
  }

  const created = await prisma.$transaction(async (tx) => {
    const patientCode = await generatePatientCode(tx);
    const row = await tx.patient.create({
      data: {
        patientCode,
        firstName: parsed.data.firstName.trim(),
        middleName: parsed.data.middleName?.trim() || null,
        lastName: parsed.data.lastName.trim(),
        dob: parsed.data.dob,
        age,
        gender: parsed.data.gender,
        phone1,
        phone2,
        email,
        address: parsed.data.address?.trim() || null,
        city: parsed.data.city?.trim() || null,
        province: parsed.data.province?.trim() || null,
        district: parsed.data.district?.trim() || null,
        postalCode: parsed.data.postalCode?.trim() || null,
        occupation: parsed.data.occupation?.trim() || null,
        referredBy: parsed.data.referredBy?.trim() || null,
        bloodGroup: parsed.data.bloodGroup ?? null,
        knownAllergies: parsed.data.knownAllergies?.trim() || null,
        medicalHistory: parsed.data.medicalHistory?.trim() || null,
        photoUrl: null,
        profileComplete: parsed.data.profileComplete !== false,
        createdById: req.user!.sub,
        isDeleted: false,
      },
    });

    if (file?.buffer?.length) {
      await ensureUploadsDir();
      const ext = file.mimetype === "image/png" ? "png" : "jpg";
      const filename = `${row.id}.${ext}`;
      const diskPath = path.join(uploadsRoot, filename);
      await fs.writeFile(diskPath, file.buffer);
      const photoUrl = `/uploads/patients/${filename}`;
      return tx.patient.update({
        where: { id: row.id },
        data: { photoUrl },
      });
    }
    return row;
  });

  res.status(201).json(serializePatient(created));
});

router.put("/:id", ...writeAuth, optionalPhoto, async (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const body = req.body as Record<string, string | undefined>;
  const jsonPayload = {
    firstName: body.firstName,
    middleName: body.middleName,
    lastName: body.lastName,
    dob: body.dob,
    gender: body.gender,
    phone1: body.phone1,
    phone2: body.phone2,
    email: body.email,
    address: body.address,
    city: body.city,
    province: body.province,
    district: body.district,
    postalCode: body.postalCode,
    occupation: body.occupation,
    referredBy: body.referredBy,
    bloodGroup: body.bloodGroup,
    knownAllergies: body.knownAllergies,
    medicalHistory: body.medicalHistory,
    profileComplete: body.profileComplete,
  };

  const parsed = updateSchema.safeParse(jsonPayload);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const errDob = validateDob(parsed.data.dob);
  if (errDob) {
    res.status(400).json({ error: errDob });
    return;
  }
  const errP = validateNepalPrimaryPhone(parsed.data.phone1);
  if (errP) {
    res.status(400).json({ error: errP });
    return;
  }
  const errP2 = validateNepalPhoneOptional(parsed.data.phone2 ?? null);
  if (errP2) {
    res.status(400).json({ error: errP2 });
    return;
  }
  const errPin = validateNepalPostal(parsed.data.postalCode ?? null);
  if (errPin) {
    res.status(400).json({ error: errPin });
    return;
  }

  const phone1 = normalizeNepalPhone(parsed.data.phone1);
  const phone2 = parsed.data.phone2?.trim()
    ? normalizeNepalPhone(parsed.data.phone2)
    : null;
  const age = calculateAge(parsed.data.dob);
  const email =
    parsed.data.email && String(parsed.data.email).trim()
      ? String(parsed.data.email).trim().toLowerCase()
      : null;

  const file = req.file;
  if (file && file.size > 200 * 1024) {
    res.status(400).json({ error: "Photo must be 200KB or smaller" });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    let photoUrl = existing.photoUrl;
    if (file?.buffer?.length) {
      await ensureUploadsDir();
      const ext = file.mimetype === "image/png" ? "png" : "jpg";
      const filename = `${id}.${ext}`;
      const diskPath = path.join(uploadsRoot, filename);
      await fs.writeFile(diskPath, file.buffer);
      photoUrl = `/uploads/patients/${filename}`;
    }

    return tx.patient.update({
      where: { id },
      data: {
        firstName: parsed.data.firstName.trim(),
        middleName: parsed.data.middleName?.trim() || null,
        lastName: parsed.data.lastName.trim(),
        dob: parsed.data.dob,
        age,
        gender: parsed.data.gender,
        phone1,
        phone2,
        email,
        address: parsed.data.address?.trim() || null,
        city: parsed.data.city?.trim() || null,
        province: parsed.data.province?.trim() || null,
        district: parsed.data.district?.trim() || null,
        postalCode: parsed.data.postalCode?.trim() || null,
        occupation: parsed.data.occupation?.trim() || null,
        referredBy: parsed.data.referredBy?.trim() || null,
        bloodGroup: parsed.data.bloodGroup ?? null,
        knownAllergies: parsed.data.knownAllergies?.trim() || null,
        medicalHistory: parsed.data.medicalHistory?.trim() || null,
        photoUrl,
        profileComplete:
          parsed.data.profileComplete !== undefined
            ? Boolean(parsed.data.profileComplete)
            : existing.profileComplete,
      },
    });
  });

  res.json(serializePatient(updated));
});

router.delete("/:id", ...adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  await prisma.patient.update({
    where: { id },
    data: { isDeleted: true },
  });
  res.status(204).send();
});

router.put("/:id/restore", ...adminAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  const row = await prisma.patient.update({
    where: { id },
    data: { isDeleted: false },
  });
  res.json(serializePatient(row));
});

export function mountPatients(app: Express): void {
  app.use("/api/patients", router);
}
