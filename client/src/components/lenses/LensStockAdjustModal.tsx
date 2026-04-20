import { useState } from "react";
import { toast } from "sonner";
import { adjustContactStock, adjustSpectacleStock, type ContactLensRow, type SpectacleLensRow } from "../../api/lenses";
import { MOVEMENT_OPTIONS } from "../../constants/frames";

type Props = {
  kind: "spectacle" | "contact";
  lens: SpectacleLensRow | ContactLensRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (row: SpectacleLensRow | ContactLensRow) => void;
};

export function LensStockAdjustModal({ kind, lens, open, onClose, onSaved }: Props) {
  const [movementType, setMovementType] = useState("stock_in");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [correctionDirection, setCorrectionDirection] = useState<"add" | "subtract">("add");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!lens) return;
    const q = parseInt(quantity, 10);
    if (Number.isNaN(q) || q < 1) {
      toast.error("Enter a positive quantity");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        movementType,
        quantity: q,
        reason: reason.trim(),
        reference: reference.trim() || null,
        correctionDirection: movementType === "correction" ? correctionDirection : undefined,
      };
      if (kind === "spectacle") {
        const res = await adjustSpectacleStock(lens.id, body);
        onSaved(res.frame);
        if (res.belowReorder) {
          toast.warning(`Stock for ${res.frame.sku} is at or below reorder level.`);
        } else toast.success("Stock updated");
      } else {
        const res = await adjustContactStock(lens.id, body);
        if (res.lens) onSaved(res.lens);
        if (res.belowReorder) {
          toast.warning(`Stock for ${res.lens?.sku ?? lens.sku} is at or below reorder level.`);
        } else toast.success("Stock updated");
      }
      onClose();
      setReason("");
      setReference("");
      setQuantity("1");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !lens) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50" role="dialog">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">Adjust stock — {lens.sku}</h2>
        <p className="text-sm text-zinc-500">Current stock: {lens.stockQty}</p>
        <label className="block text-sm">
          <span className="text-zinc-600">Movement type</span>
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          >
            {MOVEMENT_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {movementType === "correction" && (
          <label className="block text-sm">
            <span className="text-zinc-600">Correction</span>
            <select
              value={correctionDirection}
              onChange={(e) => setCorrectionDirection(e.target.value as "add" | "subtract")}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="add">Add to stock</option>
              <option value="subtract">Subtract from stock</option>
            </select>
          </label>
        )}
        <label className="block text-sm">
          <span className="text-zinc-600">Quantity</span>
          <input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm tabular-nums"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Reason</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Reference (optional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
