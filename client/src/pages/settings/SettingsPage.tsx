import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getClinicSettings, updateClinicSettings, uploadClinicLogo, type ClinicSettings } from "../../api/settings";
import { listUsers, createUser, patchUser, type UserRow } from "../../api/users";
import { useAuth } from "../../auth/AuthContext";

const GST_OPTIONS = [0, 5, 12, 18] as const;
const SLOT_MINS = [15, 30, 45, 60] as const;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function parseWorkingDays(json: string): boolean[] {
  try {
    const a = JSON.parse(json) as unknown;
    if (Array.isArray(a) && a.length === 7 && a.every((x) => typeof x === "boolean")) return a;
  } catch {
    /* ignore */
  }
  return [true, true, true, true, true, true, false];
}

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [s, setS] = useState<ClinicSettings | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [workingDays, setWorkingDays] = useState<boolean[]>(parseWorkingDays("[true,true,true,true,true,true,false]"));
  const [newUser, setNewUser] = useState<{
    name: string;
    email: string;
    password: string;
    role: "admin" | "doctor" | "staff";
  }>({ name: "", email: "", password: "", role: "staff" });

  useEffect(() => {
    void getClinicSettings()
      .then((cs) => {
        setS(cs);
        setWorkingDays(parseWorkingDays(cs.workingDaysJson));
      })
      .catch(() => toast.error("Could not load settings"));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void listUsers()
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, [isAdmin]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s || !isAdmin) return;
    setSaving(true);
    try {
      const u = await updateClinicSettings({
        ...s,
        workingDaysJson: JSON.stringify(workingDays),
      });
      setS(u);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;
    try {
      const r = await uploadClinicLogo(file);
      setS(r.settings);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
    e.target.value = "";
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.email.trim() || !newUser.password.trim()) {
      toast.error("Email and password required");
      return;
    }
    try {
      await createUser(newUser);
      toast.success("User created");
      setNewUser({ name: "", email: "", password: "", role: "staff" });
      const r = await listUsers();
      setUsers(r.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (!s) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      <form onSubmit={(e) => void save(e)} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-6">
        <section>
          <h2 className="font-medium">Clinic profile</h2>
          <p className="text-sm text-zinc-600 mb-4">Shown on invoices and prescription print headers.</p>
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="text-zinc-500">Clinic name</span>
              <input
                value={s.clinicName}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, clinicName: e.target.value })}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Address</span>
              <textarea
                value={s.clinicAddress ?? ""}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, clinicAddress: e.target.value || null })}
                rows={3}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="text-zinc-500">Phone</span>
                <input
                  value={s.clinicPhone ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) => setS({ ...s, clinicPhone: e.target.value || null })}
                  className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-500">Email</span>
                <input
                  type="email"
                  value={s.clinicEmail ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) => setS({ ...s, clinicEmail: e.target.value || null })}
                  className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-zinc-500">GST number</span>
              <input
                value={s.clinicGstNumber ?? ""}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, clinicGstNumber: e.target.value || null })}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <div className="text-sm">
              <span className="text-zinc-500">Logo</span>
              {s.clinicLogoUrl && (
                <div className="mt-2 mb-2">
                  <img src={s.clinicLogoUrl} alt="Logo" className="h-16 object-contain border rounded p-1 bg-white" />
                </div>
              )}
              {isAdmin && (
                <label className="inline-flex items-center gap-2 mt-1 cursor-pointer rounded-lg border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => void onLogo(e)} />
                  Upload logo
                </label>
              )}
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="font-medium">System</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <label className="block text-sm">
              <span className="text-zinc-500">Default GST %</span>
              <select
                value={s.defaultGstPercent}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, defaultGstPercent: parseInt(e.target.value, 10) })}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              >
                {GST_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}%
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Currency symbol</span>
              <input
                value={s.currencySymbol}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, currencySymbol: e.target.value || "रू" })}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
          </div>
          <div className="mt-4">
            <span className="text-sm text-zinc-500">Working days</span>
            <div className="flex flex-wrap gap-3 mt-2">
              {DAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={workingDays[i]}
                    onChange={(e) => {
                      const n = [...workingDays];
                      n[i] = e.target.checked;
                      setWorkingDays(n);
                    }}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
          <label className="block text-sm mt-4">
            <span className="text-zinc-500">Appointment slot duration</span>
            <select
              value={s.appointmentSlotStepMin}
              disabled={!isAdmin}
              onChange={(e) => setS({ ...s, appointmentSlotStepMin: parseInt(e.target.value, 10) })}
              className="mt-0.5 w-full max-w-xs rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
            >
              {SLOT_MINS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <label className="block text-sm">
              <span className="text-zinc-500">Default reorder level (frames)</span>
              <input
                type="number"
                min={0}
                value={s.defaultReorderFrame}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, defaultReorderFrame: parseInt(e.target.value, 10) || 0 })}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Default reorder level (lenses)</span>
              <input
                type="number"
                min={0}
                value={s.defaultReorderLens}
                disabled={!isAdmin}
                onChange={(e) => setS({ ...s, defaultReorderLens: parseInt(e.target.value, 10) || 0 })}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
          </div>
        </section>

        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <h2 className="font-medium">Invoice &amp; appointments</h2>
          <label className="block text-sm mt-4">
            <span className="text-zinc-500">Invoice footer terms</span>
            <textarea
              value={s.invoiceTerms ?? ""}
              disabled={!isAdmin}
              onChange={(e) => setS({ ...s, invoiceTerms: e.target.value || null })}
              rows={2}
              className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
            />
          </label>
          <h3 className="text-sm font-medium mt-4">Appointment schedule</h3>
          <div className="grid sm:grid-cols-3 gap-4 mt-2">
            <label className="block text-sm">
              <span className="text-zinc-500">First slot</span>
              <input
                type="time"
                disabled={!isAdmin}
                value={`${String(Math.floor(s.appointmentStartMin / 60)).padStart(2, "0")}:${String(s.appointmentStartMin % 60).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map((x) => parseInt(x, 10));
                  setS({ ...s, appointmentStartMin: (h || 0) * 60 + (m || 0) });
                }}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">End of day</span>
              <input
                type="time"
                disabled={!isAdmin}
                value={`${String(Math.floor(s.appointmentEndMin / 60)).padStart(2, "0")}:${String(s.appointmentEndMin % 60).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map((x) => parseInt(x, 10));
                  setS({ ...s, appointmentEndMin: (h || 0) * 60 + (m || 0) });
                }}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
          </div>
          <h3 className="text-sm font-medium mt-4">Reminder templates</h3>
          <p className="text-xs text-zinc-500">
            Placeholders: {"{patient_name}"}, {"{date}"}, {"{time}"}, {"{doctor}"}
          </p>
          <label className="block text-sm mt-2">
            <span className="text-zinc-500">WhatsApp</span>
            <textarea
              value={s.reminderWhatsappTemplate ?? ""}
              disabled={!isAdmin}
              onChange={(e) => setS({ ...s, reminderWhatsappTemplate: e.target.value || null })}
              rows={2}
              className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm font-mono text-xs disabled:opacity-70"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-500">SMS</span>
            <textarea
              value={s.reminderSmsTemplate ?? ""}
              disabled={!isAdmin}
              onChange={(e) => setS({ ...s, reminderSmsTemplate: e.target.value || null })}
              rows={2}
              className="mt-0.5 w-full rounded-lg border px-3 py-2 text-sm font-mono text-xs disabled:opacity-70"
            />
          </label>
          <div className="flex flex-wrap gap-4 text-sm mt-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={s.reminderDayBefore}
                onChange={(e) => setS({ ...s, reminderDayBefore: e.target.checked })}
              />
              1 day before (when integrated)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={s.reminderTwoHours}
                onChange={(e) => setS({ ...s, reminderTwoHours: e.target.checked })}
              />
              2 hours before (when integrated)
            </label>
          </div>
        </section>

        {isAdmin && (
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        )}
      </form>

      {isAdmin && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <h2 className="font-medium">User management</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-zinc-200 dark:border-zinc-700">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                  <th className="text-left p-2 border-b">Name</th>
                  <th className="text-left p-2 border-b">Email</th>
                  <th className="text-left p-2 border-b">Role</th>
                  <th className="text-left p-2 border-b">Status</th>
                  <th className="text-left p-2 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="p-2">{u.name}</td>
                    <td className="p-2">{u.email}</td>
                    <td className="p-2">
                      <select
                        value={u.role}
                        disabled={u.id === user?.id}
                        onChange={(e) => {
                          void patchUser(u.id, { role: e.target.value })
                            .then(() => listUsers().then((r) => setUsers(r.data)))
                            .catch((err) => toast.error(err instanceof Error ? err.message : "Update failed"));
                        }}
                        className="rounded border px-1 py-0.5 text-xs"
                      >
                        <option value="admin">admin</option>
                        <option value="doctor">doctor</option>
                        <option value="staff">staff</option>
                      </select>
                    </td>
                    <td className="p-2">{u.isActive ? "Active" : "Inactive"}</td>
                    <td className="p-2">
                      {u.id !== user?.id && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => {
                            if (!window.confirm(u.isActive ? "Deactivate this user?" : "Activate this user?")) return;
                            void patchUser(u.id, { isActive: !u.isActive })
                              .then(() => listUsers().then((r) => setUsers(r.data)))
                              .catch((err) => toast.error(err instanceof Error ? err.message : "Update failed"));
                          }}
                        >
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form onSubmit={(e) => void addUser(e)} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end border-t pt-4">
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Name</span>
              <input
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Email</span>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Temp password</span>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
              />
            </label>
            <div className="flex gap-2">
              <label className="text-sm flex-1">
                <span className="text-xs text-zinc-500">Role</span>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "admin" | "doctor" | "staff" })}
                  className="mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm"
                >
                  <option value="staff">staff</option>
                  <option value="doctor">doctor</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <button type="submit" className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm self-end">
                Add user
              </button>
            </div>
          </form>
        </section>
      )}

      <Link to="/" className="text-sm text-accent hover:underline inline-block">
        ← Dashboard
      </Link>
    </div>
  );
}
