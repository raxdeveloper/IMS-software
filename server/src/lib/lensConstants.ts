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

/** Higher numeric index (e.g. 1.74) sorts first for "match" results */
export function indexSortValue(lensIndex: string): number {
  const m = /(\d+\.?\d*)/.exec(lensIndex);
  return m ? parseFloat(m[1]!) : 0;
}
