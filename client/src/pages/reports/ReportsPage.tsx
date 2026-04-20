import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  fetchDailySalesReport,
  fetchInventoryValuationReport,
  fetchMonthlyRevenueReport,
  fetchOutstandingBalancesReport,
  fetchPatientRegistrationReport,
  fetchPrescriptionReport,
  fetchStockMovementReport,
} from "../../api/reports";
import { formatInrPaiseDisplay } from "../../lib/moneyInr";
import { downloadCsv, downloadPdfFromElement } from "../../lib/reportExport";
import { PAYMENT_LABEL } from "../../constants/orders";

type ReportId =
  | "patients"
  | "prescriptions"
  | "daily_sales"
  | "monthly_revenue"
  | "inventory"
  | "stock_movement"
  | "outstanding";

const REPORTS: { id: ReportId; label: string }[] = [
  { id: "patients", label: "Patient registration" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "daily_sales", label: "Daily sales" },
  { id: "monthly_revenue", label: "Monthly revenue" },
  { id: "inventory", label: "Inventory valuation" },
  { id: "stock_movement", label: "Stock movement" },
  { id: "outstanding", label: "Outstanding balances" },
];

function defaultRange(): { from: string; to: string } {
  const t = new Date();
  const to = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const f = new Date(t);
  f.setMonth(f.getMonth() - 1);
  const from = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  return { from, to };
}

const tableClass =
  "min-w-full text-sm border-collapse [&_th]:sticky [&_th]:top-0 [&_th]:bg-zinc-100 [&_th]:dark:bg-zinc-800 [&_th]:z-10 [&_tr:nth-child(even)]:bg-zinc-50/80 [&_tr:nth-child(even)]:dark:bg-zinc-800/40";

