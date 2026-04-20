import { useState } from "react";
import { toast } from "sonner";
import { createPatientJson } from "../../api/patients";
import { getDistrictsByProvince, NEPAL_PROVINCES } from "../../utils/nepal";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: { id: number; patientCode: string }) => void;
};

export function QuickAddPatientModal({ open, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone1, setPhone1] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const row = await createPatientJson({
        quick: true,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone1,
        dob,
        gender,
        province: province || undefined,
        district: district || undefined,
      });
      toast.success("Patient created. Complete profile later.");
      onCreated?.({ id: row.id, patientCode: row.patientCode });
      setFirstName("");
      setLastName("");
      setPhone1("");
      setDob("");
      setGender("Male");
      setProvince("");
      setDistrict("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create patient");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Quick add patient</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500">First name *</label>
              <input
                required
                className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Last name *</label>
              <input
                required
                className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Primary phone *</label>
            <input
              required
              inputMode="numeric"
              maxLength={10}
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
              value={phone1}
              onChange={(e) => setPhone1(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500">Province</label>
              <select
                className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setDistrict("");
                }}
              >
                <option value="">—</option>
                {NEPAL_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">District</label>
              <select
                className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!province}
              >
                <option value="">—</option>
                {getDistrictsByProvince(province).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Date of birth *</label>
            <input
              required
              type="date"
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>
          <fieldset className="flex gap-3">
            <legend className="text-xs text-zinc-500 mb-1">Gender *</legend>
            {(["Male", "Female", "Other"] as const).map((g) => (
              <label key={g} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="qg"
                  checked={gender === g}
                  onChange={() => setGender(g)}
                />
                {g}
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {busy ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
