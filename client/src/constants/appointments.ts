export const APPOINTMENT_TYPES = [
  "Eye Checkup",
  "Follow-up",
  "Contact Lens Fitting",
  "Post-surgery",
  "Glasses Collection",
  "Other",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  checked_in: "Checked In",
  consultation_done: "Consultation Done",
  completed: "Completed",
  no_show: "No Show",
  cancelled: "Cancelled",
};

export function statusColorClass(status: string): string {
  switch (status) {
    case "booked":
      return "bg-sky-100 dark:bg-sky-900/50 text-sky-900 dark:text-sky-100 border-sky-300 dark:border-sky-800";
    case "checked_in":
      return "bg-amber-100 dark:bg-amber-900/50 text-amber-950 dark:text-amber-100 border-amber-300 dark:border-amber-800";
    case "consultation_done":
      return "bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 border-violet-300";
    case "completed":
      return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 border-emerald-300";
    case "no_show":
      return "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100 border-red-300";
    case "cancelled":
      return "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 border-zinc-400";
    default:
      return "bg-zinc-100 dark:bg-zinc-800";
  }
}

export function blockColorClass(status: string): string {
  switch (status) {
    case "booked":
      return "bg-sky-500/90 text-white border-sky-700";
    case "checked_in":
      return "bg-amber-500/90 text-white border-amber-700";
    case "consultation_done":
      return "bg-violet-500/90 text-white border-violet-700";
    case "completed":
      return "bg-emerald-600/90 text-white border-emerald-800";
    case "no_show":
      return "bg-red-500/90 text-white border-red-800";
    case "cancelled":
      return "bg-zinc-400 dark:bg-zinc-600 text-white border-zinc-600";
    default:
      return "bg-zinc-500 text-white";
  }
}

/** Next status quick actions from list (one click). */
export function quickNextStatuses(current: string): string[] {
  switch (current) {
    case "booked":
      return ["checked_in", "no_show", "cancelled"];
    case "checked_in":
      return ["consultation_done", "no_show", "cancelled"];
    case "consultation_done":
      return ["completed", "cancelled"];
    default:
      return [];
  }
}

export function fillReminderTemplate(
  template: string,
  a: { patientName: string; startsAt: string; doctorDisplayName: string },
): string {
  const d = new Date(a.startsAt);
  const dateStr = d.toLocaleDateString("en-IN");
  const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return template
    .replace(/\{patient_name\}/g, a.patientName)
    .replace(/\{date\}/g, dateStr)
    .replace(/\{time\}/g, timeStr)
    .replace(/\{doctor\}/g, a.doctorDisplayName);
}
