export const ORDER_STATUSES = [
  "pending",
  "sent_to_lab",
  "lenses_ready",
  "frame_ready",
  "assembly_done",
  "delivered",
  "cancelled",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  sent_to_lab: "Sent to Lab",
  lenses_ready: "Lenses Ready",
  frame_ready: "Frame Ready",
  assembly_done: "Assembly Done",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Allowed next statuses (must match server). */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["sent_to_lab", "cancelled"],
  sent_to_lab: ["lenses_ready", "cancelled"],
  lenses_ready: ["frame_ready", "cancelled"],
  frame_ready: ["assembly_done", "cancelled"],
  assembly_done: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const PAYMENT_MODES = ["cash", "upi", "card", "cheque", "insurance"] as const;

export const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  cheque: "Cheque",
  insurance: "Insurance",
};

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "delivered":
      return "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200";
    case "cancelled":
      return "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100";
    case "pending":
      return "bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100";
    default:
      return "bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-100";
  }
}
