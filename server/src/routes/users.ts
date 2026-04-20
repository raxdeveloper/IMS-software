import type { Express } from "express";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const adminAuth = [authenticate, requireRoles("admin")];

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "doctor", "staff"]),
});

const patchUserSchema = z.object({
  role: z.enum(["admin", "doctor", "staff"]).optional(),
  isActive: z.boolean().optional(),
});

export function mountUsers(app: Express): void {
  const router = Router();

  router.get("/", ...adminAuth, async (_req, res) => {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json({ data: rows });
  });

  router.post("/", ...adminAuth, async (req: AuthedRequest, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { name, email, password, role } = parsed.data;
    const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (exists) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.status(201).json({ user });
  });

  router.patch("/:id", ...adminAuth, async (req: AuthedRequest, res) => {
    const id = req.params.id;
    const parsed = patchUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const self = req.user!.sub;
    if (parsed.data.isActive === false && id === self) {
      res.status(400).json({ error: "You cannot deactivate your own account" });
      return;
    }
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json({ user });
  });

  app.use("/api/users", router);
}
