import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

export type DeductionSnapshot = {
  frames: { id: number; qty: number }[];
  spectacles: { id: number; qty: number }[];
  contacts: { id: number; boxes: number }[];
};

/**
 * Deduct inventory for order line items. Does not go negative — deducts up to available stock.
 * Returns warnings for shortfalls and a snapshot for cancellation restore.
 */
export async function deductInventoryForOrder(
  tx: Prisma.TransactionClient,
  params: {
    orderNumber: string;
    items: { itemType: string; itemId: number | null; qty: number }[];
    userId: string | null;
  },
): Promise<{ snapshot: DeductionSnapshot; warnings: string[] }> {
  const snapshot: DeductionSnapshot = { frames: [], spectacles: [], contacts: [] };
  const warnings: string[] = [];
  const ref = params.orderNumber;
  const reason = `Sale — order ${ref}`;

  for (const line of params.items) {
    if (line.itemType === "service" || line.itemId == null) continue;

    if (line.itemType === "frame") {
      const frame = await tx.frame.findUnique({ where: { id: line.itemId } });
      if (!frame) {
        warnings.push(`Frame id ${line.itemId} not found — skipped`);
        continue;
      }
      const needed = line.qty;
      const take = Math.min(needed, frame.stockQty);
      if (take < needed) {
        warnings.push(`${frame.sku}: needed ${needed}, only ${frame.stockQty} in stock (allocated ${take})`);
      }
      if (take <= 0) {
        warnings.push(`${frame.sku}: no stock to allocate`);
        continue;
      }
      await tx.frame.update({
        where: { id: frame.id },
        data: { stockQty: frame.stockQty - take },
      });
      await tx.stockMovement.create({
        data: {
          frameId: frame.id,
          movementType: "stock_out",
          quantity: take,
          stockChange: -take,
          reason,
          reference: ref,
          createdById: params.userId,
        },
      });
      snapshot.frames.push({ id: frame.id, qty: take });
      continue;
    }

    if (line.itemType === "spectacle_lens") {
      const lens = await tx.spectacleLens.findUnique({ where: { id: line.itemId } });
      if (!lens) {
        warnings.push(`Spectacle lens id ${line.itemId} not found — skipped`);
        continue;
      }
      const pairsOrdered = line.qty;
      const stockUnitsNeeded = lens.stockUnit === "pair" ? pairsOrdered : pairsOrdered * 2;
      const take = Math.min(stockUnitsNeeded, lens.stockQty);
      if (take < stockUnitsNeeded) {
        warnings.push(
          `${lens.sku}: needed ${stockUnitsNeeded} stock units (${lens.stockUnit}), only ${lens.stockQty} available (allocated ${take})`,
        );
      }
      if (take <= 0) {
        warnings.push(`${lens.sku}: no stock to allocate`);
        continue;
      }
      await tx.spectacleLens.update({
        where: { id: lens.id },
        data: { stockQty: lens.stockQty - take },
      });
      await tx.lensStockMovement.create({
        data: {
          spectacleLensId: lens.id,
          contactLensId: null,
          movementType: "stock_out",
          quantity: take,
          stockChange: -take,
          reason,
          reference: ref,
          createdById: params.userId,
        },
      });
      snapshot.spectacles.push({ id: lens.id, qty: take });
      continue;
    }

    if (line.itemType === "contact_lens") {
      const lens = await tx.contactLens.findUnique({ where: { id: line.itemId } });
      if (!lens) {
        warnings.push(`Contact lens id ${line.itemId} not found — skipped`);
        continue;
      }
      const boxes = line.qty;
      const take = Math.min(boxes, lens.stockQty);
      if (take < boxes) {
        warnings.push(`${lens.sku}: needed ${boxes} boxes, only ${lens.stockQty} (allocated ${take})`);
      }
      if (take <= 0) {
        warnings.push(`${lens.sku}: no stock to allocate`);
        continue;
      }
      await tx.contactLens.update({
        where: { id: lens.id },
        data: { stockQty: lens.stockQty - take },
      });
      await tx.lensStockMovement.create({
        data: {
          spectacleLensId: null,
          contactLensId: lens.id,
          movementType: "stock_out",
          quantity: take,
          stockChange: -take,
          reason,
          reference: ref,
          createdById: params.userId,
        },
      });
      snapshot.contacts.push({ id: lens.id, boxes: take });
    }
  }

  return { snapshot, warnings };
}

export async function restoreInventoryFromSnapshot(
  tx: Prisma.TransactionClient,
  params: {
    orderNumber: string;
    snapshot: DeductionSnapshot;
    userId: string | null;
  },
): Promise<void> {
  const ref = params.orderNumber;
  const reason = `Order cancelled — restore ${ref}`;

  for (const f of params.snapshot.frames) {
    const frame = await tx.frame.findUnique({ where: { id: f.id } });
    if (!frame) continue;
    await tx.frame.update({
      where: { id: f.id },
      data: { stockQty: frame.stockQty + f.qty },
    });
    await tx.stockMovement.create({
      data: {
        frameId: f.id,
        movementType: "return",
        quantity: f.qty,
        stockChange: f.qty,
        reason,
        reference: ref,
        createdById: params.userId,
      },
    });
  }

  for (const s of params.snapshot.spectacles) {
    const lens = await tx.spectacleLens.findUnique({ where: { id: s.id } });
    if (!lens) continue;
    await tx.spectacleLens.update({
      where: { id: s.id },
      data: { stockQty: lens.stockQty + s.qty },
    });
    await tx.lensStockMovement.create({
      data: {
        spectacleLensId: s.id,
        contactLensId: null,
        movementType: "return",
        quantity: s.qty,
        stockChange: s.qty,
        reason,
        reference: ref,
        createdById: params.userId,
      },
    });
  }

  for (const c of params.snapshot.contacts) {
    const lens = await tx.contactLens.findUnique({ where: { id: c.id } });
    if (!lens) continue;
    await tx.contactLens.update({
      where: { id: c.id },
      data: { stockQty: lens.stockQty + c.boxes },
    });
    await tx.lensStockMovement.create({
      data: {
        spectacleLensId: null,
        contactLensId: c.id,
        movementType: "return",
        quantity: c.boxes,
        stockChange: c.boxes,
        reason,
        reference: ref,
        createdById: params.userId,
      },
    });
  }
}

/** Parse snapshot JSON from DB */
export function parseSnapshot(raw: string | null): DeductionSnapshot | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as DeductionSnapshot;
    if (!p || typeof p !== "object") return null;
    return {
      frames: Array.isArray(p.frames) ? p.frames : [],
      spectacles: Array.isArray(p.spectacles) ? p.spectacles : [],
      contacts: Array.isArray(p.contacts) ? p.contacts : [],
    };
  } catch {
    return null;
  }
}
