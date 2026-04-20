import { apiFetch } from "./client";

export type DashboardMetrics = {
  todayAppointments: { total: number; checkedIn: number; remaining: number };
  todayRevenuePaise: number;
  pendingOrders: number;
  lowStockCount: number;
};

export type ScheduleRow = {
  id: number;
  startsAt: string;
  patientName: string;
  appointmentType: string;
  status: string;
};

export type PendingDeliveryRow = {
  id: number;
  orderNumber: string;
  patientName: string;
  status: string;
  deliveryDate: string | null;
  daysOverdue: number;
};

export type RecentPatientRow = {
  id: number;
  patientCode: string;
  name: string;
  phone: string;
  createdAt: string;
};

export type OutstandingRow = {
  orderId: number;
  orderNumber: string;
  patientName: string;
  balancePaise: number;
};

export function getDashboardMetrics(): Promise<DashboardMetrics> {
  return apiFetch("/api/dashboard/metrics");
}

export function getTodaySchedule(): Promise<{ data: ScheduleRow[] }> {
  return apiFetch("/api/dashboard/today-schedule");
}

export function getPendingDeliveries(): Promise<{ data: PendingDeliveryRow[] }> {
  return apiFetch("/api/dashboard/pending-deliveries");
}

export function getRecentPatients(): Promise<{ data: RecentPatientRow[] }> {
  return apiFetch("/api/dashboard/recent-patients");
}

export function getOutstandingOrders(): Promise<{ data: OutstandingRow[] }> {
  return apiFetch("/api/dashboard/outstanding-orders");
}

export function getRevenue30d(): Promise<{ data: { date: string; revenuePaise: number }[] }> {
  return apiFetch("/api/dashboard/charts/revenue-30d");
}

export function getAppointmentsByTypeMonth(): Promise<{ data: { type: string; count: number }[] }> {
  return apiFetch("/api/dashboard/charts/appointments-by-type");
}

export function getTopFramesMonth(): Promise<{ data: { brand: string; qty: number }[] }> {
  return apiFetch("/api/dashboard/charts/top-frames");
}
