import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { listOrders, getOrderDoctors, type OrderListRow } from "../../api/orders";
import { formatInrPaiseDisplay } from "../../lib/moneyInr";
import { useAuth } from "../../auth/AuthContext";
import { STATUS_LABEL, statusBadgeClass } from "../../constants/orders";

const LIMIT = 25;

export function OrderListPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "all";
  const doctor = searchParams.get("doctor") ?? "";
  const balanceDue = searchParams.get("balanceDue") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const statusScope = searchParams.get("statusScope") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<string[]>([]);

  useEffect(() => {
    void getOrderDoctors()
      .then((r) => setDoctors(r.doctors))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    void listOrders({
      q: q || undefined,
      status: statusScope === "open" ? undefined : status === "all" ? undefined : status,
      statusScope: statusScope === "open" ? "open" : undefined,
      doctor: doctor || undefined,
      balanceDue: balanceDue === "all" || !balanceDue ? undefined : balanceDue,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit: LIMIT,
    })
      .then((r) => {
        setRows(r.data);
        setTotal(r.total);
        setPages(r.pages);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [q, status, statusScope, doctor, balanceDue, dateFrom, dateTo, page]);

  useEffect(() => {
    load();
  }, [load]);

  function setParam(key: string, value: string) {
    const n = new URLSearchParams(searchParams);
    if (value === "" || value === "all") n.delete(key);
    else n.set(key, value);
    if (key !== "page") n.delete("page");
    setSearchParams(n);
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Orders</h1>
        {canWrite && (
          <Link to="/orders/new" className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium">
            New order
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm flex-1 min-w-[140px]">
            <span className="text-zinc-500 text-xs">Search</span>
            <input
              value={q}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Order no, patient, phone…"
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">Status</span>
            <select
              value={status}
              onChange={(e) => setParam("status", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="sent_to_lab">Sent to Lab</option>
              <option value="lenses_ready">Lenses Ready</option>
              <option value="frame_ready">Frame Ready</option>
              <option value="assembly_done">Assembly Done</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="text-sm min-w-[140px]">
            <span className="text-zinc-500 text-xs">Doctor</span>
            <select
              value={doctor}
              onChange={(e) => setParam("doctor", e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {doctors.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">Balance due</span>
            <select
              value={balanceDue || "all"}
              onChange={(e) => setParam("balanceDue", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setParam("dateFrom", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-500 text-xs">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setParam("dateTo", e.target.value)}
              className="mt-0.5 block rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1100px]">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600">
              <tr>
                <th className="px-3 py-2">Order No</th>
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2 tabular-nums">Total</th>
                <th className="px-3 py-2 tabular-nums">Advance</th>
                <th className="px-3 py-2 tabular-nums">Balance</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Delivery</th>
                <th className="px-3 py-2 w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
                    No orders
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2 font-mono text-xs">{r.orderNumber}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.patientName}</div>
                      <div className="text-xs text-zinc-500">{r.patientPhone}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 max-w-[220px] truncate text-xs" title={r.itemsSummary}>
                      {r.itemsSummary}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatInrPaiseDisplay(r.totalPaise)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatInrPaiseDisplay(r.advancePaise)}</td>
                    <td className={`px-3 py-2 tabular-nums ${r.balancePaise > 0 ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                      {formatInrPaiseDisplay(r.balancePaise)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/orders/${r.id}`} className="text-xs rounded border border-accent text-accent/90 px-2 py-1">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between gap-2 px-4 py-3 border-t border-zinc-200 text-sm">
          <span>
            {total} orders · Page {page} / {pages}
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
    </div>
  );
}
