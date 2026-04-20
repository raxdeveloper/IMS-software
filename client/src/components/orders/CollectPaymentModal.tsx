import { useState } from "react";
import { toast } from "sonner";
import { collectOrderPayment } from "../../api/orders";
import { PAYMENT_LABEL, PAYMENT_MODES } from "../../constants/orders";
import { formatInrPaiseDisplay, parseRupeesToPaise } from "../../lib/moneyInr";

type Props = {
  orderId: number;
  open: boolean;
  maxPaise: number;
  onClose: () => void;
  onSaved: () => void;
};

export function CollectPaymentModal({ orderId, open, maxPaise, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<(typeof PAYMENT_MODES)[number]>("cash");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function save() {
    const paise = parseRupeesToPaise(amount);
    if (paise === null || paise < 1) {
      toast.error("Enter a valid amount");
      return;
    }
    if (paise > maxPaise) {
      toast.error("Amount exceeds balance due");
      return;
    }
    setSaving(true);
    try {
      await collectOrderPayment(orderId, {
        amountPaise: paise,
        paymentMode: mode,
        reference: reference.trim() || null,
      });
      toast.success("Payment recorded");
      setAmount("");
      setReference("");
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
        <h2 className="text-lg font-semibold">Collect payment</h2>
        <p className="text-sm text-zinc-500">Maximum: {formatInrPaiseDisplay(maxPaise)}</p>
        <label className="block text-sm">
          <span className="text-zinc-600">Amount (NPR)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm tabular-nums"
            placeholder="0.00"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as (typeof PAYMENT_MODES)[number])}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Reference (optional)</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
            placeholder="Txn ID / cheque no."
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
