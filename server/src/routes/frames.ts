import type { Express } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { paiseToRupeesString, parseRupeesInput } from "../lib/moneyInr.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const writeAuth = [authenticate, requireRoles("admin", "staff")];

export const FRAME_TYPES = ["Full Rim", "Half Rim", "Rimless", "Sports", "Kids"] as const;
export const FRAME_MATERIALS = ["Metal", "TR90", "Acetate", "Titanium", "Stainless Steel", "Mixed"] as const;
export const FRAME_GENDERS = ["Men", "Women", "Unisex", "Kids"] as const;

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

function frameStatus(stockQty: number, reorderLevel: number): "in_stock" | "low_stock" | "out_of_stock" {
  if (stockQty <= 0) return "out_of_stock";
  if (stockQty <= reorderLevel) return "low_stock";
  return "in_stock";
}

async function suggestNextSku(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.frame.findMany({ select: { sku: true } });
  let max = 0;
  for (const r of rows) {
    const m = /^FRM-(\d{1,6})$/i.exec(r.sku.trim());
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `FRM-${String(max + 1).padStart(5, "0")}`;
}

function serializeFrame(f: {
  id: number;
  sku: string;
  brand: string;
  modelName: string;
  color: string;
  size: string;
  frameType: string;
  material: string;
  gender: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
  reorderLevel: number;
  supplierName: string | null;
  supplierContact: string | null;
  barcode: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
}) {
  return {
    id: f.id,
    sku: f.sku,
    brand: f.brand,
    modelName: f.modelName,
    color: f.color,
    size: f.size,
    frameType: f.frameType,
    material: f.material,
    gender: f.gender,
    purchasePrice: f.purchasePrice,
    sellingPrice: f.sellingPrice,
    stockQty: f.stockQty,
    reorderLevel: f.reorderLevel,
    supplierName: f.supplierName,
    supplierContact: f.supplierContact,
    barcode: f.barcode,
    notes: f.notes,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    createdById: f.createdById,
    status: frameStatus(f.stockQty, f.reorderLevel),
  };
}

const frameBodySchema = z.object({
  sku: z.string().min(1).max(80),
  brand: z.string().min(1).max(200),
  modelName: z.string().min(1).max(200),
  color: z.string().min(1).max(120),
  size: z.string().min(1).max(80),
  frameType: z.enum(FRAME_TYPES),
  material: z.enum(FRAME_MATERIALS),
  gender: z.enum(FRAME_GENDERS),
  purchasePrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  stockQty: z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
  supplierName: z.string().max(200).optional().nullable(),
  supplierContact: z.string().max(200).optional().nullable(),
  barcode: z.string().max(120).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export function mountFrames(app: Express): void {
  const router = Router();

  router.get("/stats/low-stock-count", ...readAuth, async (_req, res) => {
    const frames = await prisma.frame.findMany({ select: { stockQty: true, reorderLevel: true } });
    const n = frames.filter((f) => f.stockQty > 0 && f.stockQty <= f.reorderLevel).length;
    res.json({ count: n });
  });

  router.get("/brands", ...readAuth, async (_req, res) => {
    const rows = await prisma.frame.findMany({
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    });
    res.json({ brands: rows.map((r) => r.brand) });
  });

  router.get("/suggest-sku", ...readAuth, async (_req, res) => {
    const sku = await prisma.$transaction((tx) => suggestNextSku(tx));
    res.json({ sku });
  });

  router.get("/export", ...readAuth, async (req, res) => {
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const where: Prisma.FrameWhereInput = {};
    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        { brand: { contains: s } },
        { modelName: { contains: s } },
        { sku: { contains: s } },
        { color: { contains: s } },
      ];
    }
    const rows = await prisma.frame.findMany({ where, orderBy: { sku: "asc" } });
    const header = [
      "sku",
      "brand",
      "model",
      "color",
      "size",
      "frame_type",
      "material",
      "gender",
      "purchase_price_inr",
      "selling_price_inr",
      "stock_qty",
      "reorder_level",
      "supplier_name",
      "supplier_contact",
      "barcode",
      "notes",
    ];
    const lines = [header.join(",")];
    for (const f of rows) {
      const line = [
        escapeCsvCell(f.sku),
        escapeCsvCell(f.brand),
        escapeCsvCell(f.modelName),
        escapeCsvCell(f.color),
        escapeCsvCell(f.size),
        escapeCsvCell(f.frameType),
        escapeCsvCell(f.material),
        escapeCsvCell(f.gender),
        escapeCsvCell(paiseToRupeesString(f.purchasePrice)),
        escapeCsvCell(paiseToRupeesString(f.sellingPrice)),
        String(f.stockQty),
        String(f.reorderLevel),
        escapeCsvCell(f.supplierName ?? ""),
        escapeCsvCell(f.supplierContact ?? ""),
        escapeCsvCell(f.barcode ?? ""),
        escapeCsvCell(f.notes ?? ""),
      ];
      lines.push(line.join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="frames-export.csv"');
    res.send(lines.join("\n"));
  });

  router.post("/import/preview", ...writeAuth, async (req, res) => {
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
    const expected = [
      "sku",
      "brand",
      "model",
      "color",
      "size",
      "frame_type",
      "material",
      "gender",
      "purchase_price_inr",
      "selling_price_inr",
      "stock_qty",
      "reorder_level",
      "supplier_name",
      "supplier_contact",
      "barcode",
      "notes",
    ];
    const idx = (name: string) => header.indexOf(name);
    if (expected.some((e) => idx(e) < 0)) {
      res.status(400).json({
        error:
          "CSV must include headers: " + expected.join(", "),
      });
      return;
    }

    const existingSkus = new Set((await prisma.frame.findMany({ select: { sku: true } })).map((x) => x.sku.toLowerCase()));
    const seenInFile = new Set<string>();

    type PreviewRow = {
      line: number;
      valid: boolean;
      errors: string[];
      payload: z.infer<typeof frameBodySchema> | null;
      duplicateInDb: boolean;
      duplicateInFile: boolean;
    };
    const out: PreviewRow[] = [];

    for (let r = 1; r < table.length; r++) {
      const lineNum = r + 1;
      const row = table[r]!;
      const errors: string[] = [];
      const get = (k: string) => {
        const i = idx(k);
        return i >= 0 && i < row.length ? row[i]!.trim() : "";
      };

      const sku = get("sku");
      const brand = get("brand");
      const modelName = get("model");
      const color = get("color");
      const size = get("size");
      const frameType = get("frame_type");
      const material = get("material");
      const gender = get("gender");
      const pp = parseRupeesInput(get("purchase_price_inr"));
      const sp = parseRupeesInput(get("selling_price_inr"));
      const stockQty = parseInt(get("stock_qty"), 10);
      const reorderLevel = parseInt(get("reorder_level"), 10);

      if (!sku) errors.push("SKU required");
      if (sku && existingSkus.has(sku.toLowerCase())) {
        // duplicate — will skip on import
      }
      if (!brand) errors.push("brand required");
      if (!modelName) errors.push("model required");
      if (!color) errors.push("color required");
      if (!size) errors.push("size required");
      if (!FRAME_TYPES.includes(frameType as (typeof FRAME_TYPES)[number]))
        errors.push(`frame_type must be one of: ${FRAME_TYPES.join(", ")}`);
      if (!FRAME_MATERIALS.includes(material as (typeof FRAME_MATERIALS)[number]))
        errors.push(`material must be one of: ${FRAME_MATERIALS.join(", ")}`);
      if (!FRAME_GENDERS.includes(gender as (typeof FRAME_GENDERS)[number]))
        errors.push(`gender must be one of: ${FRAME_GENDERS.join(", ")}`);
      if (pp === null) errors.push("purchase_price_inr invalid");
      if (sp === null) errors.push("selling_price_inr invalid");
      if (Number.isNaN(stockQty) || stockQty < 0) errors.push("stock_qty must be non-negative integer");
      if (Number.isNaN(reorderLevel) || reorderLevel < 0) errors.push("reorder_level must be non-negative integer");

      const duplicateInDb = Boolean(sku && existingSkus.has(sku.toLowerCase()));
      const duplicateInFile = Boolean(sku && seenInFile.has(sku.toLowerCase()));
      if (sku && !duplicateInFile) seenInFile.add(sku.toLowerCase());

      let payload: z.infer<typeof frameBodySchema> | null = null;
      if (
        sku &&
        brand &&
        modelName &&
        color &&
        size &&
        FRAME_TYPES.includes(frameType as (typeof FRAME_TYPES)[number]) &&
        FRAME_MATERIALS.includes(material as (typeof FRAME_MATERIALS)[number]) &&
        FRAME_GENDERS.includes(gender as (typeof FRAME_GENDERS)[number]) &&
        pp !== null &&
        sp !== null &&
        !Number.isNaN(stockQty) &&
        stockQty >= 0 &&
        !Number.isNaN(reorderLevel) &&
        reorderLevel >= 0
      ) {
        const parsed = frameBodySchema.safeParse({
          sku,
          brand,
          modelName,
          color,
          size,
          frameType,
          material,
          gender,
          purchasePrice: pp,
          sellingPrice: sp,
          stockQty,
          reorderLevel,
          supplierName: get("supplier_name") || null,
          supplierContact: get("supplier_contact") || null,
          barcode: get("barcode") || null,
          notes: get("notes") || null,
        });
        if (!parsed.success) {
          errors.push(...parsed.error.issues.map((i) => i.message));
        } else {
          payload = parsed.data;
        }
      }

      if (duplicateInFile && sku) errors.push("Duplicate SKU in this file (will skip)");
      const valid = Boolean(payload && errors.length === 0 && !duplicateInDb && !duplicateInFile);
      if (payload && duplicateInDb) errors.push("SKU already exists in database (will skip)");

      out.push({
        line: lineNum,
        valid,
        errors,
        payload: valid ? payload : null,
        duplicateInDb,
        duplicateInFile,
      });
    }

    const valid = out.filter((x) => x.valid).length;
    res.json({
      rows: out,
      summary: { total: out.length, valid, invalid: out.length - valid },
    });
  });

  router.post("/import/confirm", ...writeAuth, async (req: AuthedRequest, res) => {
    const body = z.object({ payloads: z.array(frameBodySchema) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const uid = req.user?.sub ?? null;
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of body.data.payloads) {
      try {
        await prisma.frame.create({
          data: {
            ...p,
            supplierName: p.supplierName ?? null,
            supplierContact: p.supplierContact ?? null,
            barcode: p.barcode ?? null,
            notes: p.notes ?? null,
            createdById: uid,
          },
        });
        imported++;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          skipped++;
          errors.push(`SKU ${p.sku} duplicate`);
        } else throw e;
      }
    }

    res.json({ imported, skipped, errors });
  });

  router.get("/", ...readAuth, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const search = typeof req.query.q === "string" ? req.query.q : undefined;
    const frameType = typeof req.query.frameType === "string" ? req.query.frameType : undefined;
    const material = typeof req.query.material === "string" ? req.query.material : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "brand";
    const order = req.query.order === "desc" ? "desc" : "asc";

    const and: Prisma.FrameWhereInput[] = [];
    if (search && search.trim()) {
      const s = search.trim();
      and.push({
        OR: [
          { brand: { contains: s } },
          { modelName: { contains: s } },
          { sku: { contains: s } },
          { color: { contains: s } },
        ],
      });
    }
    if (frameType && frameType !== "all") and.push({ frameType });
    if (material && material !== "all") and.push({ material });

    if (status === "out_of_stock") and.push({ stockQty: 0 });

    let orderBy: Prisma.FrameOrderByWithRelationInput = { brand: order };
    if (sort === "stock") orderBy = { stockQty: order };
    else if (sort === "purchase_price") orderBy = { purchasePrice: order };
    else if (sort === "selling_price") orderBy = { sellingPrice: order };
    else orderBy = { brand: order };

    const baseWhere: Prisma.FrameWhereInput = and.length ? { AND: and } : {};

    if (status === "low_stock") {
      const all = await prisma.frame.findMany({
        where: baseWhere,
        orderBy,
      });
      const filtered = all.filter((f) => f.stockQty > 0 && f.stockQty <= f.reorderLevel);
      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const skip = (safePage - 1) * limit;
      const slice = filtered.slice(skip, skip + limit);
      res.json({
        data: slice.map(serializeFrame),
        total,
        page: safePage,
        pages,
        limit,
      });
      return;
    }

    if (status === "in_stock") {
      const all = await prisma.frame.findMany({ where: baseWhere, orderBy });
      const filtered = all.filter((f) => frameStatus(f.stockQty, f.reorderLevel) === "in_stock");
      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const safePage = Math.min(page, pages);
      const skip = (safePage - 1) * limit;
      const slice = filtered.slice(skip, skip + limit);
      res.json({
        data: slice.map(serializeFrame),
        total,
        page: safePage,
        pages,
        limit,
      });
      return;
    }

    const where = baseWhere;
    const total = await prisma.frame.count({ where });
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const skip = (safePage - 1) * limit;

    const rows = await prisma.frame.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    });

    res.json({
      data: rows.map(serializeFrame),
      total,
      page: safePage,
      pages,
      limit,
    });
  });

  router.post("/", ...writeAuth, async (req: AuthedRequest, res) => {
    const parsed = frameBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const uid = req.user?.sub ?? null;
    try {
      const row = await prisma.frame.create({
        data: {
          ...parsed.data,
          supplierName: parsed.data.supplierName ?? null,
          supplierContact: parsed.data.supplierContact ?? null,
          barcode: parsed.data.barcode ?? null,
          notes: parsed.data.notes ?? null,
          createdById: uid,
        },
      });
      res.status(201).json(serializeFrame(row));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({ error: "SKU already exists" });
        return;
      }
      throw e;
    }
  });

  router.get("/:id", ...readAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const row = await prisma.frame.findUnique({ where: { id } });
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(serializeFrame(row));
  });

  router.put("/:id", ...writeAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = frameBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const row = await prisma.frame.update({
        where: { id },
        data: {
          ...parsed.data,
          supplierName: parsed.data.supplierName ?? null,
          supplierContact: parsed.data.supplierContact ?? null,
          barcode: parsed.data.barcode ?? null,
          notes: parsed.data.notes ?? null,
        },
      });
      res.json(serializeFrame(row));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        res.status(409).json({ error: "SKU already exists" });
        return;
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw e;
    }
  });

  router.get("/:id/stock-movements", ...readAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const total = await prisma.stockMovement.count({ where: { frameId: id } });
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const skip = (safePage - 1) * limit;
    const rows = await prisma.stockMovement.findMany({
      where: { frameId: id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { createdBy: { select: { name: true } } },
    });
    res.json({
      data: rows.map((m) => ({
        id: m.id,
        frameId: m.frameId,
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

  const stockAdjustSchema = z.object({
    movementType: z.enum(MOVEMENT_TYPES),
    quantity: z.number().int().min(1),
    reason: z.string().min(1).max(2000),
    reference: z.string().max(200).optional().nullable(),
    correctionDirection: z.enum(["add", "subtract"]).optional(),
  });

  router.post("/:id/stock-movement", ...writeAuth, async (req: AuthedRequest, res) => {
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
    const { movementType, quantity, reason, reference } = parsed.data;
    let stockChange = 0;
    if (movementType === "stock_in" || movementType === "return") stockChange = quantity;
    else if (movementType === "stock_out" || movementType === "damage") stockChange = -quantity;
    else {
      const dir = parsed.data.correctionDirection ?? "add";
      stockChange = dir === "add" ? quantity : -quantity;
    }

    const uid = req.user?.sub ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const frame = await tx.frame.findUnique({ where: { id } });
      if (!frame) return { error: "NOT_FOUND" as const };
      const newQty = frame.stockQty + stockChange;
      if (newQty < 0) return { error: "NEGATIVE_STOCK" as const, current: frame.stockQty };
      const updated = await tx.frame.update({
        where: { id },
        data: { stockQty: newQty },
      });
      const mov = await tx.stockMovement.create({
        data: {
          frameId: id,
          movementType,
          quantity,
          stockChange,
          reason,
          reference: reference ?? null,
          createdById: uid,
        },
      });
      return { frame: updated, mov };
    });

    if (result.error === "NOT_FOUND") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (result.error === "NEGATIVE_STOCK") {
      res.status(400).json({ error: "Stock cannot go negative", currentStock: result.current });
      return;
    }

    const f = result.frame;
    const low =
      f.stockQty > 0 && f.stockQty <= f.reorderLevel ? { belowReorder: true as const } : { belowReorder: false as const };

    res.status(201).json({
      frame: serializeFrame(f),
      movement: {
        id: result.mov.id,
        movementType: result.mov.movementType,
        quantity: result.mov.quantity,
        stockChange: result.mov.stockChange,
        reason: result.mov.reason,
        reference: result.mov.reference,
        createdAt: result.mov.createdAt.toISOString(),
      },
      ...low,
    });
  });

  app.use("/api/frames", router);
}
