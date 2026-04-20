import type { Express } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];

function startOfDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function endOfDayFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(23, 59, 59, 999);
  return dt;
}

function patientFullName(p: { firstName: string; middleName: string | null; lastName: string }): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

function opticalDec(v: number): string {
  return (v / 100).toFixed(2);
}

export function mountReports(app: Express): void {
  const router = Router();

  router.get("/patient-registration", ...readAuth, async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
      return;
    }
    const gte = startOfDayFromYmd(from);
    const lte = endOfDayFromYmd(to);

    const rows = await prisma.patient.findMany({
      where: { isDeleted: false, createdAt: { gte, lte } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        patientCode: true,
        firstName: true,
        middleName: true,
        lastName: true,
        age: true,
        gender: true,
        phone1: true,
        referredBy: true,
        createdAt: true,
      },
    });

    res.json({
      data: rows.map((p) => ({
        regDate: p.createdAt.toISOString().slice(0, 10),
        patientId: p.patientCode,
        name: patientFullName(p),
        age: p.age ?? null,
        gender: p.gender,
        phone: p.phone1,
        referredBy: p.referredBy ?? "",
      })),
      summary: { total: rows.length },
    });
  });

  router.get("/prescriptions", ...readAuth, async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    const doctor = typeof req.query.doctor === "string" ? req.query.doctor.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
      return;
    }
    const gte = startOfDayFromYmd(from);
    const lte = endOfDayFromYmd(to);

    const where: Prisma.PrescriptionWhereInput = {
      isDeleted: false,
      rxDate: { gte, lte },
    };
    if (doctor) where.doctorName = { contains: doctor };

    const rows = await prisma.prescription.findMany({
      where,
      orderBy: { rxDate: "asc" },
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true } },
      },
    });

    res.json({
      data: rows.map((r) => ({
        rxNo: r.rxNumber,
        date: r.rxDate.toISOString().slice(0, 10),
        patient: patientFullName(r.patient),
        doctor: r.doctorName,
        reSph: opticalDec(r.dvReSph),
        reCyl: opticalDec(r.dvReCyl),
        leSph: opticalDec(r.dvLeSph),
        leCyl: opticalDec(r.dvLeCyl),
        lensType: r.lensType,
      })),
    });
  });

  router.get("/daily-sales", ...readAuth, async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
      return;
    }
    const gte = startOfDayFromYmd(from);
    const lte = endOfDayFromYmd(to);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte, lte }, status: { not: "cancelled" } },
      orderBy: { createdAt: "asc" },
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true } },
        items: { select: { description: true, qty: true } },
        payments: { select: { amountPaise: true, paymentMode: true } },
      },
    });

    let totalSales = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    const data = orders.map((o) => {
      const paid = o.payments.reduce((s, p) => s + p.amountPaise, 0);
      const balance = o.totalPaise - paid;
      const modes = [...new Set(o.payments.map((p) => p.paymentMode))].join(", ") || "—";
      const itemsSummary = o.items.map((i) => `${i.description}×${i.qty}`).join("; ") || "—";
      let discountPaise = 0;
      if (o.discountMode === "flat") discountPaise = o.discountFlatPaise;
      else if (o.discountMode === "percent") discountPaise = Math.floor((o.subtotalPaise * o.discountPercent) / 100);
      totalSales += o.totalPaise;
      totalCollected += paid;
      totalOutstanding += balance;
      return {
        orderNo: o.orderNumber,
        date: o.createdAt.toISOString().slice(0, 10),
        patient: patientFullName(o.patient),
        items: itemsSummary,
        subtotalPaise: o.subtotalPaise,
        discountPaise,
        gstPercent: o.gstPercent,
        gstAmountPaise: o.gstAmountPaise,
        totalPaise: o.totalPaise,
        advancePaise: paid,
        balancePaise: balance,
        paymentMode: modes,
      };
    });

    res.json({
      data,
      summary: {
        totalSalesPaise: totalSales,
        totalCollectedPaise: totalCollected,
        totalOutstandingPaise: totalOutstanding,
      },
    });
  });

  router.get("/monthly-revenue", ...readAuth, async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
      return;
    }
    const gte = startOfDayFromYmd(from);
    const lte = endOfDayFromYmd(to);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte, lte }, status: { not: "cancelled" } },
      select: {
        createdAt: true,
        subtotalPaise: true,
        discountMode: true,
        discountFlatPaise: true,
        discountPercent: true,
        gstAmountPaise: true,
        totalPaise: true,
        payments: { select: { amountPaise: true } },
      },
    });

    type Agg = {
      ym: string;
      orderCount: number;
      gross: number;
      discounts: number;
      gst: number;
      net: number;
      collected: number;
      outstanding: number;
    };
    const map = new Map<string, Agg>();

    for (const o of orders) {
      const ym = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, "0")}`;
      let disc = 0;
      if (o.discountMode === "flat") disc = o.discountFlatPaise;
      else if (o.discountMode === "percent") disc = Math.floor((o.subtotalPaise * o.discountPercent) / 100);
      const paid = o.payments.reduce((s, p) => s + p.amountPaise, 0);
      const bal = o.totalPaise - paid;
      const cur = map.get(ym) ?? {
        ym,
        orderCount: 0,
        gross: 0,
        discounts: 0,
        gst: 0,
        net: 0,
        collected: 0,
        outstanding: 0,
      };
      cur.orderCount += 1;
      cur.gross += o.subtotalPaise;
      cur.discounts += disc;
      cur.gst += o.gstAmountPaise;
      cur.net += o.totalPaise;
      cur.collected += paid;
      cur.outstanding += bal;
      map.set(ym, cur);
    }

    const data = [...map.values()].sort((a, b) => a.ym.localeCompare(b.ym));

    res.json({ data });
  });

  router.get("/inventory-valuation", ...readAuth, async (_req, res) => {
    const frames = await prisma.frame.findMany({
      select: {
        sku: true,
        brand: true,
        modelName: true,
        stockQty: true,
        purchasePrice: true,
        sellingPrice: true,
      },
      orderBy: { sku: "asc" },
    });
    const spec = await prisma.spectacleLens.findMany({
      select: {
        sku: true,
        brand: true,
        lensType: true,
        stockQty: true,
        purchasePrice: true,
        sellingPrice: true,
      },
      orderBy: { sku: "asc" },
    });
    const contact = await prisma.contactLens.findMany({
      select: {
        sku: true,
        brand: true,
        contactType: true,
        stockQty: true,
        purchasePrice: true,
        sellingPrice: true,
      },
      orderBy: { sku: "asc" },
    });

    const frameRows = frames.map((f) => {
      const value = f.stockQty * f.purchasePrice;
      return {
        sku: f.sku,
        brand: f.brand,
        model: f.modelName,
        stockQty: f.stockQty,
        purchasePricePaise: f.purchasePrice,
        sellingPricePaise: f.sellingPrice,
        stockValuePaise: value,
      };
    });
    const specRows = spec.map((f) => {
      const value = f.stockQty * f.purchasePrice;
      return {
        sku: f.sku,
        brand: f.brand,
        model: `${f.lensType}`,
        stockQty: f.stockQty,
        purchasePricePaise: f.purchasePrice,
        sellingPricePaise: f.sellingPrice,
        stockValuePaise: value,
      };
    });
    const contactRows = contact.map((f) => {
      const value = f.stockQty * f.purchasePrice;
      return {
        sku: f.sku,
        brand: f.brand,
        model: f.contactType,
        stockQty: f.stockQty,
        purchasePricePaise: f.purchasePrice,
        sellingPricePaise: f.sellingPrice,
        stockValuePaise: value,
      };
    });

    const totalFrames = frameRows.reduce((s, r) => s + r.stockValuePaise, 0);
    const totalSpec = specRows.reduce((s, r) => s + r.stockValuePaise, 0);
    const totalContact = contactRows.reduce((s, r) => s + r.stockValuePaise, 0);

    res.json({
      frames: frameRows,
      lenses: specRows,
      contactLenses: contactRows,
      totals: {
        framesPaise: totalFrames,
        lensesPaise: totalSpec,
        contactPaise: totalContact,
        grandPaise: totalFrames + totalSpec + totalContact,
      },
    });
  });

  router.get("/stock-movement", ...readAuth, async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";
    const itemType = typeof req.query.itemType === "string" ? req.query.itemType : "all";
    const movementDir = typeof req.query.movementDir === "string" ? req.query.movementDir : "all";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
      return;
    }
    const gte = startOfDayFromYmd(from);
    const lte = endOfDayFromYmd(to);

    const dirWhere =
      movementDir === "in" ? { stockChange: { gt: 0 } } : movementDir === "out" ? { stockChange: { lt: 0 } } : {};

    const out: {
      date: string;
      itemType: string;
      sku: string;
      brand: string;
      movementType: string;
      qty: number;
      reason: string;
      reference: string;
      doneBy: string;
    }[] = [];

    if (itemType === "all" || itemType === "frame") {
      const mov = await prisma.stockMovement.findMany({
        where: {
          createdAt: { gte, lte },
          ...dirWhere,
        },
        include: {
          frame: { select: { sku: true, brand: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      for (const m of mov) {
        out.push({
          date: m.createdAt.toISOString(),
          itemType: "frame",
          sku: m.frame.sku,
          brand: m.frame.brand,
          movementType: m.movementType,
          qty: m.quantity,
          reason: m.reason,
          reference: m.reference ?? "",
          doneBy: m.createdBy?.name ?? "—",
        });
      }
    }

    if (itemType === "all" || itemType === "lens" || itemType === "contact") {
      const mov = await prisma.lensStockMovement.findMany({
        where: {
          createdAt: { gte, lte },
          ...dirWhere,
          ...(itemType === "lens"
            ? { spectacleLensId: { not: null } }
            : itemType === "contact"
              ? { contactLensId: { not: null } }
              : {}),
        },
        include: {
          spectacleLens: { select: { sku: true, brand: true } },
          contactLens: { select: { sku: true, brand: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      for (const m of mov) {
        const isSpec = m.spectacleLensId != null;
        if (itemType === "lens" && !isSpec) continue;
        if (itemType === "contact" && isSpec) continue;
        const sku = isSpec ? m.spectacleLens!.sku : m.contactLens!.sku;
        const brand = isSpec ? m.spectacleLens!.brand : m.contactLens!.brand;
        out.push({
          date: m.createdAt.toISOString(),
          itemType: isSpec ? "lens" : "contact",
          sku,
          brand,
          movementType: m.movementType,
          qty: m.quantity,
          reason: m.reason,
          reference: m.reference ?? "",
          doneBy: m.createdBy?.name ?? "—",
        });
      }
    }

    out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    res.json({ data: out });
  });

  router.get("/outstanding-balances", ...readAuth, async (_req, res) => {
    const rows = await prisma.$queryRaw<
      {
        patient_id: number;
        phone: string;
        patient_name: string;
        order_id: number;
        order_number: string;
        order_date: Date;
        total_paise: number;
        advance_paise: number;
        balance_paise: number;
      }[]
    >(Prisma.sql`
      SELECT pt.id as patient_id,
             pt.phone1 as phone,
             TRIM(COALESCE(pt.first_name,'') || ' ' || COALESCE(pt.middle_name,'') || ' ' || COALESCE(pt.last_name,'')) as patient_name,
             o.id as order_id,
             o.order_number as order_number,
             o.created_at as order_date,
             o.total_paise as total_paise,
             COALESCE((SELECT SUM(amount_paise) FROM order_payments p WHERE p.order_id = o.id), 0) as advance_paise,
             (o.total_paise - COALESCE((SELECT SUM(amount_paise) FROM order_payments p WHERE p.order_id = o.id), 0)) as balance_paise
      FROM orders o
      JOIN patients pt ON pt.id = o.patient_id
      WHERE o.status != 'cancelled'
        AND (o.total_paise - COALESCE((SELECT SUM(amount_paise) FROM order_payments p WHERE p.order_id = o.id), 0)) > 0
      ORDER BY balance_paise DESC
    `);

    const now = Date.now();
    const msDay = 86400000;
    const data = rows.map((r) => {
      const od = new Date(r.order_date).getTime();
      const daysSince = Math.floor((now - od) / msDay);
      return {
        patient: r.patient_name.replace(/\s+/g, " ").trim(),
        phone: r.phone,
        orderNo: r.order_number,
        orderDate: new Date(r.order_date).toISOString().slice(0, 10),
        totalPaise: r.total_paise,
        advancePaise: r.advance_paise,
        balancePaise: r.balance_paise,
        daysSinceOrder: daysSince,
      };
    });

    const totalOutstanding = data.reduce((s, r) => s + r.balancePaise, 0);
    res.json({ data, summary: { totalOutstandingPaise: totalOutstanding } });
  });

  app.use("/api/reports", router);
}
