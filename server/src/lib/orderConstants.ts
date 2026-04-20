/** Order lifecycle — stock deduction triggers when entering `sent_to_lab`. */
export const ORDER_STATUSES = [
  "pending",
  "sent_to_lab",
  "lenses_ready",
  "frame_ready",
  "assembly_done",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed transitions (linear + cancel). */
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
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const DISCOUNT_MODES = ["none", "flat", "percent"] as const;
