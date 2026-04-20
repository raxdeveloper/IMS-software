import { apiFetch } from "./client";

export type AppointmentRow = {
  id: number;
  patientId: number;
  patientName: string;
  patientPhone: string;
  doctorUserId: string | null;
  doctorDisplayName: string;
  doctorUserName: string | null;
  startsAt: string;
  appointmentType: string;
  chiefComplaint: string | null;
  staffNotes: string | null;
  status: string;
  createdAt: string;
};

export type AppointmentListResponse = {
  data: AppointmentRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export function listAppointments(params: Record<string, string | number | boolean | undefined>): Promise<AppointmentListResponse> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const q = sp.toString();
  return apiFetch(`/api/appointments${q ? `?${q}` : ""}`);
}

export function listAppointmentsRange(params: { from: string; to: string; doctorUserId?: string }): Promise<{ data: AppointmentRow[] }> {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);
  if (params.doctorUserId) sp.set("doctorUserId", params.doctorUserId);
  return apiFetch(`/api/appointments/range?${sp.toString()}`);
}

export function getAppointmentCountsByMonth(year: number, month: number, doctorUserId?: string): Promise<{ counts: Record<string, number> }> {
  const sp = new URLSearchParams();
  sp.set("year", String(year));
  sp.set("month", String(month));
  if (doctorUserId) sp.set("doctorUserId", doctorUserId);
  return apiFetch(`/api/appointments/counts-by-day?${sp.toString()}`);
}

export function getTodayQueue(): Promise<{ data: AppointmentRow[] }> {
  return apiFetch("/api/appointments/queue/today");
}

export function getAppointmentDoctors(): Promise<{ doctors: { id: string; name: string; email: string }[] }> {
  return apiFetch("/api/appointments/doctors");
}

export function getAppointment(id: number): Promise<AppointmentRow> {
  return apiFetch(`/api/appointments/${id}`);
}

export function createAppointment(body: Record<string, unknown>): Promise<AppointmentRow> {
  return apiFetch("/api/appointments", { method: "POST", body: JSON.stringify(body) });
}

export function updateAppointment(id: number, body: Record<string, unknown>): Promise<AppointmentRow> {
  return apiFetch(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function updateAppointmentStatus(id: number, status: string): Promise<AppointmentRow> {
  return apiFetch(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}
