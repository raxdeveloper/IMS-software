import { resolveApiUrl } from "../lib/apiOrigin";
import { apiFetch } from "./client";

export type SpectacleLensRow = {
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
  sphRangeLabel: string;
  cylRangeLabel: string;
  side: string;
  stockUnit: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
  reorderLevel: number;
  supplierName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  status: "in_stock" | "low_stock" | "out_of_stock";
};

export type ContactLensRow = {
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
  batches: { id: number; batchCode: string; expiryDate: string }[];
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  status: "in_stock" | "low_stock" | "out_of_stock";
};

export type LensListResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export function listSpectacleLenses(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const q = sp.toString();
  return apiFetch<LensListResponse<SpectacleLensRow>>(`/api/lenses/spectacle${q ? `?${q}` : ""}`);
}

export function listContactLenses(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const q = sp.toString();
  return apiFetch<LensListResponse<ContactLensRow>>(`/api/lenses/contact${q ? `?${q}` : ""}`);
}

export function getSpectacleLens(id: number) {
  return apiFetch<SpectacleLensRow>(`/api/lenses/spectacle/${id}`);
}

export function getContactLens(id: number) {
  return apiFetch<ContactLensRow>(`/api/lenses/contact/${id}`);
}

export function getSpectacleBrands() {
  return apiFetch<{ brands: string[] }>("/api/lenses/spectacle/brands");
}

export function getContactBrands() {
  return apiFetch<{ brands: string[] }>("/api/lenses/contact/brands");
}

export function suggestSpectacleSku() {
  return apiFetch<{ sku: string }>("/api/lenses/spectacle/suggest-sku");
}

export function suggestContactSku() {
  return apiFetch<{ sku: string }>("/api/lenses/contact/suggest-sku");
}

export function createSpectacleLens(body: Record<string, unknown>) {
  return apiFetch<SpectacleLensRow>("/api/lenses/spectacle", { method: "POST", body: JSON.stringify(body) });
}

export function updateSpectacleLens(id: number, body: Record<string, unknown>) {
  return apiFetch<SpectacleLensRow>(`/api/lenses/spectacle/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function createContactLens(body: Record<string, unknown>) {
  return apiFetch<ContactLensRow>("/api/lenses/contact", { method: "POST", body: JSON.stringify(body) });
}

export function updateContactLens(id: number, body: Record<string, unknown>) {
  return apiFetch<ContactLensRow>(`/api/lenses/contact/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function adjustSpectacleStock(
  id: number,
  body: {
    movementType: string;
    quantity: number;
    reason: string;
    reference?: string | null;
    correctionDirection?: "add" | "subtract";
  },
) {
  return apiFetch<{ frame: SpectacleLensRow; belowReorder: boolean }>(`/api/lenses/spectacle/${id}/stock-movement`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function adjustContactStock(
  id: number,
  body: {
    movementType: string;
    quantity: number;
    reason: string;
    reference?: string | null;
    correctionDirection?: "add" | "subtract";
  },
) {
  return apiFetch<{ lens: ContactLensRow | null; belowReorder: boolean }>(`/api/lenses/contact/${id}/stock-movement`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listCombinedLensMovements(params?: { page?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit ?? 50));
  const q = sp.toString();
  return apiFetch<{
    data: {
      id: number;
      kind: "spectacle" | "contact";
      sku: string;
      brand: string;
      movementType: string;
      quantity: number;
      stockChange: number;
      reason: string;
      reference: string | null;
      createdAt: string;
      doneByName: string | null;
    }[];
    total: number;
    page: number;
    pages: number;
    limit: number;
  }>(`/api/lenses/stock-movements${q ? `?${q}` : ""}`);
}

export function getLensLowStockStats() {
  return apiFetch<{ spectacle: number; contact: number; total: number }>("/api/lenses/stats/low-stock-count");
}

export function matchLensesFromPrescription(rxId: number, field: string) {
  return apiFetch<{
    field: string;
    sph: number;
    cyl: number;
    data: SpectacleLensRow[];
  }>(`/api/lenses/spectacle/match-prescription/${rxId}?field=${encodeURIComponent(field)}`);
}

export function matchLensesDirect(sph: number, cyl: number) {
  return apiFetch<{ data: SpectacleLensRow[] }>(
    `/api/lenses/spectacle/match?sph=${encodeURIComponent(String(sph))}&cyl=${encodeURIComponent(String(cyl))}`,
  );
}

export function listSpectacleStockMovements(id: number) {
  return apiFetch<{
    data: {
      id: number;
      movementType: string;
      quantity: number;
      stockChange: number;
      reason: string;
      reference: string | null;
      createdAt: string;
      doneByName: string | null;
    }[];
  }>(`/api/lenses/spectacle/${id}/stock-movements`);
}

export function listContactStockMovements(id: number) {
  return apiFetch<{
    data: {
      id: number;
      movementType: string;
      quantity: number;
      stockChange: number;
      reason: string;
      reference: string | null;
      createdAt: string;
      doneByName: string | null;
    }[];
  }>(`/api/lenses/contact/${id}/stock-movements`);
}

export async function downloadSpectacleExport(token: string | null) {
  const res = await fetch(resolveApiUrl("/api/lenses/spectacle/export"), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}

export async function downloadContactExport(token: string | null) {
  const res = await fetch(resolveApiUrl("/api/lenses/contact/export"), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  return res.blob();
}
