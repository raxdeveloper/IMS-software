import { resolveApiUrl } from "../lib/apiOrigin";
import { apiFetch } from "./client";

export type FrameRow = {
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
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  status: "in_stock" | "low_stock" | "out_of_stock";
};

export type FrameListResponse = {
  data: FrameRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export type StockMovementRow = {
  id: number;
  frameId: number;
  movementType: string;
  quantity: number;
  stockChange: number;
  reason: string;
  reference: string | null;
  createdAt: string;
  doneByName: string | null;
};

export function listFrames(params: Record<string, string | number | undefined>): Promise<FrameListResponse> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const q = sp.toString();
  return apiFetch(`/api/frames${q ? `?${q}` : ""}`);
}

export function getFrame(id: number): Promise<FrameRow> {
  return apiFetch(`/api/frames/${id}`);
}

export function getBrands(): Promise<{ brands: string[] }> {
  return apiFetch("/api/frames/brands");
}

export function suggestSku(): Promise<{ sku: string }> {
  return apiFetch("/api/frames/suggest-sku");
}

export function createFrame(body: Record<string, unknown>): Promise<FrameRow> {
  return apiFetch("/api/frames", { method: "POST", body: JSON.stringify(body) });
}

export function updateFrame(id: number, body: Record<string, unknown>): Promise<FrameRow> {
  return apiFetch(`/api/frames/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function adjustStock(
  frameId: number,
  body: {
    movementType: string;
    quantity: number;
    reason: string;
    reference?: string | null;
    correctionDirection?: "add" | "subtract";
  },
): Promise<{ frame: FrameRow; movement: unknown; belowReorder: boolean }> {
  return apiFetch(`/api/frames/${frameId}/stock-movement`, { method: "POST", body: JSON.stringify(body) });
}

export function listStockMovements(
  frameId: number,
  params?: { page?: number; limit?: number },
): Promise<{ data: StockMovementRow[]; total: number; page: number; pages: number; limit: number }> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit ?? 50));
  const q = sp.toString();
  return apiFetch(`/api/frames/${frameId}/stock-movements${q ? `?${q}` : ""}`);
}

export function getLowStockCount(): Promise<{ count: number }> {
  return apiFetch("/api/frames/stats/low-stock-count");
}

export async function downloadFramesExport(token: string | null): Promise<Blob> {
  const res = await fetch(resolveApiUrl("/api/frames/export"), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

export function previewImport(csv: string): Promise<{
  rows: {
    line: number;
    valid: boolean;
    errors: string[];
    payload: Record<string, unknown> | null;
    duplicateInDb: boolean;
    duplicateInFile: boolean;
  }[];
  summary: { total: number; valid: number; invalid: number };
}> {
  return apiFetch("/api/frames/import/preview", { method: "POST", body: JSON.stringify({ csv }) });
}

export function confirmImport(payloads: Record<string, unknown>[]): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  return apiFetch("/api/frames/import/confirm", { method: "POST", body: JSON.stringify({ payloads }) });
}
