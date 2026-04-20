import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listPatients, getPatient } from "../../api/patients";
import { getAppointmentDoctors, createAppointment, updateAppointment } from "../../api/appointments";
import type { ClinicSettings } from "../../api/settings";
import type { PatientRow } from "../../types/patient";
import { APPOINTMENT_TYPES } from "../../constants/appointments";
import { QuickAddPatientModal } from "../patients/QuickAddPatientModal";
import { generateSlotMinutes, localDateTimeFromParts, minutesToTimeInput } from "../../lib/appointmentSlots";
import type { AppointmentRow } from "../../api/appointments";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  settings: ClinicSettings;
  edit?: AppointmentRow | null;
  /** Prefill for follow-up booking */
  prefill?: {
    patientId: number;
    doctorUserId?: string | null;
    doctorDisplayName?: string;
    appointmentType?: string;
    dateYmd?: string;
  } | null;
};

export function AppointmentBookingModal({ open, onClose, onSaved, settings, edit, prefill }: Props) {
  const [patientSearch, setPatientSearch] = useState("");
  const [hits, setHits] = useState<PatientRow[]>([]);
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [doctorMode, setDoctorMode] = useState<"user" | "free">("user");
  const [doctorUserId, setDoctorUserId] = useState<string>("");
  const [doctorFree, setDoctorFree] = useState("");
  const [dateYmd, setDateYmd] = useState("");
  const [slotMin, setSlotMin] = useState(settings.appointmentStartMin);
  const [type, setType] = useState<string>(APPOINTMENT_TYPES[0]);
  const [chief, setChief] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const slots = generateSlotMinutes(settings.appointmentStartMin, settings.appointmentEndMin, settings.appointmentSlotStepMin);

  useEffect(() => {
    if (!open) return;
    void getAppointmentDoctors().then((r) => setDoctors(r.doctors));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setPatient(null);
      void getPatient(edit.patientId).then(setPatient);
      setDoctorMode(edit.doctorUserId ? "user" : "free");
      setDoctorUserId(edit.doctorUserId ?? "");
      setDoctorFree(edit.doctorUserId ? "" : edit.doctorDisplayName);
      const d = new Date(edit.startsAt);
      setDateYmd(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setSlotMin(d.getHours() * 60 + d.getMinutes());
      setType(edit.appointmentType);
      setChief(edit.chiefComplaint ?? "");
      setStaffNotes(edit.staffNotes ?? "");
      return;
    }
    const t = new Date();
    const def = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    setDateYmd(prefill?.dateYmd ?? def);
    setPatient(null);
    setDoctorMode(prefill?.doctorUserId ? "user" : "free");
    setDoctorUserId(prefill?.doctorUserId ?? "");
    setDoctorFree(prefill?.doctorDisplayName ?? "");
    setType(prefill?.appointmentType ?? APPOINTMENT_TYPES[0]);
    setChief("");
    setStaffNotes("");
    setSlotMin(settings.appointmentStartMin);
    if (prefill?.patientId) void getPatient(prefill.patientId).then(setPatient);
  }, [open, edit, prefill, settings.appointmentStartMin]);

  useEffect(() => {
    if (patientSearch.trim().length < 2) {
      setHits([]);
      return;
    }
    const id = setTimeout(() => {
      void listPatients({ search: patientSearch, limit: 15 }).then((r) => setHits(r.data));
    }, 300);
    return () => clearTimeout(id);
  }, [patientSearch]);

  if (!open) return null;

  const minYmd = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  async function save() {
    if (!patient) {
      toast.error("Select a patient");
      return;
    }
    const doctorDisplayName =
      doctorMode === "user" ? doctors.find((d) => d.id === doctorUserId)?.name ?? "" : doctorFree.trim();
    if (!doctorDisplayName) {
      toast.error("Select or enter a doctor");
      return;
    }
    const startsAt = localDateTimeFromParts(dateYmd, slotMin);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startsAt < today) {
      toast.error("Cannot book in the past");
      return;
    }
    setSaving(true);
    try {
      const body = {
        patientId: patient.id,
        doctorUserId: doctorMode === "user" && doctorUserId ? doctorUserId : null,
        doctorDisplayName,
        startsAt: startsAt.toISOString(),
        appointmentType: type,
        chiefComplaint: chief.trim() || null,
        staffNotes: staffNotes.trim() || null,
      };
      if (edit) {
        await updateAppointment(edit.id, body);
        toast.success("Appointment updated");
      } else {
        await createAppointment(body);
        toast.success("Appointment booked");
      }
      onSaved();
      onClose();
    } catch (e) {
      const err = e as Error & { status?: number };
      const msg =
        err.status === 409
          ? err.message || "This doctor already has an appointment at this time."
          : err instanceof Error
            ? err.message
            : "Failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/50 overflow-y-auto" role="dialog">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 border border-zinc-200 dark:border-zinc-700 my-8">
        <h2 className="text-lg font-semibold">{edit ? "Edit appointment" : "Book appointment"}</h2>

        <div>
          <label className="text-xs text-zinc-500">Patient</label>
          <div className="flex gap-2 mt-1">
            <input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search name / phone…"
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
            />
            <button type="button" className="text-sm border rounded-lg px-2" onClick={() => setQuickAdd(true)}>
              Quick add
            </button>
          </div>
          {hits.length > 0 && (
            <ul className="mt-1 border rounded-lg max-h-32 overflow-y-auto text-sm">
              {hits.map((p) => (
                <li key={p.id}>
                  <button type="button" className="w-full text-left px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" onClick={() => { setPatient(p); setPatientSearch(""); }}>
                    {p.firstName} {p.lastName} · {p.phone1}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {patient && (
            <p className="text-sm mt-2 text-accent">
              Selected: {patient.firstName} {patient.lastName}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs text-zinc-500">Doctor</label>
          <div className="flex gap-2 mt-1">
            <select value={doctorMode} onChange={(e) => setDoctorMode(e.target.value as "user" | "free")} className="rounded-lg border px-2 py-2 text-sm">
              <option value="user">From list</option>
              <option value="free">Free text</option>
            </select>
            {doctorMode === "user" ? (
              <select value={doctorUserId} onChange={(e) => setDoctorUserId(e.target.value)} className="flex-1 rounded-lg border px-2 py-2 text-sm">
                <option value="">Select…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : (
              <input value={doctorFree} onChange={(e) => setDoctorFree(e.target.value)} placeholder="Doctor name" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="text-xs text-zinc-500">Date</span>
            <input
              type="date"
              value={dateYmd}
              min={edit ? undefined : minYmd}
              onChange={(e) => setDateYmd(e.target.value)}
              className="mt-0.5 w-full rounded-lg border px-2 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-zinc-500">Time slot</span>
            <select value={slotMin} onChange={(e) => setSlotMin(parseInt(e.target.value, 10))} className="mt-0.5 w-full rounded-lg border px-2 py-2 text-sm">
              {slots.map((m) => (
                <option key={m} value={m}>
                  {minutesToTimeInput(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-xs text-zinc-500">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-0.5 w-full rounded-lg border px-2 py-2 text-sm">
            {APPOINTMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-xs text-zinc-500">Chief complaint (optional)</span>
          <input value={chief} onChange={(e) => setChief(e.target.value)} className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>

        <label className="block text-sm">
          <span className="text-xs text-zinc-500">Staff notes (optional)</span>
          <textarea value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} rows={2} className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : edit ? "Save" : "Book"}
          </button>
        </div>
      </div>

      <QuickAddPatientModal
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        onCreated={({ id }) => void getPatient(id).then(setPatient)}
      />
    </div>
  );
}
