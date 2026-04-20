import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getOrder, type OrderDetail } from "../../api/orders";
import { getClinicSettings, type ClinicSettings } from "../../api/settings";
import { formatInrPaiseDisplay } from "../../lib/moneyInr";
import { useAuth } from "../../auth/AuthContext";
import { STATUS_LABEL, statusBadgeClass } from "../../constants/orders";
import { CollectPaymentModal } from "../../components/orders/CollectPaymentModal";
import { UpdateStatusModal } from "../../components/orders/UpdateStatusModal";
import { OrderInvoiceContent } from "../../components/orders/OrderInvoiceContent";

export function OrderDetailPage() {
  const { id } = useParams();
  const oid = parseInt(id ?? "", 10);
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (Number.isNaN(oid)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([getOrder(oid), getClinicSettings()])
      .then(([o, c]) => {
        setOrder(o);
        setClinic(c);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [oid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pdfMode) return;
    let cancelled = false;
    void (async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const el = pdfRef.current;
      if (!el || cancelled) {
        setPdfMode(false);
        return;
      }
      try {
        const mod = await import("html2pdf.js");
        const html2pdf = mod.default;
        await html2pdf()
          .set({
            margin: [8, 8, 8, 8],
            filename: `${order?.orderNumber ?? "invoice"}.pdf`,
            image: { type: "jpeg", quality: 0.96 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          })
          .from(el)
          .save();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "PDF failed");
      } finally {
        setPdfMode(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfMode, order?.orderNumber]);

  function printInvoice() {
    window.print();
  }

  if (id === "new") return <Navigate to="/orders/new" replace />;
  if (Number.isNaN(oid)) return <p className="text-red-600">Invalid order</p>;
  if (loading || !order || !clinic) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/orders" className="text-sm text-accent hover:underline">
            ← Orders
          </Link>
          <h1 className="text-xl font-semibold font-mono">{order.orderNumber}</h1>
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(order.status)}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && order.balancePaise > 0 && order.status !== "cancelled" && (
            <button type="button" onClick={() => setPayOpen(true)} className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium">
              Collect payment
            </button>
          )}
          {canWrite && (
            <button type="button" onClick={() => setStatusOpen(true)} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm">
              Update status
            </button>
          )}
          <button type="button" onClick={printInvoice} className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm">
            Print invoice
          </button>
          <button
            type="button"
            onClick={() => {
              setPdfMode(true);
              toast.info("Preparing PDF…");
            }}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
          >
            Download PDF
          </button>
        </div>
      </div>

      {order.stockWarning && order.stockWarning.length > 0 && (
        <div className="no-print rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <p className="font-medium">Stock allocation warnings</p>
          <ul className="list-disc ml-5 mt-1">
            {order.stockWarning.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="no-print grid sm:grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="font-medium mb-2">Patient</h2>
          <p>{order.patient.fullName}</p>
          <p className="text-zinc-500">{order.patient.phone1}</p>
          <p className="text-xs text-zinc-500 mt-1">{order.patient.patientCode}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <h2 className="font-medium mb-2">Totals</h2>
          <p className="tabular-nums">Total: {formatInrPaiseDisplay(order.totalPaise)}</p>
          <p className="tabular-nums">Paid: {formatInrPaiseDisplay(order.paidPaise)}</p>
          <p className={`tabular-nums font-medium ${order.balancePaise > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
            Balance: {formatInrPaiseDisplay(order.balancePaise)}
          </p>
        </div>
      </div>

      <div className="no-print rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-800/80">
            <tr>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Unit</th>
              <th className="text-right px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{it.description}</td>
                <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatInrPaiseDisplay(it.unitPricePaise)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatInrPaiseDisplay(it.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 text-sm">
        <h2 className="font-medium mb-2">Status history</h2>
        <ul className="space-y-2">
          {order.statusLogs.map((l) => (
            <li key={l.id} className="text-xs border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <span className="text-zinc-500">{new Date(l.createdAt).toLocaleString()}</span> — {l.fromStatus ? STATUS_LABEL[l.fromStatus] ?? l.fromStatus : "—"} →{" "}
              {STATUS_LABEL[l.toStatus] ?? l.toStatus}
              {l.changedByName && <span className="text-zinc-500"> · {l.changedByName}</span>}
              {l.note && <div className="mt-0.5 text-zinc-600">{l.note}</div>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white p-6 print:shadow-none" id="invoice-print">
        <OrderInvoiceContent clinic={clinic} order={order} />
      </div>

      {pdfMode && (
        <div className="fixed left-[-9999px] top-0 w-[210mm]" aria-hidden>
          <div ref={pdfRef}>
            <OrderInvoiceContent clinic={clinic} order={order} />
          </div>
        </div>
      )}

      <CollectPaymentModal
        orderId={oid}
        open={payOpen}
        maxPaise={order.balancePaise}
        onClose={() => setPayOpen(false)}
        onSaved={load}
      />
      <UpdateStatusModal
        orderId={oid}
        currentStatus={order.status}
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
