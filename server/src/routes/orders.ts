import type { Express } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { DISCOUNT_MODES, PAYMENT_MODES, STATUS_TRANSITIONS } from "../lib/orderConstants.js";
import { deductInventoryForOrder, parseSnapshot, restoreInventoryFromSnapshot } from "../lib/orderStock.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];
const writeAuth = [authenticate, requireRoles("admin", "staff")];

const itemTypeEnum = z.enum(["frame", "spectacle_lens", "contact_lens", "service"]);

const orderItemIn = z.object({
  itemType: itemTypeEnum,
  itemId: z.number().int().positive().optional().nullable(),
  description: z.string().min(1).max(2000),
  qty: z.number().int().min(1).max(9999),
  unitPricePaise: z.number().int().min(0),
});

const paymentIn = z.object({
  amountPaise: z.number().int().min(1),
  paymentMode: z.enum(PAYMENT_MODES),
  reference: z.string().max(200).optional().nullable(),
});

const createOrderSchema = z.object({
  patientId: z.number().int().positive(),
  prescriptionId: z.number().int().positive().optional().nullable(),
  noRxOnFile: z.boolean().optional(),
  doctorName: z.string().max(200).optional().nullable(),
  items: z.array(orderItemIn).min(1),
  discountMode: z.enum(DISCOUNT_MODES),
  discountFlatPaise: z.number().int().min(0).optional(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  gstPercent: z.number().int().min(0).max(100),
  deliveryDate: z
    .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .nullable(),
  orderNotes: z.string().max(5000).optional().nullable(),
  labInstructions: z.string().max(5000).optional().nullable(),
  payments: z.array(paymentIn).default([]),
});

function computeTotals(
  items: { amountPaise: number }[],
  discountMode: string,
  discountFlatPaise: number,
  discountPercent: number,
  gstPercent: number,
) {
  const subtotalPaise = items.reduce((s, i) => s + i.amountPaise, 0);
  let taxablePaise = subtotalPaise;
  if (discountMode === "flat") {
    taxablePaise = Math.max(0, subtotalPaise - discountFlatPaise);
  } else if (discountMode === "percent") {
    const d = Math.floor((subtotalPaise * discountPercent) / 100);
    taxablePaise = Math.max(0, subtotalPaise - d);
  }
  const gstAmountPaise = Math.floor((taxablePaise * gstPercent) / 100);
  const totalPaise = taxablePaise + gstAmountPaise;
  return { subtotalPaise, taxablePaise, gstAmountPaise, totalPaise };
}

async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ymd = `${y}${m}${d}`;
  const prefix = `ORD-${ymd}-`;
  const last = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  let next = 1;
  if (last?.orderNumber) {
    const suf = last.orderNumber.slice(-4);
    const n = parseInt(suf, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function patientFullName(p: { firstName: string; middleName: string | null; lastName: string }): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

function serializeOrderListRow(o: {
  id: number;
  orderNumber: string;
  status: string;
  totalPaise: number;
  deliveryDate: Date | null;
  createdAt: Date;
  patient: { firstName: string; middleName: string | null; lastName: string; phone1: string };
  items: { description: string; qty: number }[];
  payments: { amountPaise: number }[];
}) {
  const paid = o.payments.reduce((s, p) => s + p.amountPaise, 0);
  const balance = o.totalPaise - paid;
  const summary =
    o.items.length === 0
      ? "—"
      : o.items
          .slice(0, 3)
          .map((i) => `${i.description}×${i.qty}`)
          .join(", ") + (o.items.length > 3 ? "…" : "");
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    patientName: patientFullName(o.patient),
    patientPhone: o.patient.phone1,
    createdAt: o.createdAt.toISOString(),
    itemsSummary: summary,
    totalPaise: o.totalPaise,
    advancePaise: paid,
    balancePaise: balance,
    status: o.status,
    deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : null,
  };
}

function parseWarning(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? (p as string[]) : null;
  } catch {
    return null;
  }
}

export function mountOrders(app: Express): void {
  const router = Router();

  router.get("/doctors", ...readAuth, async (_req, res) => {
    const rows = await prisma.order.findMany({
      where: { doctorName: { not: null } },
      distinct: ["doctorName"],
      select: { doctorName: true },
    });
    const names = rows.map((r) => r.doctorName).filter((x): x is string => !!x?.trim());
    res.json({ doctors: [...new Set(names)].sort() });
  });

  router.get("/", ...readAuth, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const doctor = typeof req.query.doctor === "string" ? req.query.doctor.trim() : "";
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : "";
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : "";
    const balanceDue = typeof req.query.balanceDue === "string" ? req.query.balanceDue : "";
    const statusScope = typeof req.query.statusScope === "string" ? req.query.statusScope.trim() : "";

    let balanceIds: number[] | undefined;
    if (balanceDue === "yes" || balanceDue === "no") {
      const wantPositive = balanceDue === "yes";
      const op = wantPositive ? Prisma.sql`> 0` : Prisma.sql`<= 0`;
      const rows = await prisma.$queryRaw<{ id: number }[]>`
        SELECT o.id FROM orders o
        WHERE (o.total_paise - COALESCE((SELECT SUM(amount_paise) FROM order_payments p WHERE p.order_id = o.id), 0)) ${op}
      `;
      balanceIds = rows.map((r) => r.id);
      if (balanceIds.length === 0) {
        res.json({ data: [], total: 0, page: 1, pages: 1, limit });
        return;
      }
    }

    const where: Prisma.OrderWhereInput = {};
    if (statusScope === "open") {
      where.status = { notIn: ["delivered", "cancelled"] };
    } else if (status && status !== "all") {
      where.status = status;
    }
    if (doctor) where.doctorName = { contains: doctor };
    const createdFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) createdFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      createdFilter.lte = end;
    }
    if (Object.keys(createdFilter).length) where.createdAt = createdFilter;
    if (balanceIds) where.id = { in: balanceIds };

    if (q) {
      const digits = q.replace(/\D/g, "");
      where.OR = [
        { orderNumber: { contains: q } },
        { patient: { patientCode: { contains: q } } },
        { patient: { firstName: { contains: q } } },
        { patient: { lastName: { contains: q } } },
        ...(digits.length >= 3 ? [{ patient: { phone1: { contains: digits } } }] : []),
      ];
    }

    const total = await prisma.order.count({ where });
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const skip = (safePage - 1) * limit;

    const rows = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true, phone1: true } },
        items: { select: { description: true, qty: true } },
        payments: { select: { amountPaise: true } },
      },
    });

    res.json({
      data: rows.map(serializeOrderListRow),
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
    const o = await prisma.order.findFirst({
      where: { id },
      include: {
        patient: true,
        prescription: true,
        items: { orderBy: { id: "asc" } },
        payments: { include: { collectedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        statusLogs: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        createdBy: { select: { name: true } },
      },
    });
    if (!o) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const paid = o.payments.reduce((s, p) => s + p.amountPaise, 0);
    res.json({
      ...serializeOrderDetail(o),
      balancePaise: o.totalPaise - paid,
      paidPaise: paid,
    });
  });

  router.post("/", ...writeAuth, async (req: AuthedRequest, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const noRx = body.noRxOnFile === true;
    if (!noRx && !body.prescriptionId) {
      res.status(400).json({ error: "Select a prescription or mark no Rx on file" });
      return;
    }
    if (noRx && body.prescriptionId) {
      res.status(400).json({ error: "Cannot set prescription when no Rx on file" });
      return;
    }

    const patient = await prisma.patient.findFirst({ where: { id: body.patientId, isDeleted: false } });
    if (!patient) {
      res.status(400).json({ error: "Patient not found" });
      return;
    }

    if (body.prescriptionId) {
      const rx = await prisma.prescription.findFirst({
        where: { id: body.prescriptionId, patientId: body.patientId, isDeleted: false },
      });
      if (!rx) {
        res.status(400).json({ error: "Prescription not found for this patient" });
        return;
      }
    }

    const itemsWithAmounts = body.items.map((it) => ({
      ...it,
      amountPaise: it.qty * it.unitPricePaise,
    }));

    const discountFlat = body.discountFlatPaise ?? 0;
    const discountPct = body.discountPercent ?? 0;
    const { subtotalPaise, taxablePaise, gstAmountPaise, totalPaise } = computeTotals(
      itemsWithAmounts,
      body.discountMode,
      discountFlat,
      discountPct,
      body.gstPercent,
    );

    const uid = req.user?.sub ?? null;
    const delivery = body.deliveryDate ? new Date(body.deliveryDate) : null;

    try {
      const order = await prisma.$transaction(async (tx) => {
        const orderNumber = await nextOrderNumber(tx);
        const doctorName =
          body.doctorName?.trim() ||
          (body.prescriptionId
            ? (
                await tx.prescription.findUnique({
                  where: { id: body.prescriptionId! },
                  select: { doctorName: true },
                })
              )?.doctorName
            : null);

        const o = await tx.order.create({
          data: {
            orderNumber,
            patientId: body.patientId,
            prescriptionId: body.prescriptionId ?? null,
            noRxOnFile: noRx,
            doctorName,
            status: "pending",
            subtotalPaise,
            discountMode: body.discountMode,
            discountFlatPaise: discountFlat,
            discountPercent: discountPct,
            taxablePaise,
            gstPercent: body.gstPercent,
            gstAmountPaise,
            totalPaise,
            deliveryDate: delivery,
            orderNotes: body.orderNotes ?? null,
            labInstructions: body.labInstructions ?? null,
            createdById: uid,
          },
        });

        for (const it of itemsWithAmounts) {
          await tx.orderItem.create({
            data: {
              orderId: o.id,
              itemType: it.itemType,
              itemId: it.itemId ?? null,
              description: it.description,
              qty: it.qty,
              unitPricePaise: it.unitPricePaise,
              amountPaise: it.amountPaise,
            },
          });
        }

        for (const p of body.payments) {
          await tx.orderPayment.create({
            data: {
              orderId: o.id,
              amountPaise: p.amountPaise,
              paymentMode: p.paymentMode,
              reference: p.reference ?? null,
              collectedById: uid,
            },
          });
        }

        await tx.orderStatusLog.create({
          data: {
            orderId: o.id,
            fromStatus: null,
            toStatus: "pending",
            note: "Order created",
            changedById: uid,
          },
        });

        return o;
      });

      const full = await prisma.order.findFirst({
        where: { id: order.id },
        include: {
          patient: true,
          prescription: true,
          items: true,
          payments: { include: { collectedBy: { select: { name: true } } } },
          statusLogs: { include: { changedBy: { select: { name: true } } } },
          createdBy: { select: { name: true } },
        },
      });
      if (!full) {
        res.status(500).json({ error: "Order not found after create" });
        return;
      }
      const paid = full.payments.reduce((s, p) => s + p.amountPaise, 0);
      res.status(201).json({
        ...serializeOrderDetail(full),
        balancePaise: full.totalPaise - paid,
        paidPaise: paid,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  const patchOrderSchema = z.object({
    deliveryDate: z
      .union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
      .optional()
      .nullable(),
    orderNotes: z.string().max(5000).optional().nullable(),
    labInstructions: z.string().max(5000).optional().nullable(),
  });

  router.patch("/:id", ...writeAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = patchOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const o = await prisma.order.update({
      where: { id },
      data: {
        deliveryDate: parsed.data.deliveryDate === undefined ? undefined : parsed.data.deliveryDate ? new Date(parsed.data.deliveryDate) : null,
        orderNotes: parsed.data.orderNotes,
        labInstructions: parsed.data.labInstructions,
      },
    });
    res.json({ id: o.id, updated: true });
  });

  const statusSchema = z.object({
    toStatus: z.string().min(1),
    note: z.string().max(2000).optional().nullable(),
  });

  router.post("/:id/status", ...writeAuth, async (req: AuthedRequest, res) => {
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
    const { toStatus, note } = parsed.data;
    const uid = req.user?.sub ?? null;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (order.status === toStatus) {
      res.status(400).json({ error: "Already in this status" });
      return;
    }
    const allowed = STATUS_TRANSITIONS[order.status];
    if (!allowed?.includes(toStatus)) {
      res.status(400).json({ error: `Cannot go from ${order.status} to ${toStatus}` });
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (toStatus === "cancelled" && order.stockDeducted) {
        const snap = parseSnapshot(order.deductionSnapshot);
        if (snap && (snap.frames.length || snap.spectacles.length || snap.contacts.length)) {
          await restoreInventoryFromSnapshot(tx, {
            orderNumber: order.orderNumber,
            snapshot: snap,
            userId: uid,
          });
        }
        await tx.order.update({
          where: { id },
          data: { stockDeducted: false, deductionSnapshot: null, stockWarning: null },
        });
      }

      if (toStatus === "sent_to_lab" && !order.stockDeducted) {
        const fresh = await tx.order.findUnique({ where: { id }, include: { items: true } });
        if (!fresh) throw new Error("missing order");
        const { snapshot, warnings } = await deductInventoryForOrder(tx, {
          orderNumber: fresh.orderNumber,
          items: fresh.items.map((i) => ({
            itemType: i.itemType,
            itemId: i.itemId,
            qty: i.qty,
          })),
          userId: uid,
        });
        await tx.order.update({
          where: { id },
          data: {
            stockDeducted: true,
            deductionSnapshot: JSON.stringify(snapshot),
            stockWarning: warnings.length ? JSON.stringify(warnings) : null,
          },
        });
      }

      await tx.order.update({
        where: { id },
        data: { status: toStatus },
      });

      await tx.orderStatusLog.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus,
          note: note ?? null,
          changedById: uid,
        },
      });
    });

    const full = await prisma.order.findFirst({
      where: { id },
      include: {
        patient: true,
        prescription: true,
        items: true,
        payments: { include: { collectedBy: { select: { name: true } } } },
        statusLogs: { include: { changedBy: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    });
    if (!full) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const paidAfter = full.payments.reduce((s, p) => s + p.amountPaise, 0);
    res.json({
      ...serializeOrderDetail(full),
      balancePaise: full.totalPaise - paidAfter,
      paidPaise: paidAfter,
    });
  });

  const paySchema = z.object({
    amountPaise: z.number().int().min(1),
    paymentMode: z.enum(PAYMENT_MODES),
    reference: z.string().max(200).optional().nullable(),
  });

  router.post("/:id/payments", ...writeAuth, async (req: AuthedRequest, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = paySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (order.status === "cancelled") {
      res.status(400).json({ error: "Cannot collect payment on cancelled order" });
      return;
    }
    const uid = req.user?.sub ?? null;
    await prisma.orderPayment.create({
      data: {
        orderId: id,
        amountPaise: parsed.data.amountPaise,
        paymentMode: parsed.data.paymentMode,
        reference: parsed.data.reference ?? null,
        collectedById: uid,
      },
    });
    const payments = await prisma.orderPayment.findMany({
      where: { orderId: id },
      include: { collectedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    const paid = payments.reduce((s, p) => s + p.amountPaise, 0);
    res.status(201).json({
      payments: payments.map(serializePayment),
      paidPaise: paid,
      balancePaise: order.totalPaise - paid,
    });
  });

  app.use("/api/orders", router);
}

function serializePayment(p: {
  id: number;
  amountPaise: number;
  paymentMode: string;
  reference: string | null;
  createdAt: Date;
  collectedBy: { name: string } | null;
}) {
  return {
    id: p.id,
    amountPaise: p.amountPaise,
    paymentMode: p.paymentMode,
    reference: p.reference,
    createdAt: p.createdAt.toISOString(),
    collectedByName: p.collectedBy?.name ?? null,
  };
}

function serializeOrderDetail(o: {
  id: number;
  orderNumber: string;
  patientId: number;
  prescriptionId: number | null;
  noRxOnFile: boolean;
  doctorName: string | null;
  status: string;
  subtotalPaise: number;
  discountMode: string;
  discountFlatPaise: number;
  discountPercent: number;
  taxablePaise: number;
  gstPercent: number;
  gstAmountPaise: number;
  totalPaise: number;
  deliveryDate: Date | null;
  orderNotes: string | null;
  labInstructions: string | null;
  stockDeducted: boolean;
  stockWarning: string | null;
  createdAt: Date;
  patient: {
    id: number;
    patientCode: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    phone1: string;
    address: string | null;
    city: string | null;
    province: string | null;
    district: string | null;
    postalCode: string | null;
  };
  prescription: {
    id: number;
    rxNumber: string;
    dvReSph: number;
    dvReCyl: number;
    dvReAxis: number | null;
    dvLeSph: number;
    dvLeCyl: number;
    dvLeAxis: number | null;
  } | null;
  items: {
    id: number;
    itemType: string;
    itemId: number | null;
    description: string;
    qty: number;
    unitPricePaise: number;
    amountPaise: number;
  }[];
  payments: {
    id: number;
    amountPaise: number;
    paymentMode: string;
    reference: string | null;
    createdAt: Date;
    collectedBy: { name: string } | null;
  }[];
  statusLogs: {
    id: number;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: Date;
    changedBy: { name: string } | null;
  }[];
  createdBy: { name: string } | null;
}) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    patientId: o.patientId,
    prescriptionId: o.prescriptionId,
    noRxOnFile: o.noRxOnFile,
    doctorName: o.doctorName,
    status: o.status,
    subtotalPaise: o.subtotalPaise,
    discountMode: o.discountMode,
    discountFlatPaise: o.discountFlatPaise,
    discountPercent: o.discountPercent,
    taxablePaise: o.taxablePaise,
    gstPercent: o.gstPercent,
    gstAmountPaise: o.gstAmountPaise,
    totalPaise: o.totalPaise,
    deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : null,
    orderNotes: o.orderNotes,
    labInstructions: o.labInstructions,
    stockDeducted: o.stockDeducted,
    stockWarning: parseWarning(o.stockWarning),
    createdAt: o.createdAt.toISOString(),
    patient: {
      id: o.patient.id,
      patientCode: o.patient.patientCode,
      fullName: patientFullName(o.patient),
      phone1: o.patient.phone1,
      address: o.patient.address,
      city: o.patient.city,
      province: o.patient.province,
      district: o.patient.district,
      postalCode: o.patient.postalCode,
    },
    prescription: o.prescription
      ? {
          id: o.prescription.id,
          rxNumber: o.prescription.rxNumber,
          dvReSph: o.prescription.dvReSph,
          dvReCyl: o.prescription.dvReCyl,
          dvReAxis: o.prescription.dvReAxis,
          dvLeSph: o.prescription.dvLeSph,
          dvLeCyl: o.prescription.dvLeCyl,
          dvLeAxis: o.prescription.dvLeAxis,
        }
      : null,
    items: o.items.map((i) => ({
      id: i.id,
      itemType: i.itemType,
      itemId: i.itemId,
      description: i.description,
      qty: i.qty,
      unitPricePaise: i.unitPricePaise,
      amountPaise: i.amountPaise,
    })),
    payments: o.payments.map(serializePayment),
    statusLogs: o.statusLogs.map((l) => ({
      id: l.id,
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      note: l.note,
      createdAt: l.createdAt.toISOString(),
      changedByName: l.changedBy?.name ?? null,
    })),
    createdByName: o.createdBy?.name ?? null,
  };
}
