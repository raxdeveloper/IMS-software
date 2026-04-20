import type { Express } from "express";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRoles } from "../middleware/auth.js";

const readAuth = [authenticate, requireRoles("admin", "doctor", "staff")];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function patientFullName(p: { firstName: string; middleName: string | null; lastName: string }): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

export function mountDashboard(app: Express): void {
  const router = Router();

  router.get("/metrics", ...readAuth, async (_req, res) => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const apptsToday = await prisma.appointment.findMany({
      where: { startsAt: { gte: dayStart, lte: dayEnd } },
      select: { status: true },
    });
    const totalAppts = apptsToday.length;
    const checkedIn = apptsToday.filter((a) => a.status === "checked_in" || a.status === "consultation_done").length;
    const remaining = apptsToday.filter((a) => a.status === "booked").length;

    const todayRev = await prisma.order.aggregate({
      where: {
        createdAt: { gte: dayStart, lte: dayEnd },
        status: { not: "cancelled" },
      },
      _sum: { totalPaise: true },
    });

    const pendingOrders = await prisma.order.count({
      where: { status: { notIn: ["delivered", "cancelled"] } },
    });

    const lowF = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) as c FROM frames WHERE stock_qty <= reorder_level
    `;
    const lowS = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) as c FROM spectacle_lenses WHERE stock_qty <= reorder_level
    `;
    const lowC = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*) as c FROM contact_lenses WHERE stock_qty <= reorder_level
    `;
    const lowStockCount = Number(lowF[0]?.c ?? 0) + Number(lowS[0]?.c ?? 0) + Number(lowC[0]?.c ?? 0);

    res.json({
      todayAppointments: {
        total: totalAppts,
        checkedIn,
        remaining,
      },
      todayRevenuePaise: todayRev._sum.totalPaise ?? 0,
      pendingOrders,
      lowStockCount,
    });
  });

  router.get("/today-schedule", ...readAuth, async (_req, res) => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    const rowsFixed = await prisma.appointment.findMany({
      where: {
        AND: [
          { startsAt: { gte: dayStart, lte: dayEnd } },
          { startsAt: { gte: now } },
          { status: { notIn: ["cancelled", "no_show", "completed"] } },
        ],
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true } },
      },
    });

    res.json({
      data: rowsFixed.map((a) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        patientName: patientFullName(a.patient),
        appointmentType: a.appointmentType,
        status: a.status,
      })),
    });
  });

  router.get("/pending-deliveries", ...readAuth, async (_req, res) => {
    const now = new Date();
    const dayEnd = endOfDay(now);
    const dayStart = startOfDay(now);

    const orders = await prisma.order.findMany({
      where: {
        status: { notIn: ["delivered", "cancelled"] },
        deliveryDate: { lte: dayEnd },
      },
      orderBy: { deliveryDate: "asc" },
      take: 20,
      include: {
        patient: { select: { firstName: true, middleName: true, lastName: true } },
      },
    });

    const msPerDay = 86400000;
    const data = orders.map((o) => {
      const dd = o.deliveryDate ? new Date(o.deliveryDate) : null;
      let daysOverdue = 0;
      if (dd) {
        const diff = dayStart.getTime() - startOfDay(dd).getTime();
        if (diff > 0) daysOverdue = Math.floor(diff / msPerDay);
      }
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        patientName: patientFullName(o.patient),
        status: o.status,
        deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString() : null,
        daysOverdue,
      };
    });

    res.json({ data });
  });

  router.get("/recent-patients", ...readAuth, async (_req, res) => {
    const rows = await prisma.patient.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        patientCode: true,
        firstName: true,
        lastName: true,
        phone1: true,
        createdAt: true,
      },
    });
    res.json({
      data: rows.map((p) => ({
        id: p.id,
        patientCode: p.patientCode,
        name: `${p.firstName} ${p.lastName}`.trim(),
        phone: p.phone1,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  });

  router.get("/outstanding-orders", ...readAuth, async (_req, res) => {
    const rows2 = await prisma.$queryRaw<
      { id: number; order_number: string; balance_paise: number; patient_name: string }[]
    >(Prisma.sql`
      SELECT o.id,
             o.order_number as order_number,
             (o.total_paise - COALESCE((SELECT SUM(amount_paise) FROM order_payments p WHERE p.order_id = o.id), 0)) as balance_paise,
             TRIM(
               COALESCE(pt.first_name, '') || ' ' ||
               COALESCE(pt.middle_name, '') || ' ' ||
               COALESCE(pt.last_name, '')
             ) as patient_name
      FROM orders o
      JOIN patients pt ON pt.id = o.patient_id
      WHERE o.status != 'cancelled'
        AND (o.total_paise - COALESCE((SELECT SUM(amount_paise) FROM order_payments p WHERE p.order_id = o.id), 0)) > 0
      ORDER BY balance_paise DESC
      LIMIT 5
    `);

    res.json({
      data: rows2.map((r) => ({
        orderId: r.id,
        orderNumber: r.order_number,
        patientName: r.patient_name.replace(/\s+/g, " ").trim(),
        balancePaise: Number(r.balance_paise),
      })),
    });
  });

  router.get("/charts/revenue-30d", ...readAuth, async (_req, res) => {
    const rows = await prisma.$queryRaw<{ day: string; revenue: bigint }[]>(Prisma.sql`
      SELECT strftime('%Y-%m-%d', created_at) as day,
             COALESCE(SUM(total_paise), 0) as revenue
      FROM orders
      WHERE status != 'cancelled'
        AND datetime(created_at) >= datetime('now', '-30 days')
      GROUP BY strftime('%Y-%m-%d', created_at)
      ORDER BY day ASC
    `);
    res.json({
      data: rows.map((r) => ({ date: r.day, revenuePaise: Number(r.revenue) })),
    });
  });

  router.get("/charts/appointments-by-type", ...readAuth, async (_req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const rows = await prisma.appointment.groupBy({
      by: ["appointmentType"],
      where: { startsAt: { gte: monthStart, lte: monthEnd } },
      _count: { id: true },
    });
    res.json({
      data: rows.map((r) => ({ type: r.appointmentType, count: r._count.id })),
    });
  });

  router.get("/charts/top-frames", ...readAuth, async (_req, res) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const rows = await prisma.$queryRaw<{ brand: string; qty: bigint }[]>(Prisma.sql`
      SELECT f.brand as brand, SUM(oi.qty) as qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN frames f ON oi.item_type = 'frame' AND oi.item_id = f.id
      WHERE o.created_at >= ${monthStart}
        AND o.created_at <= ${monthEnd}
        AND o.status != 'cancelled'
      GROUP BY f.brand
      ORDER BY qty DESC
      LIMIT 5
    `);

    res.json({
      data: rows.map((r) => ({ brand: r.brand, qty: Number(r.qty) })),
    });
  });

  app.use("/api/dashboard", router);
}
