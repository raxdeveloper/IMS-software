import { useState } from "react";
import { toast } from "sonner";
import { updateOrderStatus } from "../../api/orders";
import { STATUS_LABEL, STATUS_TRANSITIONS } from "../../constants/orders";

type Props = {
  orderId: number;
  currentStatus: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function UpdateStatusModal({ orderId, currentStatus, open, onClose, onSaved }: Props) {
  const [toStatus, setToStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const nextOptions = STATUS_TRANSITIONS[currentStatus] ?? [];

  if (!open) return null;

  async function save() {
    if (!toStatus) {
      toast.error("Select next status");
      return;
    }
    setSaving(true);
    try {
      await updateOrderStatus(orderId, { toStatus, note: note.trim() || null });
      toast.success("Status updated");
      setNote("");
      setToStatus("");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/50" role="dialog">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold">Update status</h2>
        <p className="text-sm text-zinc-500">
          Current: <span className="font-medium text-zinc-800 dark:text-zinc-200">{STATUS_LABEL[currentStatus] ?? currentStatus}</span>
        </p>
        {nextOptions.length === 0 ? (
          <p className="text-sm text-zinc-600">No further transitions available.</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className="text-zinc-600">Next status</span>
              <select
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {nextOptions.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Note (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
              />
            </label>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
            Cancel
          </button>
          {nextOptions.length > 0 && (
            <button
              type="button"
              disabled={saving || !toStatus}
              onClick={() => void save()}
              className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Update"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
