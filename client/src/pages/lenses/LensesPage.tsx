import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  downloadContactExport,
  downloadSpectacleExport,
  listCombinedLensMovements,
  listContactLenses,
  listSpectacleLenses,
  type ContactLensRow,
  type SpectacleLensRow,
} from "../../api/lenses";
import { getStoredToken } from "../../api/client";
import { SPECTACLE_LENS_TYPES } from "../../constants/lenses";
import { movementLabel } from "../../constants/frames";
import { formatInrPaiseDisplay } from "../../lib/moneyInr";
import { useAuth } from "../../auth/AuthContext";
import { LensStockAdjustModal } from "../../components/lenses/LensStockAdjustModal";

const LIMIT = 25;

type Tab = "spectacle" | "contact" | "movements";

function StatusBadge({ status }: { status: "in_stock" | "low_stock" | "out_of_stock" }) {
  if (status === "in_stock")
    return <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-xs font-medium">In Stock</span>;
  if (status === "low_stock")
    return <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-2 py-0.5 text-xs font-medium">Low Stock</span>;
  return <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-2 py-0.5 text-xs font-medium">Out of Stock</span>;
}

export function LensesPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: Tab = rawTab === "contact" || rawTab === "movements" ? rawTab : "spectacle";
  const setTab = (t: Tab) => {
    const n = new URLSearchParams(searchParams);
    n.set("tab", t);
    if (t !== "spectacle" && t !== "contact") n.delete("page");
    setSearchParams(n);
  };

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";
  const sort = searchParams.get("sort") ?? "brand";

  const [specRows, setSpecRows] = useState<SpectacleLensRow[]>([]);
  const [specTotal, setSpecTotal] = useState(0);
  const [specPages, setSpecPages] = useState(1);
  const [conRows, setConRows] = useState<ContactLensRow[]>([]);
  const [conTotal, setConTotal] = useState(0);
  const [conPages, setConPages] = useState(1);
  const [movRows, setMovRows] = useState<Awaited<ReturnType<typeof listCombinedLensMovements>>["data"]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movPages, setMovPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [adjust, setAdjust] = useState<{ kind: "spectacle" | "contact"; row: SpectacleLensRow | ContactLensRow } | null>(null);

  const sortApi =
    sort === "price" ? "selling_price" : sort === "stock" ? "stock" : sort === "purchase_price" ? "purchase_price" : "brand";

  const loadSpec = useCallback(() => {
    setLoading(true);
    void listSpectacleLenses({
      q: q || undefined,
      status: status === "all" ? undefined : status,
      sort: sortApi,
      order,
      page,
      limit: LIMIT,
      lensType: searchParams.get("lensType") === "all" || !searchParams.get("lensType") ? undefined : searchParams.get("lensType") ?? undefined,
    })
      .then((r) => {
        setSpecRows(r.data);
        setSpecTotal(r.total);
        setSpecPages(r.pages);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [q, status, sortApi, order, page, searchParams]);

  const loadCon = useCallback(() => {
    setLoading(true);
    void listContactLenses({
      q: q || undefined,
      status: status === "all" ? undefined : status,
      sort: sortApi,
      order,
      page,
      limit: LIMIT,
    })
      .then((r) => {
        setConRows(r.data);
        setConTotal(r.total);
        setConPages(r.pages);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [q, status, sortApi, order, page]);

  const loadMov = useCallback(() => {
    setLoading(true);
    void listCombinedLensMovements({ page, limit: LIMIT })
      .then((r) => {
        setMovRows(r.data);
        setMovTotal(r.total);
        setMovPages(r.pages);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    if (tab === "spectacle") loadSpec();
    else if (tab === "contact") loadCon();
    else loadMov();
  }, [tab, loadSpec, loadCon, loadMov]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  }

  async function exportSpec() {
    try {
      const blob = await downloadSpectacleExport(getStoredToken());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "spectacle-lenses.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function exportCon() {
    try {
      const blob = await downloadContactExport(getStoredToken());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contact-lenses.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  function mergeSpec(u: SpectacleLensRow) {
    setSpecRows((rows) => rows.map((r) => (r.id === u.id ? u : r)));
  }
  function mergeCon(u: ContactLensRow) {
    setConRows((rows) => rows.map((r) => (r.id === u.id ? u : r)));
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px ${
        tab === id ? "border-accent text-accent bg-white dark:bg-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4 max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Lens inventory</h1>
      </div>

      <div className="flex flex-wrap border-b border-zinc-200 dark:border-zinc-800 gap-1">
        {tabBtn("spectacle", "Spectacle lenses")}
        {tabBtn("contact", "Contact lenses")}
        {tabBtn("movements", "Stock movements")}
      </div>

      {tab !== "movements" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex flex-wrap gap-2 flex-1">
              <label className="text-sm min-w-[160px] flex-1">
                <span className="text-zinc-500 text-xs">Search</span>
                <input
                  value={q}
                  onChange={(e) => setParam("q", e.target.value)}
                  placeholder="SKU, brand…"
                  className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>
              {tab === "spectacle" && (
                <label className="text-sm">
                  <span className="text-zinc-500 text-xs">Lens type</span>
                  <select
                    value={searchParams.get("lensType") ?? "all"}
                    onChange={(e) => setParam("lensType", e.target.value)}
                    className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm"
                  >
                    <option value="all">All</option>
                    {SPECTACLE_LENS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-sm">
                <span className="text-zinc-500 text-xs">Status</span>
                <select
                  value={status}
                  onChange={(e) => setParam("status", e.target.value)}
                  className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="in_stock">In stock</option>
                  <option value="low_stock">Low stock</option>
                  <option value="out_of_stock">Out of stock</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-zinc-500 text-xs">Sort</span>
                <select value={sort} onChange={(e) => setParam("sort", e.target.value)} className="mt-0.5 block rounded-lg border px-2 py-2 text-sm">
                  <option value="brand">Brand</option>
                  <option value="stock">Stock</option>
                  <option value="price">Sell price</option>
                  <option value="purchase_price">Purchase</option>
                </select>
              </label>
              <button type="button" onClick={() => setParam("order", order === "asc" ? "desc" : "asc")} className="rounded-lg border px-3 py-2 text-sm self-end">
                {order === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tab === "spectacle" && (
                <button type="button" onClick={() => void exportSpec()} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm">
                  Export CSV
                </button>
              )}
              {tab === "contact" && (
                <button type="button" onClick={() => void exportCon()} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm">
                  Export CSV
                </button>
              )}
              {canWrite && tab === "spectacle" && (
                <Link to="/lenses/spectacle/new" className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium">
                  Add spectacle lens
                </Link>
              )}
              {canWrite && tab === "contact" && (
                <Link to="/lenses/contact/new" className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium">
                  Add contact lens
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "spectacle" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[1200px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600">
                <tr>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Brand</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Material</th>
                  <th className="px-2 py-2">Coating</th>
                  <th className="px-2 py-2">SPH range</th>
                  <th className="px-2 py-2">CYL range</th>
                  <th className="px-2 py-2 tabular-nums">Purchase</th>
                  <th className="px-2 py-2 tabular-nums">Sell</th>
                  <th className="px-2 py-2">Stock</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-zinc-500">
                      Loading…
                    </td>
                  </tr>
                ) : specRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-zinc-500">
                      No spectacle lenses
                    </td>
                  </tr>
                ) : (
                  specRows.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-2 font-mono text-xs">{row.sku}</td>
                      <td className="px-2 py-2">{row.brand}</td>
                      <td className="px-2 py-2">{row.lensType}</td>
                      <td className="px-2 py-2">{row.lensIndex}</td>
                      <td className="px-2 py-2 max-w-[140px] truncate" title={row.coating}>
                        {row.coating}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-xs whitespace-nowrap">{row.sphRangeLabel}</td>
                      <td className="px-2 py-2 tabular-nums text-xs whitespace-nowrap">{row.cylRangeLabel}</td>
                      <td className="px-2 py-2 tabular-nums">{formatInrPaiseDisplay(row.purchasePrice)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatInrPaiseDisplay(row.sellingPrice)}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {row.stockQty}
                        <span className="text-zinc-400 text-xs ml-1">({row.stockUnit})</span>
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {canWrite && (
                            <>
                              <button type="button" onClick={() => setAdjust({ kind: "spectacle", row })} className="text-xs rounded border px-2 py-1">
                                Adjust
                              </button>
                              <Link to={`/lenses/spectacle/${row.id}/edit`} className="text-xs rounded border border-accent text-accent/90 px-2 py-1">
                                Edit
                              </Link>
                            </>
                          )}
                          {!canWrite && (
                            <Link to={`/lenses/spectacle/${row.id}/edit`} className="text-xs rounded border px-2 py-1">
                              View
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-2 px-4 py-3 border-t border-zinc-200 text-sm text-zinc-600">
            <span>
              {specTotal} total · Page {page} / {specPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} className="rounded-lg border px-2 py-1 disabled:opacity-40">
                Previous
              </button>
              <button
                type="button"
                disabled={page >= specPages}
                onClick={() => setParam("page", String(page + 1))}
                className="rounded-lg border px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "contact" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[1000px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600">
                <tr>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Brand</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Power</th>
                  <th className="px-2 py-2">BC/DIA</th>
                  <th className="px-2 py-2">Box</th>
                  <th className="px-2 py-2 tabular-nums">Purchase/box</th>
                  <th className="px-2 py-2 tabular-nums">Sell/box</th>
                  <th className="px-2 py-2">Stock</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center">
                      Loading…
                    </td>
                  </tr>
                ) : conRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-zinc-500">
                      No contact lenses
                    </td>
                  </tr>
                ) : (
                  conRows.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-2 font-mono text-xs">{row.sku}</td>
                      <td className="px-2 py-2">{row.brand}</td>
                      <td className="px-2 py-2">
                        {row.contactType} · {row.modality}
                      </td>
                      <td className="px-2 py-2 tabular-nums">{(row.power / 100).toFixed(2)} D</td>
                      <td className="px-2 py-2 text-xs">
                        {row.bc} / {row.dia}
                      </td>
                      <td className="px-2 py-2">{row.boxQty}</td>
                      <td className="px-2 py-2 tabular-nums">{formatInrPaiseDisplay(row.purchasePrice)}</td>
                      <td className="px-2 py-2 tabular-nums">{formatInrPaiseDisplay(row.sellingPrice)}</td>
                      <td className="px-2 py-2 tabular-nums">{row.stockQty} boxes</td>
                      <td className="px-2 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {canWrite && (
                            <>
                              <button type="button" onClick={() => setAdjust({ kind: "contact", row })} className="text-xs rounded border px-2 py-1">
                                Adjust
                              </button>
                              <Link to={`/lenses/contact/${row.id}/edit`} className="text-xs rounded border border-accent text-accent/90 px-2 py-1">
                                Edit
                              </Link>
                            </>
                          )}
                          {!canWrite && (
                            <Link to={`/lenses/contact/${row.id}/edit`} className="text-xs rounded border px-2 py-1">
                              View
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-2 px-4 py-3 border-t border-zinc-200 text-sm">
            <span>
              {conTotal} total · Page {page} / {conPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} className="rounded-lg border px-2 py-1 disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={page >= conPages} onClick={() => setParam("page", String(page + 1))} className="rounded-lg border px-2 py-1 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "movements" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[900px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Kind</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Brand</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Δ</th>
                  <th className="px-2 py-2">Reason</th>
                  <th className="px-2 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center">
                      Loading…
                    </td>
                  </tr>
                ) : movRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                      No movements
                    </td>
                  </tr>
                ) : (
                  movRows.map((m) => (
                    <tr key={m.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-2 py-2 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-2">{m.kind === "spectacle" ? "Spectacle" : "Contact"}</td>
                      <td className="px-2 py-2 font-mono text-xs">{m.sku}</td>
                      <td className="px-2 py-2">{m.brand}</td>
                      <td className="px-2 py-2">{movementLabel(m.movementType)}</td>
                      <td className="px-2 py-2 tabular-nums">{m.quantity}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {m.stockChange > 0 ? "+" : ""}
                        {m.stockChange}
                      </td>
                      <td className="px-2 py-2 max-w-[200px] truncate">{m.reason}</td>
                      <td className="px-2 py-2">{m.doneByName ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-2 px-4 py-3 border-t text-sm">
            <span>
              {movTotal} total · Page {page} / {movPages}
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} className="rounded-lg border px-2 py-1 disabled:opacity-40">
                Previous
              </button>
              <button type="button" disabled={page >= movPages} onClick={() => setParam("page", String(page + 1))} className="rounded-lg border px-2 py-1 disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      <LensStockAdjustModal
        kind={adjust?.kind ?? "spectacle"}
        lens={adjust?.row ?? null}
        open={adjust !== null}
        onClose={() => setAdjust(null)}
        onSaved={(row) => {
          if (adjust?.kind === "spectacle") mergeSpec(row as SpectacleLensRow);
          else mergeCon(row as ContactLensRow);
        }}
      />
    </div>
  );
}
