import { apiFetch } from "./client";
import type { PatientDetail, PatientListResponse, PatientRow } from "../types/patient";

export type ListParams = {
  search?: string;
  gender?: string;
  city?: string;
  sort?: "newest" | "name_asc" | "name_desc";
  page?: number;
  limit?: number;
  include_deleted?: boolean;
  incomplete?: boolean;
};

export function listPatients(params: ListParams): Promise<PatientListResponse> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.gender) sp.set("gender", params.gender);
  if (params.city) sp.set("city", params.city);
  if (params.sort) sp.set("sort", params.sort);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.include_deleted) sp.set("include_deleted", "true");
  if (params.incomplete) sp.set("incomplete", "true");
  const q = sp.toString();
  return apiFetch<PatientListResponse>(`/api/patients${q ? `?${q}` : ""}`);
}

export function getPatient(id: number): Promise<PatientDetail> {
  return apiFetch<PatientDetail>(`/api/patients/${id}`);
}

export function getCities(): Promise<{ cities: string[] }> {
  return apiFetch<{ cities: string[] }>("/api/patients/cities");
}

export function checkPhone(phone: string): Promise<{
  exists: boolean;
  patient?: { id: number; patientCode: string; firstName: string; lastName: string };
}> {
  const d = phone.replace(/\D/g, "");
  return apiFetch(`/api/patients/check-phone?phone=${encodeURIComponent(d)}`);
}

export function createPatientJson(body: Record<string, unknown>): Promise<PatientRow> {
  return apiFetch<PatientRow>("/api/patients", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createPatientForm(fd: FormData): Promise<PatientRow> {
  return apiFetch<PatientRow>("/api/patients", {
    method: "POST",
    body: fd,
  });
}

export function updatePatientForm(id: number, fd: FormData): Promise<PatientRow> {
  return apiFetch<PatientRow>(`/api/patients/${id}`, {
    method: "PUT",
    body: fd,
  });
}

export function deletePatient(id: number): Promise<void> {
  return apiFetch<void>(`/api/patients/${id}`, { method: "DELETE" });
}

export function restorePatient(id: number): Promise<PatientRow> {
  return apiFetch<PatientRow>(`/api/patients/${id}/restore`, { method: "PUT" });
}
