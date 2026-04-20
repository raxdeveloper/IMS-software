import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import { mountPatients } from "./routes/patients.js";
import { mountPrescriptions } from "./routes/prescriptions.js";
import { mountFrames } from "./routes/frames.js";
import { mountLenses } from "./routes/lenses.js";
import { mountOrders } from "./routes/orders.js";
import { mountSettings } from "./routes/settings.js";
import { mountAppointments } from "./routes/appointments.js";
import { mountDashboard } from "./routes/dashboard.js";
import { mountReports } from "./routes/reports.js";
import { mountUsers } from "./routes/users.js";
import { prisma } from "./lib/prisma.js";
import { authenticate, requireRoles } from "./middleware/auth.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error("FATAL: Set JWT_SECRET to a strong value (at least 32 characters) in production.");
    process.exit(1);
  }
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function resolveClientDist(): string | null {
  const fromEnv = process.env.CLIENT_DIST?.trim();
  if (fromEnv) {
    const dir = path.resolve(fromEnv);
    return fs.existsSync(dir) ? dir : null;
  }
  const candidates = [
    path.resolve(process.cwd(), "client", "dist"),
    path.resolve(process.cwd(), "..", "client", "dist"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ophthalmic-ims-api" });
});

app.get("/api/health/deployment", authenticate, requireRoles("admin", "doctor", "staff"), async (_req, res) => {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }
  const [patients, prescriptions, orders] = await Promise.all([
    prisma.patient.count(),
    prisma.prescription.count(),
    prisma.order.count(),
  ]);
  res.json({
    ok: database === "ok",
    database,
    counts: { patients, prescriptions, orders },
    lastBackup: null as string | null,
  });
});

app.use("/api/auth", authRoutes);
mountPatients(app);
mountPrescriptions(app);
mountFrames(app);
mountLenses(app);
mountOrders(app);
mountSettings(app);
mountAppointments(app);
mountDashboard(app);
mountReports(app);
mountUsers(app);

const clientDist = resolveClientDist();
if (clientDist) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(404).send("Not found");
});

app.listen(port, host, () => {
  const where = host === "0.0.0.0" ? "all interfaces" : host;
  console.log(`API listening on http://${where}:${port}`);
  if (clientDist) {
    console.log(`Serving SPA from ${clientDist}`);
  }
});
