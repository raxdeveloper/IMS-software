import { apiFetch } from "./client";

export type PrescriptionDto = Record<string, unknown>;

export function getDoctors(): Promise<{ doctors: { id: string; name: string }[] }> {
  return apiFetch("/api/prescriptions/doctors");
}

export function createPrescription(body: Record<string, unknown>): Promise<PrescriptionDto> {
  return apiFetch("/api/prescriptions", { method: "POST", body: JSON.stringify(body) });
}

export function getPrescription(id: number): Promise<PrescriptionDto> {
  return apiFetch(`/api/prescriptions/${id}`);
}

export function updatePrescription(id: number, body: Record<string, unknown>): Promise<PrescriptionDto> {
  return apiFetch(`/api/prescriptions/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function listPrescriptionsForPatient(
  patientId: number,
  params?: { page?: number; limit?: number },
): Promise<{ data: PrescriptionDto[]; total: number; page: number; pages: number; limit: number }> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit ?? 10));
  const q = sp.toString();
  return apiFetch(`/api/prescriptions/patient/${patientId}${q ? `?${q}` : ""}`);
}

export function deletePrescription(id: number): Promise<void> {
  return apiFetch(`/api/prescriptions/${id}`, { method: "DELETE" });
}
