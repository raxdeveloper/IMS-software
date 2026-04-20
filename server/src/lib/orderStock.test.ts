import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { deductInventoryForOrder } from "./orderStock.js";

function mockTx(frame: { id: number; sku: string; stockQty: number }) {
  const updates: { id: number; stockQty: number }[] = [];
  const tx = {
    frame: {
      findUnique: vi.fn().mockResolvedValue(frame),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: { stockQty: number } }) => {
        updates.push({ id: where.id, stockQty: data.stockQty });
        return { ...frame, ...data };
      }),
    },
    stockMovement: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, updates };
}

describe("deductInventoryForOrder", () => {
  it("deducts frame stock when order includes a frame line", async () => {
    const { tx, updates } = mockTx({ id: 1, sku: "FR-1", stockQty: 10 });
    const { snapshot, warnings } = await deductInventoryForOrder(tx, {
      orderNumber: "SO-TEST-1",
      items: [{ itemType: "frame", itemId: 1, qty: 3 }],
      userId: null,
    });
    expect(warnings.length).toBe(0);
    expect(snapshot.frames).toEqual([{ id: 1, qty: 3 }]);
    expect(updates[0]?.stockQty).toBe(7);
  });
});
