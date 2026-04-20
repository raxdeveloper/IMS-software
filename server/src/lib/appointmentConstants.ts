export const APPOINTMENT_TYPES = [
  "Eye Checkup",
  "Follow-up",
  "Contact Lens Fitting",
  "Post-surgery",
  "Glasses Collection",
  "Other",
] as const;

/** booked → checked_in → consultation_done → completed; no_show / cancelled terminal from most */
export const APPOINTMENT_STATUSES = [
  "booked",
  "checked_in",
  "consultation_done",
  "completed",
  "no_show",
  "cancelled",
] as const;
