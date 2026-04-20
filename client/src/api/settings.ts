import { apiFetch } from "./client";

export type ClinicSettings = {
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
  clinicEmail: string | null;
  clinicGstNumber: string | null;
  clinicLogoUrl: string | null;
  defaultGstPercent: number;
  invoiceTerms: string | null;
  currencySymbol: string;
  workingDaysJson: string;
  defaultReorderFrame: number;
  defaultReorderLens: number;
  appointmentStartMin: number;
  appointmentEndMin: number;
  appointmentSlotStepMin: number;
  reminderWhatsappTemplate: string | null;
  reminderSmsTemplate: string | null;
  reminderDayBefore: boolean;
  reminderTwoHours: boolean;
};

export function getClinicSettings(): Promise<ClinicSettings> {
  return apiFetch("/api/settings/clinic");
}

export function updateClinicSettings(body: Partial<ClinicSettings>): Promise<ClinicSettings> {
  return apiFetch("/api/settings/clinic", { method: "PATCH", body: JSON.stringify(body) });
}

export function uploadClinicLogo(file: File): Promise<{ clinicLogoUrl: string | null; settings: ClinicSettings }> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch("/api/settings/clinic/logo", { method: "POST", body: fd });
}
