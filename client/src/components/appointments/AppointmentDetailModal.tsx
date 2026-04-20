import { useState } from "react";
import { toast } from "sonner";
import type { AppointmentRow } from "../../api/appointments";
import { STATUS_LABEL, blockColorClass } from "../../constants/appointments";

type Props = {
  appointment: AppointmentRow | null;
  open: boolean;
  onClose: () => void;
  /** Persist status change (API + side effects like Rx prompt) */
  onChangeStatus: (status: string) => Promise<void>;
  onEdit: (a: AppointmentRow) => void;
  onSendReminder: (a: AppointmentRow) => void;
  onBookFollowUp: (a: AppointmentRow) => void;
};

export function AppointmentDetailModal({
  appointment: a,
  open,
  onClose,
  onChangeStatus,
  onEdit,
  onSendReminder,
  onBookFollowUp,
}: Props) {
  const [busy, setBusy] = useState(false);

  if (!open || !a) return null;

  async function go(status: string) {
    setBusy(true);
    try {
      await onChangeStatus(status);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50" role="dialog">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-5 space-y-3 border border-zinc-200 dark:border-zinc-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start gap-2">
          <h2 className="text-lg font-semibold">Appointment</h2>
          <span className={`text-xs px-2 py-0.5 rounded border ${blockColorClass(a.status)}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
        </div>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-zinc-500">Patient:</span> {a.patientName}
          </p>
          <p>
            <span className="text-zinc-500">Phone:</span> {a.patientPhone}
          </p>
          <p>
            <span className="text-zinc-500">Doctor:</span> {a.doctorDisplayName}
          </p>
          <p>
            <span className="text-zinc-500">When:</span> {new Date(a.startsAt).toLocaleString()}
          </p>
          <p>
            <span className="text-zinc-500">Type:</span> {a.appointmentType}
          </p>
          {a.chiefComplaint && (
            <p>
              <span className="text-zinc-500">Complaint:</span> {a.chiefComplaint}
            </p>
          )}
          {a.staffNotes && (
            <p>
              <span className="text-zinc-500">Staff notes:</span> {a.staffNotes}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          {a.status === "booked" && (
            <button type="button" disabled={busy} onClick={() => void go("checked_in")} className="text-xs rounded border px-2 py-1 bg-amber-50 dark:bg-amber-950/40">
              Check In
            </button>
          )}
          {a.status === "checked_in" && (
            <button type="button" disabled={busy} onClick={() => void go("consultation_done")} className="text-xs rounded border px-2 py-1">
              Consultation done
            </button>
          )}
          {a.status === "consultation_done" && (
            <button type="button" disabled={busy} onClick={() => void go("completed")} className="text-xs rounded border px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40">
              Complete
            </button>
          )}
          {["booked", "checked_in", "consultation_done"].includes(a.status) && (
            <button type="button" disabled={busy} onClick={() => void go("no_show")} className="text-xs rounded border px-2 py-1 text-red-700">
              No Show
            </button>
          )}
          {a.status !== "cancelled" && a.status !== "completed" && a.status !== "no_show" && (
            <button type="button" disabled={busy} onClick={() => void go("cancelled")} className="text-xs rounded border px-2 py-1">
              Cancel
            </button>
          )}
          {a.status !== "cancelled" && (
            <button type="button" onClick={() => { onEdit(a); onClose(); }} className="text-xs rounded border px-2 py-1">
              Edit
            </button>
          )}
          <button type="button" onClick={() => onSendReminder(a)} className="text-xs rounded border px-2 py-1">
            Send Reminder
          </button>
          {a.status === "completed" && (
            <button type="button" onClick={() => { onBookFollowUp(a); onClose(); }} className="text-xs rounded border border-accent text-accent/90 px-2 py-1">
              Book follow-up
            </button>
          )}
        </div>

        <button type="button" onClick={onClose} className="w-full rounded-lg border py-2 text-sm">
          Close
        </button>
      </div>
    </div>
  );
}

export function SendReminderModal({
  open,
  onClose,
  whatsappText,
  smsText,
}: {
  open: boolean;
  onClose: () => void;
  whatsappText: string;
  smsText: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/50" role="dialog">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-lg w-full p-5 space-y-3 border">
        <h2 className="text-lg font-semibold">Reminder text (copy manually)</h2>
        <p className="text-xs text-zinc-500">Reminder integration ready. Connect Twilio or WhatsApp Business API to activate.</p>
        <label className="block text-sm">
          <span className="text-zinc-500">WhatsApp</span>
          <textarea readOnly value={whatsappText} rows={4} className="mt-1 w-full rounded border px-2 py-1 text-sm font-mono" />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-500">SMS</span>
          <textarea readOnly value={smsText} rows={4} className="mt-1 w-full rounded border px-2 py-1 text-sm font-mono" />
        </label>
        <button type="button" onClick={onClose} className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm w-full">
          Close
        </button>
      </div>
    </div>
  );
}
