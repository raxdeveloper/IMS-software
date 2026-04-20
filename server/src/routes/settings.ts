import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const writeAuth = [authenticate, requireRoles("admin")];

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `clinic-logo-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});

function serializeClinic(s: {
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
  clinicEmail: string | null;
  clinicGstNumber: string | null;
  clinicLogoUrl: string | null;
  defaultGstPercent: number;
  invoiceTerms: string | null;
  currencySymbol: string;
  workingDaysJson: string;
  defaultReorderFrame: number;
  defaultReorderLens: number;
  appointmentStartMin: number;
  appointmentEndMin: number;
  appointmentSlotStepMin: number;
  reminderWhatsappTemplate: string | null;
  reminderSmsTemplate: string | null;
  reminderDayBefore: boolean;
  reminderTwoHours: boolean;
}) {
  return {
    clinicName: s.clinicName,
    clinicAddress: s.clinicAddress,
    clinicPhone: s.clinicPhone,
    clinicEmail: s.clinicEmail,
    clinicGstNumber: s.clinicGstNumber,
    clinicLogoUrl: s.clinicLogoUrl,
    defaultGstPercent: s.defaultGstPercent,
    invoiceTerms: s.invoiceTerms,
    currencySymbol: s.currencySymbol,
    workingDaysJson: s.workingDaysJson,
    defaultReorderFrame: s.defaultReorderFrame,
    defaultReorderLens: s.defaultReorderLens,
    appointmentStartMin: s.appointmentStartMin,
    appointmentEndMin: s.appointmentEndMin,
    appointmentSlotStepMin: s.appointmentSlotStepMin,
    reminderWhatsappTemplate: s.reminderWhatsappTemplate,
    reminderSmsTemplate: s.reminderSmsTemplate,
    reminderDayBefore: s.reminderDayBefore,
    reminderTwoHours: s.reminderTwoHours,
  };
}

const patchSchema = z.object({
  clinicName: z.string().min(1).max(200).optional(),
  clinicAddress: z.string().max(5000).optional().nullable(),
  clinicPhone: z.string().max(50).optional().nullable(),
  clinicEmail: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.union([z.string().email(), z.null()]).optional(),
  ),
  clinicGstNumber: z.string().max(50).optional().nullable(),
  clinicLogoUrl: z.string().max(500).optional().nullable(),
  defaultGstPercent: z.number().int().min(0).max(100).optional(),
  invoiceTerms: z.string().max(5000).optional().nullable(),
  currencySymbol: z.string().min(1).max(8).optional(),
  workingDaysJson: z.string().max(500).optional(),
  defaultReorderFrame: z.number().int().min(0).max(99999).optional(),
  defaultReorderLens: z.number().int().min(0).max(99999).optional(),
  appointmentStartMin: z.number().int().min(0).max(1440).optional(),
  appointmentEndMin: z.number().int().min(0).max(1440).optional(),
  appointmentSlotStepMin: z.number().int().min(5).max(180).optional(),
  reminderWhatsappTemplate: z.string().max(8000).optional().nullable(),
  reminderSmsTemplate: z.string().max(8000).optional().nullable(),
  reminderDayBefore: z.boolean().optional(),
  reminderTwoHours: z.boolean().optional(),
});

async function ensureSettings() {
  const row = await prisma.clinicSettings.findUnique({ where: { id: 1 } });
  if (row) return row;
  return prisma.clinicSettings.create({
    data: { id: 1, clinicName: "Clinic", defaultGstPercent: 0 },
  });
}

export function mountSettings(app: Express): void {
  const router = Router();

  router.get("/clinic", ...readAuth, async (_req, res) => {
    const s = await ensureSettings();
    res.json(serializeClinic(s));
  });

  router.post("/clinic/logo", ...writeAuth, upload.single("file"), async (req: AuthedRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: "file required (image/jpeg, png, gif, webp)" });
      return;
    }
    const urlPath = `/uploads/${req.file.filename}`;
    await ensureSettings();
    const s = await prisma.clinicSettings.update({
      where: { id: 1 },
      data: { clinicLogoUrl: urlPath },
    });
    res.json({ clinicLogoUrl: s.clinicLogoUrl, settings: serializeClinic(s) });
  });

  router.patch("/clinic", ...writeAuth, async (req: AuthedRequest, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    if (parsed.data.workingDaysJson) {
      try {
        const w = JSON.parse(parsed.data.workingDaysJson) as unknown;
        if (!Array.isArray(w) || w.length !== 7 || !w.every((x) => typeof x === "boolean")) {
          res.status(400).json({ error: "workingDaysJson must be a JSON array of 7 booleans" });
          return;
        }
      } catch {
        res.status(400).json({ error: "workingDaysJson must be valid JSON" });
        return;
      }
    }
    await ensureSettings();
    const s = await prisma.clinicSettings.update({
      where: { id: 1 },
      data: {
        ...parsed.data,
      },
    });
    res.json(serializeClinic(s));
  });

  app.use("/api/settings", router);
}