export function ReportsPage() {
  const { from: df, to: dt } = defaultRange();
  const [from, setFrom] = useState(df);
  const [to, setTo] = useState(dt);
  const [report, setReport] = useState<ReportId>("patients");
  const [doctor, setDoctor] = useState("");
  const [itemType, setItemType] = useState("all");
  const [movementDir, setMovementDir] = useState("all");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<unknown>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setPayload(null);
    try {
      if (report === "patients") {
        setPayload(await fetchPatientRegistrationReport(from, to));
      } else if (report === "prescriptions") {
        setPayload(await fetchPrescriptionReport(from, to, doctor.trim() || undefined));
      } else if (report === "daily_sales") {
        setPayload(await fetchDailySalesReport(from, to));
      } else if (report === "monthly_revenue") {
        setPayload(await fetchMonthlyRevenueReport(from, to));
      } else if (report === "inventory") {
        setPayload(await fetchInventoryValuationReport());
      } else if (report === "stock_movement") {
        setPayload(await fetchStockMovementReport(from, to, itemType, movementDir));
      } else if (report === "outstanding") {
        setPayload(await fetchOutstandingBalancesReport());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [report, from, to, doctor, itemType, movementDir]);

  function exportCsvHandler() {
    if (!payload) {
      toast.error("Generate a report first");
      return;
    }
    const base = `report-${report}-${from}-${to}`;
    try {
      if (report === "patients") {
        const p = payload as { data: Record<string, unknown>[]; summary: { total: number } };
        downloadCsv(base, [...p.data, { regDate: "TOTAL", name: String(p.summary.total) } as Record<string, unknown>]);
      } else if (report === "prescriptions") {
        downloadCsv(base, (payload as { data: Record<string, unknown>[] }).data);
      } else if (report === "daily_sales") {
        const p = payload as { data: Record<string, unknown>[]; summary: Record<string, number> };
        downloadCsv(base, [
          ...p.data,
          {
            orderNo: "SUMMARY",
            totalPaise: p.summary.totalSalesPaise,
            advancePaise: p.summary.totalCollectedPaise,
            balancePaise: p.summary.totalOutstandingPaise,
          } as Record<string, unknown>,
        ]);
      } else if (report === "monthly_revenue") {
        downloadCsv(base, (payload as { data: Record<string, unknown>[] }).data);
      } else if (report === "inventory") {
        const p = payload as {
          frames: Record<string, unknown>[];
          lenses: Record<string, unknown>[];
          contactLenses: Record<string, unknown>[];
          totals: Record<string, number>;
        };
        downloadCsv(`${base}-frames`, p.frames);
        downloadCsv(`${base}-lenses`, p.lenses);
        downloadCsv(`${base}-contact`, p.contactLenses);
        toast.success("Exported three CSV files");
        return;
      } else if (report === "stock_movement") {
        downloadCsv(base, (payload as { data: Record<string, unknown>[] }).data);
      } else if (report === "outstanding") {
        const p = payload as { data: Record<string, unknown>[]; summary: { totalOutstandingPaise: number } };
        downloadCsv(base, [...p.data, { patient: "TOTAL", balancePaise: p.summary.totalOutstandingPaise } as Record<string, unknown>]);
      }
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    }
  }

  async function exportPdfHandler() {
    if (!printRef.current) {
      toast.error("Nothing to print");
      return;
    }
    try {
      await downloadPdfFromElement(printRef.current, `report-${report}`);
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF failed");
    }
  }

  return (
    <div className="space-y-4 max-w-[1200px]">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          <span className="text-xs text-zinc-500">Report</span>
          <select
            value={report}
            onChange={(e) => setReport(e.target.value as ReportId)}
            className="mt-0.5 block rounded-lg border px-2 py-2 text-sm min-w-[200px]"
          >
            {REPORTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {report !== "inventory" && report !== "outstanding" && (
          <>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-0.5 block rounded-lg border px-2 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-0.5 block rounded-lg border px-2 py-2 text-sm"
              />
            </label>
          </>
        )}
        {report === "prescriptions" && (
          <label className="text-sm">
            <span className="text-xs text-zinc-500">Doctor (contains)</span>
            <input
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
              className="mt-0.5 block rounded-lg border px-2 py-2 text-sm w-40"
            />
          </label>
        )}
        {report === "stock_movement" && (
          <>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Item type</span>
              <select
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="mt-0.5 block rounded-lg border px-2 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="frame">Frame</option>
                <option value="lens">Spectacle lens</option>
                <option value="contact">Contact lens</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs text-zinc-500">Movement</span>
              <select
                value={movementDir}
                onChange={(e) => setMovementDir(e.target.value)}
                className="mt-0.5 block rounded-lg border px-2 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="in">In (stock increase)</option>
                <option value="out">Out (stock decrease)</option>
              </select>
            </label>
          </>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => void run()}
          className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "…" : "Generate"}
        </button>
        <button type="button" onClick={exportCsvHandler} className="rounded-lg border px-3 py-2 text-sm">
          Export CSV
        </button>
        <button type="button" onClick={() => void exportPdfHandler()} className="rounded-lg border px-3 py-2 text-sm">
          Export PDF
        </button>
      </div>

      <div ref={printRef} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto bg-white dark:bg-zinc-900 p-4">
        <ReportBody report={report} payload={payload} />
      </div>
    </div>
  );
}

function ReportBody({ report, payload }: { report: ReportId; payload: unknown }) {
  if (!payload) {
    return <p className="text-zinc-500 text-sm">Generate a report to preview.</p>;
  }

  if (report === "patients") {
    const p = payload as { data: { regDate: string; patientId: number; name: string; age: number | null; gender: string; phone: string; referredBy: string }[]; summary: { total: number } };
    return (
      <>
        <h2 className="font-semibold mb-2">Patient registration</h2>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="text-left p-2 border">Reg date</th>
                <th className="text-left p-2 border">Patient ID</th>
                <th className="text-left p-2 border">Name</th>
                <th className="text-left p-2 border">Age</th>
                <th className="text-left p-2 border">Gender</th>
                <th className="text-left p-2 border">Phone</th>
                <th className="text-left p-2 border">Referred by</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border">{row.regDate}</td>
                  <td className="p-2 border">{row.patientId}</td>
                  <td className="p-2 border">{row.name}</td>
                  <td className="p-2 border">{row.age ?? "—"}</td>
                  <td className="p-2 border">{row.gender}</td>
                  <td className="p-2 border">{row.phone}</td>
                  <td className="p-2 border">{row.referredBy || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-2 border font-medium" colSpan={7}>
                  Total patients in range: {p.summary.total}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    );
  }

  if (report === "prescriptions") {
    const p = payload as {
      data: {
        rxNo: string;
        date: string;
        patient: string;
        doctor: string;
        reSph: string;
        reCyl: string;
        leSph: string;
        leCyl: string;
        lensType: string;
      }[];
    };
    return (
      <>
        <h2 className="font-semibold mb-2">Prescription report</h2>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="text-left p-2 border">RX No</th>
                <th className="text-left p-2 border">Date</th>
                <th className="text-left p-2 border">Patient</th>
                <th className="text-left p-2 border">Doctor</th>
                <th className="text-left p-2 border">RE SPH</th>
                <th className="text-left p-2 border">RE CYL</th>
                <th className="text-left p-2 border">LE SPH</th>
                <th className="text-left p-2 border">LE CYL</th>
                <th className="text-left p-2 border">Lens type</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border font-mono text-xs">{row.rxNo}</td>
                  <td className="p-2 border">{row.date}</td>
                  <td className="p-2 border">{row.patient}</td>
                  <td className="p-2 border">{row.doctor}</td>
                  <td className="p-2 border tabular-nums">{row.reSph}</td>
                  <td className="p-2 border tabular-nums">{row.reCyl}</td>
                  <td className="p-2 border tabular-nums">{row.leSph}</td>
                  <td className="p-2 border tabular-nums">{row.leCyl}</td>
                  <td className="p-2 border">{row.lensType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (report === "daily_sales") {
    const p = payload as {
      data: {
        orderNo: string;
        date: string;
        patient: string;
        items: string;
        subtotalPaise: number;
        discountPaise: number;
        gstAmountPaise: number;
        totalPaise: number;
        advancePaise: number;
        balancePaise: number;
        paymentMode: string;
      }[];
      summary: { totalSalesPaise: number; totalCollectedPaise: number; totalOutstandingPaise: number };
    };
    return (
      <>
        <h2 className="font-semibold mb-2">Daily sales</h2>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="text-left p-2 border">Order</th>
                <th className="text-left p-2 border">Date</th>
                <th className="text-left p-2 border">Patient</th>
                <th className="text-left p-2 border">Items</th>
                <th className="text-right p-2 border">Subtotal</th>
                <th className="text-right p-2 border">Discount</th>
                <th className="text-right p-2 border">GST</th>
                <th className="text-right p-2 border">Total</th>
                <th className="text-right p-2 border">Advance</th>
                <th className="text-right p-2 border">Balance</th>
                <th className="text-left p-2 border">Pay mode</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border font-mono text-xs">{row.orderNo}</td>
                  <td className="p-2 border">{row.date}</td>
                  <td className="p-2 border">{row.patient}</td>
                  <td className="p-2 border max-w-[200px] truncate" title={row.items}>
                    {row.items}
                  </td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.subtotalPaise)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.discountPaise)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.gstAmountPaise)}</td>
                  <td className="p-2 border text-right font-medium">{formatInrPaiseDisplay(row.totalPaise)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.advancePaise)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.balancePaise)}</td>
                  <td className="p-2 border text-xs">
                    {row.paymentMode
                      .split(", ")
                      .map((m) => PAYMENT_LABEL[m] ?? m)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-2 border font-medium text-right" colSpan={7}>
                  Totals (sales / collected / outstanding)
                </td>
                <td className="p-2 border text-right font-medium">{formatInrPaiseDisplay(p.summary.totalSalesPaise)}</td>
                <td className="p-2 border text-right font-medium">{formatInrPaiseDisplay(p.summary.totalCollectedPaise)}</td>
                <td className="p-2 border text-right font-medium">{formatInrPaiseDisplay(p.summary.totalOutstandingPaise)}</td>
                <td className="p-2 border" />
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    );
  }

  if (report === "monthly_revenue") {
    const p = payload as {
      data: {
        ym: string;
        orderCount: number;
        gross: number;
        discounts: number;
        gst: number;
        net: number;
        collected: number;
        outstanding: number;
      }[];
    };
    return (
      <>
        <h2 className="font-semibold mb-2">Monthly revenue summary</h2>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="text-left p-2 border">Month</th>
                <th className="text-right p-2 border">Orders</th>
                <th className="text-right p-2 border">Gross</th>
                <th className="text-right p-2 border">Discounts</th>
                <th className="text-right p-2 border">GST</th>
                <th className="text-right p-2 border">Net revenue</th>
                <th className="text-right p-2 border">Collected</th>
                <th className="text-right p-2 border">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((row) => (
                <tr key={row.ym}>
                  <td className="p-2 border">{row.ym}</td>
                  <td className="p-2 border text-right">{row.orderCount}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.gross)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.discounts)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.gst)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.net)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.collected)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (report === "inventory") {
    const p = payload as {
      frames: { sku: string; brand: string; model: string; stockQty: number; purchasePricePaise: number; sellingPricePaise: number; stockValuePaise: number }[];
      lenses: { sku: string; brand: string; model: string; stockQty: number; purchasePricePaise: number; sellingPricePaise: number; stockValuePaise: number }[];
      contactLenses: { sku: string; brand: string; model: string; stockQty: number; purchasePricePaise: number; sellingPricePaise: number; stockValuePaise: number }[];
      totals: { framesPaise: number; lensesPaise: number; contactPaise: number; grandPaise: number };
    };
    const InvTable = ({
      title,
      rows,
      totalPaise,
    }: {
      title: string;
      rows: typeof p.frames;
      totalPaise: number;
    }) => (
      <div className="mb-6">
        <h3 className="font-medium mb-2">{title}</h3>
        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="text-left p-2 border">SKU</th>
                <th className="text-left p-2 border">Brand</th>
                <th className="text-left p-2 border">Model / type</th>
                <th className="text-right p-2 border">Qty</th>
                <th className="text-right p-2 border">Purchase</th>
                <th className="text-right p-2 border">Selling</th>
                <th className="text-right p-2 border">Stock value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sku}>
                  <td className="p-2 border font-mono text-xs">{row.sku}</td>
                  <td className="p-2 border">{row.brand}</td>
                  <td className="p-2 border">{row.model}</td>
                  <td className="p-2 border text-right">{row.stockQty}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.purchasePricePaise)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.sellingPricePaise)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.stockValuePaise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-2 border font-medium" colSpan={6}>
                  Section total
                </td>
                <td className="p-2 border text-right font-medium">{formatInrPaiseDisplay(totalPaise)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
    return (
      <>
        <h2 className="font-semibold mb-4">Inventory valuation (current)</h2>
        <InvTable title="Frames" rows={p.frames} totalPaise={p.totals.framesPaise} />
        <InvTable title="Spectacle lenses" rows={p.lenses} totalPaise={p.totals.lensesPaise} />
        <InvTable title="Contact lenses" rows={p.contactLenses} totalPaise={p.totals.contactPaise} />
        <p className="font-semibold text-right">Grand total: {formatInrPaiseDisplay(p.totals.grandPaise)}</p>
      </>
    );
  }

  if (report === "stock_movement") {
    const p = payload as {
      data: {
        date: string;
        itemType: string;
        sku: string;
        brand: string;
        movementType: string;
        qty: number;
        reason: string;
        reference: string;
        doneBy: string;
      }[];
    };
    return (
      <>
        <h2 className="font-semibold mb-2">Stock movement</h2>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="text-left p-2 border">Date</th>
                <th className="text-left p-2 border">Type</th>
                <th className="text-left p-2 border">SKU</th>
                <th className="text-left p-2 border">Brand</th>
                <th className="text-left p-2 border">Movement</th>
                <th className="text-right p-2 border">Qty</th>
                <th className="text-left p-2 border">Reason</th>
                <th className="text-left p-2 border">Ref</th>
                <th className="text-left p-2 border">By</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border text-xs whitespace-nowrap">{new Date(row.date).toLocaleString()}</td>
                  <td className="p-2 border">{row.itemType}</td>
                  <td className="p-2 border font-mono text-xs">{row.sku}</td>
                  <td className="p-2 border">{row.brand}</td>
                  <td className="p-2 border">{row.movementType}</td>
                  <td className="p-2 border text-right">{row.qty}</td>
                  <td className="p-2 border">{row.reason}</td>
                  <td className="p-2 border">{row.reference}</td>
                  <td className="p-2 border">{row.doneBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (report === "outstanding") {
    const p = payload as {
      data: {
        patient: string;
        phone: string;
        orderNo: string;
        orderDate: string;
        totalPaise: number;
        advancePaise: number;
        balancePaise: number;
        daysSinceOrder: number;
      }[];
      summary: { totalOutstandingPaise: number };
    };
    return (
      <>
        <h2 className="font-semibold mb-2">Outstanding balances</h2>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className="text-left p-2 border">Patient</th>
                <th className="text-left p-2 border">Phone</th>
                <th className="text-left p-2 border">Order</th>
                <th className="text-left p-2 border">Order date</th>
                <th className="text-right p-2 border">Total</th>
                <th className="text-right p-2 border">Advance</th>
                <th className="text-right p-2 border">Balance</th>
                <th className="text-right p-2 border">Days</th>
              </tr>
            </thead>
            <tbody>
              {p.data.map((row, i) => (
                <tr key={i}>
                  <td className="p-2 border">{row.patient}</td>
                  <td className="p-2 border">{row.phone}</td>
                  <td className="p-2 border font-mono text-xs">{row.orderNo}</td>
                  <td className="p-2 border">{row.orderDate}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.totalPaise)}</td>
                  <td className="p-2 border text-right">{formatInrPaiseDisplay(row.advancePaise)}</td>
                  <td className="p-2 border text-right font-medium">{formatInrPaiseDisplay(row.balancePaise)}</td>
                  <td className="p-2 border text-right">{row.daysSinceOrder}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="p-2 border font-medium" colSpan={6}>
                  Total outstanding
                </td>
                <td className="p-2 border text-right font-medium">{formatInrPaiseDisplay(p.summary.totalOutstandingPaise)}</td>
                <td className="p-2 border" />
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    );
  }

  return null;
}
