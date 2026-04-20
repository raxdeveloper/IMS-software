import type { ClinicSettings } from "../../api/settings";
import { resolvePublicUrl } from "../../lib/apiOrigin";
import type { OrderDetail } from "../../api/orders";
import { formatInrPaiseDisplay } from "../../lib/moneyInr";
import { formatAxisDisplay, formatDiopter } from "../../lib/optical";
import { PAYMENT_LABEL } from "../../constants/orders";

function rxSummary(o: OrderDetail): string {
  const rx = o.prescription;
  if (!rx) return o.noRxOnFile ? "No prescription on file" : "—";
  const re = `RE: SPH ${formatDiopter(rx.dvReSph)} CYL ${formatDiopter(rx.dvReCyl)} Axis ${formatAxisDisplay(rx.dvReCyl, rx.dvReAxis)}`;
  const le = `LE: SPH ${formatDiopter(rx.dvLeSph)} CYL ${formatDiopter(rx.dvLeCyl)} Axis ${formatAxisDisplay(rx.dvLeCyl, rx.dvLeAxis)}`;
  return `${re} | ${le}`;
}

function paymentLine(payments: OrderDetail["payments"]): string {
  if (!payments.length) return "—";
  const parts: string[] = [];
  const byMode = new Map<string, number>();
  for (const p of payments) {
    byMode.set(p.paymentMode, (byMode.get(p.paymentMode) ?? 0) + p.amountPaise);
  }
  for (const [mode, paise] of byMode) {
    parts.push(`${PAYMENT_LABEL[mode] ?? mode} ${formatInrPaiseDisplay(paise)}`);
  }
  return parts.join(" + ");
}

type Props = {
  clinic: ClinicSettings;
  order: OrderDetail;
};

export function OrderInvoiceContent({ clinic, order }: Props) {
  const terms =
    clinic.invoiceTerms?.trim() || "Goods once sold are not returnable. Subject to clinic policies.";

  return (
    <div className="text-zinc-900 text-sm leading-relaxed max-w-[210mm] mx-auto">
      <div className="flex flex-wrap justify-between gap-4 border-b border-zinc-300 pb-4 mb-4">
        <div className="flex gap-3">
          {clinic.clinicLogoUrl ? (
            <img
              src={resolvePublicUrl(clinic.clinicLogoUrl) ?? clinic.clinicLogoUrl}
              alt=""
              className="h-14 w-auto object-contain"
            />
          ) : (
            <div className="h-14 w-14 rounded bg-zinc-200 flex items-center justify-center text-xs text-zinc-500">Logo</div>
          )}
          <div>
            <div className="text-lg font-semibold">{clinic.clinicName}</div>
            {clinic.clinicGstNumber && <div className="text-xs">GSTIN: {clinic.clinicGstNumber}</div>}
            {clinic.clinicAddress && <div className="text-xs whitespace-pre-line">{clinic.clinicAddress}</div>}
            <div className="text-xs mt-1">
              {[clinic.clinicPhone, clinic.clinicEmail].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tracking-wide">INVOICE</div>
          <div className="text-xs mt-1">
            Invoice No: <span className="font-mono font-semibold">{order.orderNumber}</span>
          </div>
          <div className="text-xs">Date: {new Date(order.createdAt).toLocaleDateString("en-IN")}</div>
          <div className="text-xs">
            Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("en-IN") : "—"}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="font-semibold text-xs uppercase text-zinc-500">Bill To</div>
        <div className="font-medium">{order.patient.fullName}</div>
        <div className="text-xs">{order.patient.phone1}</div>
        <div className="text-xs">
          {[order.patient.address, order.patient.city, order.patient.district, order.patient.province, order.patient.postalCode].filter(Boolean).join(", ")}
        </div>
      </div>

      <div className="mb-4 p-2 bg-zinc-50 rounded border border-zinc-200 text-xs">
        <span className="font-semibold">Rx summary: </span>
        {rxSummary(order)}
      </div>

      <table className="w-full text-xs border-collapse mb-4">
        <thead>
          <tr className="border-b border-zinc-400">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Item</th>
            <th className="text-right py-2 w-12">Qty</th>
            <th className="text-right py-2 w-24">Unit</th>
            <th className="text-right py-2 w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={it.id} className="border-b border-zinc-200">
              <td className="py-1.5 align-top">{i + 1}</td>
              <td className="py-1.5 align-top">{it.description}</td>
              <td className="py-1.5 text-right tabular-nums align-top">{it.qty}</td>
              <td className="py-1.5 text-right tabular-nums align-top">{formatInrPaiseDisplay(it.unitPricePaise)}</td>
              <td className="py-1.5 text-right tabular-nums align-top">{formatInrPaiseDisplay(it.amountPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-4">
        <div className="w-64 space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatInrPaiseDisplay(order.subtotalPaise)}</span>
          </div>
          {order.discountMode !== "none" && (
            <div className="flex justify-between text-red-700">
              <span>Discount</span>
              <span className="tabular-nums">
                −{formatInrPaiseDisplay(order.subtotalPaise - order.taxablePaise)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>GST ({order.gstPercent}%)</span>
            <span className="tabular-nums">{formatInrPaiseDisplay(order.gstAmountPaise)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-zinc-400 pt-1">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatInrPaiseDisplay(order.totalPaise)}</span>
          </div>
          <div className="flex justify-between">
            <span>Advance paid</span>
            <span className="tabular-nums">{formatInrPaiseDisplay(order.paidPaise)}</span>
          </div>
          <div className="flex justify-between font-semibold text-red-700">
            <span>Balance due</span>
            <span className="tabular-nums">{formatInrPaiseDisplay(order.balancePaise)}</span>
          </div>
        </div>
      </div>

      <div className="text-xs border-t border-zinc-300 pt-3 space-y-2">
        <div>
          <span className="font-semibold">Payment: </span>
          {paymentLine(order.payments)}
        </div>
        {order.labInstructions && (
          <div>
            <span className="font-semibold">Lab instructions: </span>
            {order.labInstructions}
          </div>
        )}
        <div className="text-zinc-600">{terms}</div>
        <div className="pt-6 flex justify-end">
          <span className="text-zinc-500">Signature: _______________________</span>
        </div>
      </div>
    </div>
  );
}
