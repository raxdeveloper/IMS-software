import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  downloadFramesExport,
  listFrames,
  type FrameRow,
} from "../../api/frames";
import { getStoredToken } from "../../api/client";
import { FRAME_MATERIALS, FRAME_TYPES } from "../../constants/frames";
import { formatInrPaiseDisplay } from "../../lib/moneyInr";
import { useAuth } from "../../auth/AuthContext";
import { StockAdjustModal } from "../../components/frames/StockAdjustModal";
import { ImportFramesModal } from "../../components/frames/ImportFramesModal";

function StatusBadge({ status }: { status: FrameRow["status"] }) {
  if (status === "in_stock")
    return (
      <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-xs font-medium">
        In Stock
      </span>
    );
  if (status === "low_stock")
    return (
      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 px-2 py-0.5 text-xs font-medium">
        Low Stock
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 px-2 py-0.5 text-xs font-medium">
      Out of Stock
    </span>
  );
}

const LIMIT = 25;

export function FrameListPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const frameType = searchParams.get("frameType") ?? "all";
  const material = searchParams.get("material") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "brand";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [data, setData] = useState<FrameRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [adjustFrame, setAdjustFrame] = useState<FrameRow | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const sortApi =
    sort === "price" ? "selling_price" : sort === "stock" ? "stock" : sort === "purchase_price" ? "purchase_price" : "brand";

  const load = useCallback(() => {
    setLoading(true);
    void listFrames({
      q: q || undefined,
      frameType: frameType === "all" ? undefined : frameType,
      material: material === "all" ? undefined : material,
      status: status === "all" ? undefined : status,
      sort: sortApi,
      order,
      page,
      limit: LIMIT,
    })
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
        setPages(res.pages);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [q, frameType, material, status, sortApi, order, page]);

  useEffect(() => {
    load();
  }, [load]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "" || value === "all") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  }

  async function exportCsv() {
    try {
      const blob = await downloadFramesExport(getStoredToken());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "frames-export.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  function mergeFrame(updated: FrameRow) {
    setData((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Frames inventory</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
          >
            Export CSV
          </button>
          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
              >
                Import CSV
              </button>
              <Link
                to="/frames/new"
                className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:brightness-95"
              >
                Add frame
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm min-w-[180px] flex-1">
            <span className="text-zinc-500 text-xs">Search</span>
            <input
              value={q}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Brand, model, SKU, color"
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">Type</span>
            <select
              value={frameType}
              onChange={(e) => setParam("frameType", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            >
              <option value="all">All types</option>
              {FRAME_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">Material</span>
            <select
              value={material}
              onChange={(e) => setParam("material", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            >
              <option value="all">All materials</option>
              {FRAME_MATERIALS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">Status</span>
            <select
              value={status}
              onChange={(e) => setParam("status", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">Sort</span>
            <select
              value={sort}
              onChange={(e) => setParam("sort", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            >
              <option value="brand">Brand</option>
              <option value="stock">Stock qty</option>
              <option value="price">Selling price</option>
              <option value="purchase_price">Purchase price</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setParam("order", order === "asc" ? "desc" : "asc")}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
          >
            {order === "asc" ? "Asc ↑" : "Desc ↓"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1100px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="px-2 py-2 font-medium">SKU</th>
                <th className="px-2 py-2 font-medium">Brand</th>
                <th className="px-2 py-2 font-medium">Model</th>
                <th className="px-2 py-2 font-medium">Color</th>
                <th className="px-2 py-2 font-medium">Size</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Material</th>
                <th className="px-2 py-2 font-medium tabular-nums">Purchase</th>
                <th className="px-2 py-2 font-medium tabular-nums">Selling</th>
                <th className="px-2 py-2 font-medium tabular-nums">Stock</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-zinc-500">
                    No frames found
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-2 py-2 font-mono text-xs">{row.sku}</td>
                    <td className="px-2 py-2">{row.brand}</td>
                    <td className="px-2 py-2">{row.modelName}</td>
                    <td className="px-2 py-2">{row.color}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{row.size}</td>
                    <td className="px-2 py-2">{row.frameType}</td>
                    <td className="px-2 py-2">{row.material}</td>
                    <td className="px-2 py-2 tabular-nums">{formatInrPaiseDisplay(row.purchasePrice)}</td>
                    <td className="px-2 py-2 tabular-nums">{formatInrPaiseDisplay(row.sellingPrice)}</td>
                    <td className="px-2 py-2 tabular-nums">{row.stockQty}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              onClick={() => setAdjustFrame(row)}
                              className="text-xs rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1"
                            >
                              Adjust stock
                            </button>
                            <Link
                              to={`/frames/${row.id}/edit`}
                              className="text-xs rounded border border-accent text-accent px-2 py-1"
                            >
                              Edit
                            </Link>
                          </>
                        )}
                        {!canWrite && (
                          <Link
                            to={`/frames/${row.id}/edit`}
                            className="text-xs rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1"
                          >
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
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600">
          <span>
            {total} total · Page {page} / {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setParam("page", String(page - 1))}
              className="rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setParam("page", String(page + 1))}
              className="rounded-lg border px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <StockAdjustModal
        frame={adjustFrame}
        open={adjustFrame !== null}
        onClose={() => setAdjustFrame(null)}
        onSaved={mergeFrame}
      />

      <ImportFramesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => load()}
      />
    </div>
  );
}
