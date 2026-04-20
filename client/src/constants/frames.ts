export const FRAME_TYPES = ["Full Rim", "Half Rim", "Rimless", "Sports", "Kids"] as const;
export const FRAME_MATERIALS = ["Metal", "TR90", "Acetate", "Titanium", "Stainless Steel", "Mixed"] as const;
export const FRAME_GENDERS = ["Men", "Women", "Unisex", "Kids"] as const;

export const CSV_TEMPLATE_HEADER = [
  "sku",
  "brand",
  "model",
  "color",
  "size",
  "frame_type",
  "material",
  "gender",
  "purchase_price_inr",
  "selling_price_inr",
  "stock_qty",
  "reorder_level",
  "supplier_name",
  "supplier_contact",
  "barcode",
  "notes",
].join(",");

export const MOVEMENT_OPTIONS = [
  { value: "stock_in", label: "Stock In" },
  { value: "stock_out", label: "Stock Out" },
  { value: "damage", label: "Damage" },
  { value: "return", label: "Return" },
  { value: "correction", label: "Correction" },
] as const;

export function movementLabel(type: string): string {
  return MOVEMENT_OPTIONS.find((m) => m.value === type)?.label ?? type;
}
