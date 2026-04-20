import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  deletePatient,
  getCities,
  listPatients,
  restorePatient,
} from "../../api/patients";
import { useAuth } from "../../auth/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { PatientRow } from "../../types/patient";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PatientAvatar } from "../../components/patients/PatientAvatar";
import { QuickAddPatientModal } from "../../components/patients/QuickAddPatientModal";
import { ErrorCard } from "../../components/ui/ErrorCard";
import { useOfflineCacheHint } from "../../hooks/useOfflineCacheHint";

function SkeletonRows() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

export function PatientListPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [gender, setGender] = useState<"" | "Male" | "Female" | "Other">("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<"newest" | "name_asc" | "name_desc">("newest");
  const [page, setPage] = useState(1);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const limit = 20;

  const [delTarget, setDelTarget] = useState<PatientRow | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const offlineHint = useOfflineCacheHint();

  useEffect(() => {
    void getCities()
      .then((r) => setCities(r.cities))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void listPatients({
      search: debouncedSearch || undefined,
      gender: gender || undefined,
      city: city || undefined,
      sort,
      page,
      limit,
      include_deleted: includeDeleted,
      incomplete: incompleteOnly,
    })
      .then((r) => {
        if (cancelled) return;
        setRows(r.data);
        setTotal(r.total);
        setPages(r.pages);
        if (r.page !== page) setPage(r.page);
        setLoadError(null);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Failed to load patients";
        setRows([]);
        setTotal(0);
        setPages(1);
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, gender, city, sort, page, includeDeleted, incompleteOnly, refreshKey]);

  async function confirmDelete() {
    if (!delTarget) return;
    try {
      await deletePatient(delTarget.id);
      toast.success("Patient archived");
      setDelTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function doRestore(id: number) {
    try {
      await restorePatient(id);
      toast.success("Patient restored");
      setPage(1);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  }

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold">Patients</h1>
          <span className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium">
            {total}
          </span>
          {offlineHint && (
            <span className="text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded">
              (offline data)
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            data-search-input
            type="search"
            placeholder="Search name, phone, patient ID…"
            className="min-w-[200px] flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Quick add
              </button>
              <Link
                to="/patients/new"
                className="rounded-lg bg-accent hover:brightness-95 text-accent-foreground px-3 py-2 text-sm font-medium"
              >
                + Add patient
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Gender:</span>
        {(["", "Male", "Female", "Other"] as const).map((g) => (
          <button
            key={g || "all"}
            type="button"
            onClick={() => {
              setGender(g);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              gender === g
                ? "bg-accent text-accent-foreground"
                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {g === "" ? "All" : g}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => {
              setIncludeDeleted(e.target.checked);
              setPage(1);
            }}
          />
          Show archived
        </label>
        <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(e) => {
              setIncompleteOnly(e.target.checked);
              setPage(1);
            }}
          />
          Incomplete profiles
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          City
          <select
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Sort
          <select
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              setPage(1);
            }}
          >
            <option value="newest">Newest</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
          </select>
        </label>
      </div>

      {loadError && (
        <ErrorCard
          message={loadError}
          onRetry={() => {
            setLoadError(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {loading ? (
        <SkeletonRows />
      ) : loadError ? null : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Photo</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Age</th>
                <th className="px-3 py-2">Gender</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Registered</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${
                    p.isDeleted ? "opacity-70" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <PatientAvatar
                      photoUrl={p.photoUrl}
                      firstName={p.firstName}
                      lastName={p.lastName}
                      size="sm"
                      strike={p.isDeleted}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{p.patientCode}</td>
                  <td className="px-3 py-2">
                    <div className={p.isDeleted ? "line-through text-zinc-500" : ""}>
                      {p.firstName} {p.lastName}
                    </div>
                    {!p.profileComplete && (
                      <span className="inline-block mt-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-[10px] px-1.5 py-0.5">
                        Incomplete
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{p.age ?? "—"}</td>
                  <td className="px-3 py-2">{p.gender}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.phone1}</td>
                  <td className="px-3 py-2">{p.city ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link to={`/patients/${p.id}`} className="text-accent mr-2">
                      View
                    </Link>
                    {canWrite && !p.isDeleted && (
                      <Link to={`/patients/${p.id}/edit`} className="text-accent mr-2">
                        Edit
                      </Link>
                    )}
                    <button
                      type="button"
                      className="text-zinc-500 mr-2 text-xs"
                      title="Prescriptions module coming soon"
                      onClick={() => toast.message("Prescription module coming soon")}
                    >
                      New Rx
                    </button>
                    {isAdmin && !p.isDeleted && (
                      <button
                        type="button"
                        className="text-red-600 dark:text-red-400 text-xs"
                        onClick={() => setDelTarget(p)}
                      >
                        Delete
                      </button>
                    )}
                    {isAdmin && p.isDeleted && (
                      <button
                        type="button"
                        className="text-accent text-xs"
                        onClick={() => void doRestore(p.id)}
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center text-zinc-600 dark:text-zinc-400">
              <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-2xl">
                👤
              </div>
              {debouncedSearch || gender || city || includeDeleted || incompleteOnly ? (
                <p className="text-sm">No patients match your filters.</p>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">No patients yet. Add your first patient.</p>
                  {canWrite && (
                    <Link to="/patients/new" className="inline-block text-accent text-sm font-medium hover:underline">
                      Register a patient →
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          {loadError ? "—" : `Showing ${start}-${end} of ${total} patients`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page{" "}
            <input
              type="number"
              min={1}
              max={pages}
              className="w-14 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-1 py-0.5 text-center"
              value={page}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setPage(Math.min(Math.max(1, n), pages));
              }}
            />{" "}
            / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            className="rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!delTarget}
        title="Archive this patient?"
        description="Their records will be preserved. You can restore later from the archived list."
        confirmLabel="Archive"
        danger
        onCancel={() => setDelTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <QuickAddPatientModal open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  );
}
