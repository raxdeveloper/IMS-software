export const SPECTACLE_LENS_TYPES = [
  "Single Vision",
  "Bifocal",
  "Progressive",
  "Reading",
  "Office",
] as const;
export const LENS_INDEXES = [
  "1.50 CR39",
  "1.56",
  "1.60 PC",
  "1.67 Hi-index",
  "1.74",
  "Trivex",
  "Mineral",
] as const;
export const COATINGS = [
  "UC (Uncoated)",
  "HC (Hard Coat)",
  "HMC (Hard Multi Coat)",
  "BHMC (Blue Hard Multi Coat)",
  "Photochromic",
  "Polarized",
  "Anti-Reflective + Blue Cut",
] as const;
export const SIDE_OPTIONS = ["Right", "Left", "Pair"] as const;
export const STOCK_UNITS = ["pair", "each"] as const;

export const CONTACT_TYPES = ["Spherical", "Toric", "Multifocal"] as const;
export const CONTACT_MODALITIES = ["Daily", "Bi-weekly", "Monthly", "Quarterly", "Yearly"] as const;
export const COLOR_TYPES = ["Clear", "Colored"] as const;

export const RX_MATCH_FIELDS = [
  { value: "dv_re", label: "DV RE (SPH/CYL)" },
  { value: "dv_le", label: "DV LE (SPH/CYL)" },
  { value: "nv_re", label: "NV RE (SPH/CYL)" },
  { value: "nv_le", label: "NV LE (SPH/CYL)" },
] as const;
