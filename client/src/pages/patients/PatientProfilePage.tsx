import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getPatient } from "../../api/patients";
import { listPrescriptionsForPatient } from "../../api/prescriptions";
import { useAuth } from "../../auth/AuthContext";
import type { PatientDetail } from "../../types/patient";
import { PatientAvatar } from "../../components/patients/PatientAvatar";

type Tab = "rx" | "orders" | "appts" | "docs";

export function PatientProfilePage() {
  const { id } = useParams();
  const pid = parseInt(id ?? "", 10);
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";
  const canPrescribe = canWrite || user?.role === "doctor";

  const [p, setP] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("rx");
  const [rxRows, setRxRows] = useState<
    { id: number; rxNumber: string; rxDate: string; doctorName: string; lensType: string }[]
  >([]);
  const [rxLoading, setRxLoading] = useState(false);

  useEffect(() => {
    if (Number.isNaN(pid)) return;
    let cancelled = false;
    void getPatient(pid)
      .then((row) => {
        if (!cancelled) setP(row);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  useEffect(() => {
    if (Number.isNaN(pid)) return;
    let cancelled = false;
    setRxLoading(true);
    void listPrescriptionsForPatient(pid, { limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setRxRows(
          res.data.map((r) => ({
            id: Number((r as { id: number }).id),
            rxNumber: String((r as { rxNumber: string }).rxNumber),
            rxDate: String((r as { rxDate: string }).rxDate).slice(0, 10),
            doctorName: String((r as { doctorName: string }).doctorName),
            lensType: String((r as { lensType: string }).lensType),
          })),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  async function copyCode() {
    if (!p) return;
    try {
      await navigator.clipboard.writeText(p.patientCode);
      toast.success("Patient code copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  if (Number.isNaN(pid)) return <p className="text-red-600">Invalid patient</p>;

  if (loading || !p) {
    return (
      <div className="animate-pulse space-y-4 max-w-5xl">
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
        <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    );
  }

  const fullName = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");

  return (
    <div className="max-w-5xl space-y-6">
      {!p.profileComplete && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>Profile incomplete — add missing details for better care.</span>
          {canWrite && (
            <Link
              to={`/patients/${p.id}/edit`}
              className="rounded-lg bg-amber-700 hover:bg-amber-800 text-white px-3 py-1.5 text-sm font-medium"
            >
              Complete profile
            </Link>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <PatientAvatar photoUrl={p.photoUrl} firstName={p.firstName} lastName={p.lastName} size="lg" />
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => void copyCode()}
                className="font-mono text-sm font-bold text-accent hover:underline"
              >
                {p.patientCode}
              </button>
              <h1 className="text-2xl font-semibold mt-1 break-words">{fullName}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {p.age ?? "—"} yrs · {p.gender}
                {p.bloodGroup ? ` · ${p.bloodGroup}` : ""}
              </p>
            </div>
          </div>

          <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-zinc-500">Phone</dt>
              <dd>
                <a href={`tel:${p.phone1}`} className="text-accent">
                  {p.phone1}
                </a>
              </dd>
            </div>
            {p.phone2 && (
              <div>
                <dt className="text-zinc-500">Alt phone</dt>
                <dd>{p.phone2}</dd>
              </div>
            )}
            {p.email && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Email</dt>
                <dd>{p.email}</dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Address</dt>
              <dd>
                {[p.address, p.city, p.district, p.province, p.postalCode].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Occupation</dt>
              <dd>{p.occupation ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Referred by</dt>
              <dd>{p.referredBy ?? "—"}</dd>
            </div>
            {p.knownAllergies && (
              <div className="sm:col-span-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2">
                <dt className="text-amber-800 dark:text-amber-200 font-medium">Known allergies</dt>
                <dd className="mt-1 whitespace-pre-wrap">{p.knownAllergies}</dd>
              </div>
            )}
            {p.medicalHistory && (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Medical history</dt>
                <dd className="whitespace-pre-wrap">{p.medicalHistory}</dd>
              </div>
            )}
            <div className="sm:col-span-2 text-xs text-zinc-500">
              Registered {new Date(p.createdAt).toLocaleString()}
              {p.registeredByName ? ` · by ${p.registeredByName}` : ""}
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            {canWrite && (
              <Link
                to={`/patients/${p.id}/edit`}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Edit profile
              </Link>
            )}
            {canPrescribe ? (
              <Link
                to={`/prescriptions/new?patient_id=${p.id}`}
                className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:brightness-95"
              >
                New prescription
              </Link>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm opacity-60 cursor-not-allowed"
              title="Coming soon"
            >
              Book appointment
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm opacity-60 cursor-not-allowed"
              title="Coming soon"
            >
              New order
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="flex flex-wrap border-b border-zinc-200 dark:border-zinc-800">
            {(
              [
                ["rx", "Prescriptions"],
                ["orders", "Orders"],
                ["appts", "Appointments"],
                ["docs", "Documents"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-3 py-2 text-sm font-medium ${
                  tab === k
                    ? "border-b-2 border-accent text-accent"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-4 text-sm min-h-[200px]">
            {tab === "rx" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <span className="text-xs text-zinc-500">Newest first</span>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/patients/${p.id}/prescriptions`}
                      className="text-sm text-accent font-medium"
                    >
                      View All Prescriptions
                    </Link>
                    {canPrescribe && (
                      <Link
                        to={`/prescriptions/new?patient_id=${p.id}`}
                        className="text-sm text-accent font-medium"
                      >
                        + Add prescription
                      </Link>
                    )}
                  </div>
                </div>
                {rxLoading ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded" />
                    <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  </div>
                ) : rxRows.length === 0 ? (
                  <p className="text-center py-6 text-zinc-500">No prescriptions yet</p>
                ) : (
                  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {rxRows.map((r) => (
                      <li key={r.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <Link to={`/prescriptions/${r.id}`} className="font-mono font-medium text-accent">
                            {r.rxNumber}
                          </Link>
                          <span className="text-zinc-500 text-xs ml-2">{r.rxDate}</span>
                          <div className="text-xs text-zinc-600">
                            {r.doctorName} · {r.lensType}
                          </div>
                        </div>
                        <Link
                          to={`/prescriptions/${r.id}`}
                          className="text-xs rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1"
                        >
                          View
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === "orders" && (
              <div className="text-center py-8 text-zinc-500">No orders yet.</div>
            )}
            {tab === "appts" && (
              <div className="text-center py-8 text-zinc-500">No appointments scheduled.</div>
            )}
            {tab === "docs" && (
              <div className="space-y-3">
                <p className="text-zinc-500">Document upload coming soon</p>
                <button type="button" className="rounded-lg bg-zinc-200 dark:bg-zinc-800 px-3 py-2 text-sm" disabled>
                  Upload (disabled)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
