import { apiFetch } from "./client";

const q = (p: Record<string, string | undefined>) => {
  const sp = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export function fetchPatientRegistrationReport(from: string, to: string) {
  return apiFetch<{ data: Record<string, unknown>[]; summary: { total: number } }>(
    `/api/reports/patient-registration${q({ from, to })}`,
  );
}

export function fetchPrescriptionReport(from: string, to: string, doctor?: string) {
  return apiFetch<{ data: Record<string, unknown>[] }>(`/api/reports/prescriptions${q({ from, to, doctor })}`);
}

export function fetchDailySalesReport(from: string, to: string) {
  return apiFetch<{
    data: Record<string, unknown>[];
    summary: { totalSalesPaise: number; totalCollectedPaise: number; totalOutstandingPaise: number };
  }>(`/api/reports/daily-sales${q({ from, to })}`);
}

export function fetchMonthlyRevenueReport(from: string, to: string) {
  return apiFetch<{ data: Record<string, unknown>[] }>(`/api/reports/monthly-revenue${q({ from, to })}`);
}

export function fetchInventoryValuationReport() {
  return apiFetch<{
    frames: Record<string, unknown>[];
    lenses: Record<string, unknown>[];
    contactLenses: Record<string, unknown>[];
    totals: { framesPaise: number; lensesPaise: number; contactPaise: number; grandPaise: number };
  }>("/api/reports/inventory-valuation");
}

export function fetchStockMovementReport(from: string, to: string, itemType: string, movementDir: string) {
  return apiFetch<{ data: Record<string, unknown>[] }>(
    `/api/reports/stock-movement${q({ from, to, itemType, movementDir })}`,
  );
}

export function fetchOutstandingBalancesReport() {
  return apiFetch<{
    data: Record<string, unknown>[];
    summary: { totalOutstandingPaise: number };
  }>("/api/reports/outstanding-balances");
}
