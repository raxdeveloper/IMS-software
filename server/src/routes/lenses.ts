import type { Express } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { paiseToRupeesString, parseRupeesInput } from "../lib/moneyInr.js";
import { decodeOptical } from "../lib/optical.js";
import {
  COATINGS,
  COLOR_TYPES,
  CONTACT_MODALITIES,
  CONTACT_TYPES,
  indexSortValue,
  LENS_INDEXES,
  SIDE_OPTIONS,
  SPECTACLE_LENS_TYPES,
  STOCK_UNITS,
} from "../lib/lensConstants.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const writeAuth = [authenticate, requireRoles("admin", "staff")];
const MOVEMENT_TYPES = ["stock_in", "stock_out", "damage", "return", "correction"] as const;

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  row.push(cur);
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) rows.push(row);
  return rows;
}

function stockStatus(stockQty: number, reorderLevel: number): "in_stock" | "low_stock" | "out_of_stock" {
  if (stockQty <= 0) return "out_of_stock";
  if (stockQty <= reorderLevel) return "low_stock";
  return "in_stock";
}

async function suggestSpectacleSku(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.spectacleLens.findMany({ select: { sku: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^LNS-(\d{1,6})$/i.exec(r.sku.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `LNS-${String(max + 1).padStart(5, "0")}`;
}

async function suggestContactSku(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.contactLens.findMany({ select: { sku: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^CON-(\d{1,6})$/i.exec(r.sku.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `CON-${String(max + 1).padStart(5, "0")}`;
}

function rangeLabel(from: number, to: number): string {
  return `${decodeOptical(from)} to ${decodeOptical(to)}`;
}

const spectacleBodySchema = z.object({
  sku: z.string().min(1).max(80),
  brand: z.string().min(1).max(200),
  lensType: z.enum(SPECTACLE_LENS_TYPES),
  lensIndex: z.enum(LENS_INDEXES),
  coating: z.enum(COATINGS),
  sphFrom: z.number().int(),
  sphTo: z.number().int(),
  cylFrom: z.number().int(),
  cylTo: z.number().int(),
  side: z.enum(SIDE_OPTIONS),
  stockUnit: z.enum(STOCK_UNITS),
  purchasePrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  stockQty: z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
  supplierName: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

const batchSchema = z.object({
  batchCode: z.string().min(1).max(120),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const contactBodySchema = z.object({
  sku: z.string().min(1).max(80),
  brand: z.string().min(1).max(200),
  contactType: z.enum(CONTACT_TYPES),
  modality: z.enum(CONTACT_MODALITIES),
  power: z.number().int(),
  bc: z.string().min(1).max(20),
  dia: z.string().min(1).max(20),
  colorType: z.enum(COLOR_TYPES),
  colorName: z.string().max(120).optional().nullable(),
  boxQty: z.number().int().min(1),
  purchasePrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  stockQty: z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
  expiryTracking: z.boolean(),
  supplierName: z.string().max(200).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  batches: z.array(batchSchema).optional(),
});

function serializeSpectacle(l: {
  id: number;
  sku: string;
  brand: string;
  lensType: string;
  lensIndex: string;
  coating: string;
  sphFrom: number;
  sphTo: number;
  cylFrom: number;
  cylTo: number;
  side: string;
  stockUnit: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
  reorderLevel: number;
  supplierName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
}) {
  return {
    id: l.id,
    sku: l.sku,
    brand: l.brand,
    lensType: l.lensType,
    lensIndex: l.lensIndex,
    coating: l.coating,
    sphFrom: l.sphFrom,
    sphTo: l.sphTo,
    cylFrom: l.cylFrom,
    cylTo: l.cylTo,
    sphRangeLabel: rangeLabel(l.sphFrom, l.sphTo),
    cylRangeLabel: rangeLabel(l.cylFrom, l.cylTo),
    side: l.side,
    stockUnit: l.stockUnit,
    purchasePrice: l.purchasePrice,
    sellingPrice: l.sellingPrice,
    stockQty: l.stockQty,
    reorderLevel: l.reorderLevel,
    supplierName: l.supplierName,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    createdById: l.createdById,
    status: stockStatus(l.stockQty, l.reorderLevel),
  };
}

function serializeContact(
  c: {
    id: number;
    sku: string;
    brand: string;
    contactType: string;
    modality: string;
    power: number;
    bc: string;
    dia: string;
    colorType: string;
    colorName: string | null;
    boxQty: number;
    purchasePrice: number;
    sellingPrice: number;
    stockQty: number;
    reorderLevel: number;
    expiryTracking: boolean;
    supplierName: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdById: string | null;
  },
  batches: { batchCode: string; expiryDate: Date; id: number }[],
) {
  return {
    id: c.id,
    sku: c.sku,
    brand: c.brand,
    contactType: c.contactType,
    modality: c.modality,
    power: c.power,
    bc: c.bc,
    dia: c.dia,
    colorType: c.colorType,
    colorName: c.colorName,
    boxQty: c.boxQty,
    purchasePrice: c.purchasePrice,
    sellingPrice: c.sellingPrice,
    stockQty: c.stockQty,
    reorderLevel: c.reorderLevel,
    expiryTracking: c.expiryTracking,
    supplierName: c.supplierName,
    notes: c.notes,
    batches: batches.map((b) => ({
      id: b.id,
      batchCode: b.batchCode,
      expiryDate: b.expiryDate.toISOString().slice(0, 10),
    })),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    createdById: c.createdById,
    status: stockStatus(c.stockQty, c.reorderLevel),
  };
}

const stockAdjustSchema = z.object({
  movementType: z.enum(MOVEMENT_TYPES),
  quantity: z.number().int().min(1),
  reason: z.string().min(1).max(2000),
  reference: z.string().max(200).optional().nullable(),
  correctionDirection: z.enum(["add", "subtract"]).optional(),
});

export function mountLenses(app: Express): void {
  const router = Router();

  router.get("/stats/low-stock-count", ...readAuth, async (_req, res) => {
    const [spec, con] = await Promise.all([
      prisma.spectacleLens.findMany({ select: { stockQty: true, reorderLevel: true } }),
      prisma.contactLens.findMany({ select: { stockQty: true, reorderLevel: true } }),
    ]);
    const ns = spec.filter((x) => x.stockQty > 0 && x.stockQty <= x.reorderLevel).length;
    const nc = con.filter((x) => x.stockQty > 0 && x.stockQty <= x.reorderLevel).length;
    res.json({ spectacle: ns, contact: nc, total: ns + nc });
  });

  router.get("/stock-movements", ...readAuth, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const total = await prisma.lensStockMovement.count();
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const skip = (safePage - 1) * limit;
    const rows = await prisma.lensStockMovement.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        spectacleLens: { select: { sku: true, brand: true } },
        contactLens: { select: { sku: true, brand: true } },
        createdBy: { select: { name: true } },
      },
    });
    res.json({
      data: rows.map((m) => ({
        id: m.id,
        kind: m.spectacleLensId ? ("spectacle" as const) : ("contact" as const),
        sku: m.spectacleLens?.sku ?? m.contactLens?.sku ?? "",
        brand: m.spectacleLens?.brand ?? m.contactLens?.brand ?? "",
        spectacleLensId: m.spectacleLensId,
        contactLensId: m.contactLensId,
        movementType: m.movementType,
        quantity: m.quantity,
        stockChange: m.stockChange,
        reason: m.reason,
        reference: m.reference,
        createdAt: m.createdAt.toISOString(),
        doneByName: m.createdBy?.name ?? null,
      })),
      total,
      page: safePage,
      pages,
      limit,
    });
  });

  // --- Spectacle: match ---
  router.get("/spectacle/match", ...readAuth, async (req, res) => {
    const sph = parseInt(String(req.query.sph ?? ""), 10);
    const cyl = parseInt(String(req.query.cyl ?? ""), 10);
    if (Number.isNaN(sph) || Number.isNaN(cyl)) {
      res.status(400).json({ error: "sph and cyl required (integer ×100)" });
      return;
    }
    const rows = await prisma.spectacleLens.findMany({
      where: {
        stockQty: { gt: 0 },
        sphFrom: { lte: sph },
        sphTo: { gte: sph },
        cylFrom: { lte: cyl },
        cylTo: { gte: cyl },
      },
    });
    rows.sort((a, b) => indexSortValue(b.lensIndex) - indexSortValue(a.lensIndex));
    res.json({ data: rows.map(serializeSpectacle) });
  });

  router.get("/spectacle/match-prescription/:rxId", ...readAuth, async (req, res) => {
    const rxId = parseInt(req.params.rxId, 10);
    const field = String(req.query.field ?? "dv_re");
    if (Number.isNaN(rxId)) {
      res.status(400).json({ error: "Invalid prescription id" });
      return;
    }
    const rx = await prisma.prescription.findFirst({ where: { id: rxId, isDeleted: false } });
    if (!rx) {
      res.status(404).json({ error: "Prescription not found" });
      return;
    }
    let sph = 0;
    let cyl = 0;
    switch (field) {
      case "dv_re":
        sph = rx.dvReSph;
        cyl = rx.dvReCyl;
        break;
      case "dv_le":
        sph = rx.dvLeSph;
        cyl = rx.dvLeCyl;
        break;
      case "nv_re":
        sph = rx.nvReSph;
        cyl = rx.nvReCyl;
        break;
      case "nv_le":
        sph = rx.nvLeSph;
        cyl = rx.nvLeCyl;
        break;
      default:
        res.status(400).json({ error: "field must be dv_re, dv_le, nv_re, or nv_le" });
        return;
    }
    const rows = await prisma.spectacleLens.findMany({
      where: {
        stockQty: { gt: 0 },
        sphFrom: { lte: sph },
        sphTo: { gte: sph },
        cylFrom: { lte: cyl },
        cylTo: { gte: cyl },
      },
    });
    rows.sort((a, b) => indexSortValue(b.lensIndex) - indexSortValue(a.lensIndex));
    res.json({
      field,
      sph,
      cyl,
      data: rows.map(serializeSpectacle),
    });
  });

  router.get("/spectacle/stats/low-stock-count", ...readAuth, async (_req, res) => {
    const rows = await prisma.spectacleLens.findMany({ select: { stockQty: true, reorderLevel: true } });
    const n = rows.filter((f) => f.stockQty > 0 && f.stockQty <= f.reorderLevel).length;
    res.json({ count: n });
  });

  router.get("/spectacle/brands", ...readAuth, async (_req, res) => {
    const rows = await prisma.spectacleLens.findMany({
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    });
    res.json({ brands: rows.map((r) => r.brand) });
  });

  router.get("/spectacle/suggest-sku", ...readAuth, async (_req, res) => {
    const sku = await prisma.$transaction((tx) => suggestSpectacleSku(tx));
    res.json({ sku });
  });

  router.get("/spectacle/export", ...readAuth, async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const where: Prisma.SpectacleLensWhereInput = {};
    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [{ brand: { contains: s } }, { sku: { contains: s } }, { lensType: { contains: s } }];
    }
    const rows = await prisma.spectacleLens.findMany({ where, orderBy: { sku: "asc" } });
    const header = [
      "sku",
      "brand",
      "lens_type",
      "lens_index",
      "coating",
      "sph_from",
      "sph_to",
      "cyl_from",
      "cyl_to",
      "side",
      "stock_unit",
      "purchase_price_inr",
      "selling_price_inr",
      "stock_qty",
      "reorder_level",
      "supplier_name",
      "notes",
    ];
    const lines = [header.join(",")];
    for (const f of rows) {
      lines.push(
        [
          escapeCsvCell(f.sku),
          escapeCsvCell(f.brand),
          escapeCsvCell(f.lensType),
          escapeCsvCell(f.lensIndex),
          escapeCsvCell(f.coating),
          decodeOptical(f.sphFrom),
          decodeOptical(f.sphTo),
          decodeOptical(f.cylFrom),
          decodeOptical(f.cylTo),
          escapeCsvCell(f.side),
          escapeCsvCell(f.stockUnit),
          escapeCsvCell(paiseToRupeesString(f.purchasePrice)),
          escapeCsvCell(paiseToRupeesString(f.sellingPrice)),
          String(f.stockQty),
          String(f.reorderLevel),
          escapeCsvCell(f.supplierName ?? ""),
          escapeCsvCell(f.notes ?? ""),
        ].join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="spectacle-lenses-export.csv"');
    res.send(lines.join("\n"));
  });

  router.post("/spectacle/import/preview", ...writeAuth, async (req, res) => {
    const body = z.object({ csv: z.string() }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const table = parseCsv(body.data.csv);
    if (table.length === 0) {
      res.json({ rows: [], summary: { total: 0, valid: 0, invalid: 0 } });
      return;
    }
    const header = table[0]!.map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const expected = [
      "sku",
      "brand",
      "lens_type",
      "lens_index",
      "coating",
      "sph_from",
      "sph_to",
      "cyl_from",
      "cyl_to",
      "side",
      "stock_unit",
      "purchase_price_inr",
      "selling_price_inr",
      "stock_qty",
      "reorder_level",
      "supplier_name",
      "notes",
    ];
    if (expected.some((e) => idx(e) < 0)) {
      res.status(400).json({ error: "CSV must include headers: " + expected.join(", ") });
      return;
    }
    const existing = new Set((await prisma.spectacleLens.findMany({ select: { sku: true } })).map((x) => x.sku.toLowerCase()));
    const seen = new Set<string>();
    type Row = {
      line: number;
      valid: boolean;
      errors: string[];
      payload: z.infer<typeof spectacleBodySchema> | null;
      duplicateInDb: boolean;
      duplicateInFile: boolean;
    };
    const out: Row[] = [];
    for (let r = 1; r < table.length; r++) {
      const lineNum = r + 1;
      const row = table[r]!;
      const g = (k: string) => {
        const i = idx(k);
        return i >= 0 && i < row.length ? row[i]!.trim() : "";
      };
      const errors: string[] = [];
      const sku = g("sku");
      const dupDb = Boolean(sku && existing.has(sku.toLowerCase()));
      const dupFile = Boolean(sku && seen.has(sku.toLowerCase()));
      if (sku && !dupFile) seen.add(sku.toLowerCase());
      const sphFrom = parseRupeesInput(g("sph_from"));
      const sphTo = parseRupeesInput(g("sph_to"));
      const cylFrom = parseRupeesInput(g("cyl_from"));
      const cylTo = parseRupeesInput(g("cyl_to"));
      const pp = parseRupeesInput(g("purchase_price_inr"));
      const sp = parseRupeesInput(g("selling_price_inr"));
      const stockQty = parseInt(g("stock_qty"), 10);
      const reorderLevel = parseInt(g("reorder_level"), 10);
      if (!g("brand")) errors.push("brand required");
      if (!SPECTACLE_LENS_TYPES.includes(g("lens_type") as (typeof SPECTACLE_LENS_TYPES)[number]))
        errors.push("lens_type invalid");
      if (!LENS_INDEXES.includes(g("lens_index") as (typeof LENS_INDEXES)[number])) errors.push("lens_index invalid");
      if (!COATINGS.includes(g("coating") as (typeof COATINGS)[number])) errors.push("coating invalid");
      if (!SIDE_OPTIONS.includes(g("side") as (typeof SIDE_OPTIONS)[number])) errors.push("side invalid");
      if (!STOCK_UNITS.includes(g("stock_unit") as (typeof STOCK_UNITS)[number])) errors.push("stock_unit invalid");
      if (sphFrom === null || sphTo === null || cylFrom === null || cylTo === null) errors.push("range invalid");
      if (pp === null || sp === null) errors.push("price invalid");
      if (Number.isNaN(stockQty) || stockQty < 0) errors.push("stock invalid");
      if (Number.isNaN(reorderLevel) || reorderLevel < 0) errors.push("reorder invalid");
      if (dupFile) errors.push("Duplicate SKU in file");
      if (dupDb) errors.push("SKU exists in DB");
      let payload: z.infer<typeof spectacleBodySchema> | null = null;
      if (
        sku &&
        sphFrom !== null &&
        sphTo !== null &&
        cylFrom !== null &&
        cylTo !== null &&
        pp !== null &&
        sp !== null &&
        !Number.isNaN(stockQty) &&
        !Number.isNaN(reorderLevel)
      ) {
        const parsed = spectacleBodySchema.safeParse({
          sku,
          brand: g("brand"),
          lensType: g("lens_type"),
          lensIndex: g("lens_index"),
          coating: g("coating"),
          sphFrom,
          sphTo,
          cylFrom,
          cylTo,
          side: g("side"),
          stockUnit: g("stock_unit"),
          purchasePrice: pp,
          sellingPrice: sp,
          stockQty,
          reorderLevel,
          supplierName: g("supplier_name") || null,
          notes: g("notes") || null,
        });
        if (!parsed.success) errors.push(...parsed.error.issues.map((i) => i.message));
        else payload = parsed.data;
      }
      const valid = Boolean(payload && errors.length === 0 && !dupDb && !dupFile);
      out.push({ line: lineNum, valid, errors, payload: valid ? payload : null, duplicateInDb: dupDb, duplicateInFile: dupFile });
    }
    res.json({
      rows: out,
      summary: { total: out.length, valid: out.filter((x) => x.valid).length, invalid: out.filter((x) => !x.valid).length },
    });
  });

  router.post("/spectacle/import/confirm", ...writeAuth, async (req: AuthedRequest, res) => {
    const body = z.object({ payloads: z.array(spectacleBodySchema) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const uid = req.user?.sub ?? null;
    let imported = 0;
    let skipped = 0;
    for (const p of body.data.payloads) {
      try {
        await prisma.spectacleLens.create({
          data: { ...p, supplierName: p.supplierName ?? null, notes: p.notes ?? null, createdById: uid },
        });
        imported++;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") skipped++;
        else throw e;
      }
    }
    res.json({ imported, skipped, errors: [] as string[] });
  });

  async function applySpectacleStock(
    spectacleLensId: number,
    parsed: z.infer<typeof stockAdjustSchema>,
    uid: string | null,
  ) {
    const { movementType, quantity, reason, reference } = parsed;
    let stockChange = 0;
    if (movementType === "stock_in" || movementType === "return") stockChange = quantity;
    else if (movementType === "stock_out" || movementType === "damage") stockChange = -quantity;
    else {
      const dir = parsed.correctionDirection ?? "add";
      stockChange = dir === "add" ? quantity : -quantity;
    }
    return prisma.$transaction(async (tx) => {
      const lens = await tx.spectacleLens.findUnique({ where: { id: spectacleLensId } });
      if (!lens) return { error: "NOT_FOUND" as const };
      const newQty = lens.stockQty + stockChange;
      if (newQty < 0) return { error: "NEGATIVE" as const, current: lens.stockQty };
      const updated = await tx.spectacleLens.update({
        where: { id: spectacleLensId },
        data: { stockQty: newQty },
      });
      const mov = await tx.lensStockMovement.create({
        data: {
          spectacleLensId,
          contactLensId: null,
          movementType,
          quantity,
          stockChange,
          reason,
          reference: reference ?? null,
          createdById: uid,
        },
      });
      return { lens: updated, mov };
    });
  }

  async function applyContactStock(
    contactLensId: number,
    parsed: z.infer<typeof stockAdjustSchema>,
    uid: string | null,
  ) {
    const { movementType, quantity, reason, reference } = parsed;
    let stockChange = 0;
    if (movementType === "stock_in" || movementType === "return") stockChange = quantity;
    else if (movementType === "stock_out" || movementType === "damage") stockChange = -quantity;
    else {
      const dir = parsed.correctionDirection ?? "add";
      stockChange = dir === "add" ? quantity : -quantity;
    }
    return prisma.$transaction(async (tx) => {
      const lens = await tx.contactLens.findUnique({ where: { id: contactLensId } });
      if (!lens) return { error: "NOT_FOUND" as const };
      const newQty = lens.stockQty + stockChange;
      if (newQty < 0) return { error: "NEGATIVE" as const, current: lens.stockQty };
      const updated = await tx.contactLens.update({
        where: { id: contactLensId },
        data: { stockQty: newQty },
      });
      const mov = await tx.lensStockMovement.create({
        data: {
          spectacleLensId: null,
          contactLensId,
          movementType,
          quantity,
          stockChange,
          reason,
          reference: reference ?? null,
          createdById: uid,
        },
      });
      return { lens: updated, mov };
    });
  }

  router.get("/spectacle", ...readAuth, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const lensType = typeof req.query.lensType === "string" ? req.query.lensType : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "brand";
    const order = req.query.order === "desc" ? "desc" : "asc";
    const and: Prisma.SpectacleLensWhereInput[] = [];
    if (search?.trim()) {
      const s = search.trim();
      and.push({ OR: [{ brand: { contains: s } }, { sku: { contains: s } }, { coating: { contains: s } }] });
    }
    if (lensType && lensType !== "all") and.push({ lensType });
    const baseWhere: Prisma.SpectacleLensWhereInput = and.length ? { AND: and } : {};
    let orderBy: Prisma.SpectacleLensOrderByWithRelationInput = { brand: order };
    if (sort === "stock") orderBy = { stockQty: order };
    else if (sort === "purchase_price") orderBy = { purchasePrice: order };
    else if (sort === "selling_price" || sort === "price") orderBy = { sellingPrice: order };
    else orderBy = { brand: order };

    if (status === "out_of_stock") {
      const where = { ...baseWhere, stockQty: 0 };
      const total = await prisma.spectacleLens.count({ where });
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const rows = await prisma.spectacleLens.findMany({
        where,
        orderBy,
        skip: (safePage - 1) * limit,
        take: limit,
      });
      return res.json({
        data: rows.map(serializeSpectacle),
        total,
        page: safePage,
        pages,
        limit,
      });
    }
    if (status === "low_stock" || status === "in_stock") {
      const all = await prisma.spectacleLens.findMany({ where: baseWhere, orderBy });
      const filtered = all.filter((f) => stockStatus(f.stockQty, f.reorderLevel) === status);
      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const slice = filtered.slice((safePage - 1) * limit, (safePage - 1) * limit + limit);
      return res.json({
        data: slice.map(serializeSpectacle),
        total,
        page: safePage,
        pages,
        limit,
      });
    }
    const total = await prisma.spectacleLens.count({ where: baseWhere });
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const rows = await prisma.spectacleLens.findMany({
      where: baseWhere,
      orderBy,
      skip: (safePage - 1) * limit,
      take: limit,
    });
    res.json({
      data: rows.map(serializeSpectacle),
      total,
      page: safePage,
      pages,
      limit,
    });
  });

  router.post("/spectacle", ...writeAuth, async (req: AuthedRequest, res) => {
    const parsed = spectacleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const uid = req.user?.sub ?? null;
    try {
      const row = await prisma.spectacleLens.create({
        data: { ...parsed.data, supplierName: parsed.data.supplierName ?? null, notes: parsed.data.notes ?? null, createdById: uid },
      });
      res.status(201).json(serializeSpectacle(row));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({ error: "SKU already exists" });
        return;
      }
      throw e;
    }
  });

  router.get("/spectacle/:id", ...readAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const row = await prisma.spectacleLens.findUnique({ where: { id } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeSpectacle(row));
  });

  router.put("/spectacle/:id", ...writeAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = spectacleBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const row = await prisma.spectacleLens.update({
        where: { id },
        data: { ...parsed.data, supplierName: parsed.data.supplierName ?? null, notes: parsed.data.notes ?? null },
      });
      res.json(serializeSpectacle(row));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({ error: "SKU already exists" });
        return;
      }
      throw e;
    }
  });

  router.get("/spectacle/:id/stock-movements", ...readAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const rows = await prisma.lensStockMovement.findMany({
      where: { spectacleLensId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { createdBy: { select: { name: true } } },
    });
    res.json({
      data: rows.map((m) => ({
        id: m.id,
        movementType: m.movementType,
        quantity: m.quantity,
        stockChange: m.stockChange,
        reason: m.reason,
        reference: m.reference,
        createdAt: m.createdAt.toISOString(),
        doneByName: m.createdBy?.name ?? null,
      })),
    });
  });

  router.post("/spectacle/:id/stock-movement", ...writeAuth, async (req: AuthedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = stockAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const uid = req.user?.sub ?? null;
    const result = await applySpectacleStock(id, parsed.data, uid);
    if (result && "error" in result && result.error === "NOT_FOUND") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (result && "error" in result && result.error === "NEGATIVE") {
      res.status(400).json({ error: "Stock cannot go negative", currentStock: result.current });
      return;
    }
    if (!result || !("lens" in result)) {
      res.status(500).json({ error: "Unexpected" });
      return;
    }
    const f = result.lens;
    const belowReorder = f.stockQty > 0 && f.stockQty <= f.reorderLevel;
    res.status(201).json({ frame: serializeSpectacle(f), belowReorder });
  });

  // --- Contact lens ---
  router.get("/contact/stats/low-stock-count", ...readAuth, async (_req, res) => {
    const rows = await prisma.contactLens.findMany({ select: { stockQty: true, reorderLevel: true } });
    const n = rows.filter((f) => f.stockQty > 0 && f.stockQty <= f.reorderLevel).length;
    res.json({ count: n });
  });

  router.get("/contact/brands", ...readAuth, async (_req, res) => {
    const rows = await prisma.contactLens.findMany({
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    });
    res.json({ brands: rows.map((r) => r.brand) });
  });

  router.get("/contact/suggest-sku", ...readAuth, async (_req, res) => {
    const sku = await prisma.$transaction((tx) => suggestContactSku(tx));
    res.json({ sku });
  });

  router.get("/contact/export", ...readAuth, async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const where: Prisma.ContactLensWhereInput = {};
    if (search?.trim()) {
      const s = search.trim();
      where.OR = [{ brand: { contains: s } }, { sku: { contains: s } }];
    }
    const rows = await prisma.contactLens.findMany({
      where,
      orderBy: { sku: "asc" },
      include: { batches: true },
    });
    const header = [
      "sku",
      "brand",
      "contact_type",
      "modality",
      "power",
      "bc",
      "dia",
      "color_type",
      "color_name",
      "box_qty",
      "purchase_price_inr",
      "selling_price_inr",
      "stock_qty",
      "reorder_level",
      "expiry_tracking",
      "batches_json",
      "supplier_name",
      "notes",
    ];
    const lines = [header.join(",")];
    for (const f of rows) {
      const batchesJson = JSON.stringify(
        f.batches.map((b) => ({ batchCode: b.batchCode, expiryDate: b.expiryDate.toISOString().slice(0, 10) })),
      );
      lines.push(
        [
          escapeCsvCell(f.sku),
          escapeCsvCell(f.brand),
          escapeCsvCell(f.contactType),
          escapeCsvCell(f.modality),
          paiseToRupeesString(f.power),
          escapeCsvCell(f.bc),
          escapeCsvCell(f.dia),
          escapeCsvCell(f.colorType),
          escapeCsvCell(f.colorName ?? ""),
          String(f.boxQty),
          escapeCsvCell(paiseToRupeesString(f.purchasePrice)),
          escapeCsvCell(paiseToRupeesString(f.sellingPrice)),
          String(f.stockQty),
          String(f.reorderLevel),
          f.expiryTracking ? "yes" : "no",
          escapeCsvCell(batchesJson),
          escapeCsvCell(f.supplierName ?? ""),
          escapeCsvCell(f.notes ?? ""),
        ].join(","),
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="contact-lenses-export.csv"');
    res.send(lines.join("\n"));
  });

  router.get("/contact", ...readAuth, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "brand";
    const order = req.query.order === "desc" ? "desc" : "asc";
    const and: Prisma.ContactLensWhereInput[] = [];
    if (search?.trim()) {
      const s = search.trim();
      and.push({ OR: [{ brand: { contains: s } }, { sku: { contains: s } }] });
    }
    const baseWhere: Prisma.ContactLensWhereInput = and.length ? { AND: and } : {};
    let orderBy: Prisma.ContactLensOrderByWithRelationInput = { brand: order };
    if (sort === "stock") orderBy = { stockQty: order };
    else if (sort === "purchase_price") orderBy = { purchasePrice: order };
    else if (sort === "selling_price" || sort === "price") orderBy = { sellingPrice: order };
    else orderBy = { brand: order };

    if (status === "out_of_stock") {
      const where = { ...baseWhere, stockQty: 0 };
      const total = await prisma.contactLens.count({ where });
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const rows = await prisma.contactLens.findMany({
        where,
        orderBy,
        skip: (safePage - 1) * limit,
        take: limit,
        include: { batches: true },
      });
      return res.json({
        data: rows.map((c) => serializeContact(c, c.batches)),
        total,
        page: safePage,
        pages,
        limit,
      });
    }
    if (status === "low_stock" || status === "in_stock") {
      const all = await prisma.contactLens.findMany({ where: baseWhere, orderBy, include: { batches: true } });
      const filtered = all.filter((f) => stockStatus(f.stockQty, f.reorderLevel) === status);
      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const slice = filtered.slice((safePage - 1) * limit, (safePage - 1) * limit + limit);
      return res.json({
        data: slice.map((c) => serializeContact(c, c.batches)),
        total,
        page: safePage,
        pages,
        limit,
      });
    }
    const total = await prisma.contactLens.count({ where: baseWhere });
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const rows = await prisma.contactLens.findMany({
      where: baseWhere,
      orderBy,
      skip: (safePage - 1) * limit,
      take: limit,
      include: { batches: true },
    });
    res.json({
      data: rows.map((c) => serializeContact(c, c.batches)),
      total,
      page: safePage,
      pages,
      limit,
    });
  });

  router.post("/contact", ...writeAuth, async (req: AuthedRequest, res) => {
    const parsed = contactBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const uid = req.user?.sub ?? null;
    const { batches, ...rest } = parsed.data;
    if (rest.colorType === "Colored" && !rest.colorName?.trim()) {
      res.status(400).json({ error: "colorName required when Colored" });
      return;
    }
    if (rest.expiryTracking && (!batches || batches.length === 0)) {
      res.status(400).json({ error: "Add at least one batch when expiry tracking is on" });
      return;
    }
    try {
      const row = await prisma.contactLens.create({
        data: {
          ...rest,
          colorName: rest.colorName ?? null,
          supplierName: rest.supplierName ?? null,
          notes: rest.notes ?? null,
          createdById: uid,
          batches:
            rest.expiryTracking && batches
              ? {
                  create: batches.map((b) => ({
                    batchCode: b.batchCode,
                    expiryDate: new Date(b.expiryDate + "T12:00:00"),
                  })),
                }
              : undefined,
        },
        include: { batches: true },
      });
      res.status(201).json(serializeContact(row, row.batches));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({ error: "SKU already exists" });
        return;
      }
      throw e;
    }
  });

  router.get("/contact/:id", ...readAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const row = await prisma.contactLens.findUnique({ where: { id }, include: { batches: true } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeContact(row, row.batches));
  });

  router.put("/contact/:id", ...writeAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = contactBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const { batches, ...rest } = parsed.data;
    if (rest.colorType === "Colored" && !rest.colorName?.trim()) {
      res.status(400).json({ error: "colorName required when Colored" });
      return;
    }
    if (rest.expiryTracking && (!batches || batches.length === 0)) {
      res.status(400).json({ error: "Add at least one batch when expiry tracking is on" });
      return;
    }
    await prisma.contactLensBatch.deleteMany({ where: { contactLensId: id } });
    const row = await prisma.contactLens.update({
      where: { id },
      data: {
        ...rest,
        colorName: rest.colorName ?? null,
        supplierName: rest.supplierName ?? null,
        notes: rest.notes ?? null,
        batches:
          rest.expiryTracking && batches
            ? {
                create: batches.map((b) => ({
                  batchCode: b.batchCode,
                  expiryDate: new Date(b.expiryDate + "T12:00:00"),
                })),
              }
            : undefined,
      },
      include: { batches: true },
    });
    res.json(serializeContact(row, row.batches));
  });

  router.get("/contact/:id/stock-movements", ...readAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const rows = await prisma.lensStockMovement.findMany({
      where: { contactLensId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { createdBy: { select: { name: true } } },
    });
    res.json({
      data: rows.map((m) => ({
        id: m.id,
        movementType: m.movementType,
        quantity: m.quantity,
        stockChange: m.stockChange,
        reason: m.reason,
        reference: m.reference,
        createdAt: m.createdAt.toISOString(),
        doneByName: m.createdBy?.name ?? null,
      })),
    });
  });

  router.post("/contact/:id/stock-movement", ...writeAuth, async (req: AuthedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = stockAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const uid = req.user?.sub ?? null;
    const result = await applyContactStock(id, parsed.data, uid);
    if (result && "error" in result && result.error === "NOT_FOUND") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (result && "error" in result && result.error === "NEGATIVE") {
      res.status(400).json({ error: "Stock cannot go negative", currentStock: result.current });
      return;
    }
    if (!result || !("lens" in result)) {
      res.status(500).json({ error: "Unexpected" });
      return;
    }
    const f = result.lens;
    const full = await prisma.contactLens.findUnique({ where: { id: f.id }, include: { batches: true } });
    const belowReorder = f.stockQty > 0 && f.stockQty <= f.reorderLevel;
    res.status(201).json({ lens: full ? serializeContact(full, full.batches) : null, belowReorder });
  });

  app.use("/api/lenses", router);
}
