import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getPatient, listPatients } from "../../api/patients";
import { listPrescriptionsForPatient } from "../../api/prescriptions";
import { listFrames, type FrameRow } from "../../api/frames";
import { listSpectacleLenses, listContactLenses, matchLensesFromPrescription, type SpectacleLensRow, type ContactLensRow } from "../../api/lenses";
import { createOrder } from "../../api/orders";
import { getClinicSettings } from "../../api/settings";
import type { PatientRow } from "../../types/patient";
import { RX_MATCH_FIELDS } from "../../constants/lenses";
import { PAYMENT_MODES, PAYMENT_LABEL } from "../../constants/orders";
import { formatInrPaiseDisplay, parseRupeesToPaise } from "../../lib/moneyInr";
import { QuickAddPatientModal } from "../../components/patients/QuickAddPatientModal";

type SvcRow = { key: string; description: string; qty: number; unitRupees: string };
type PayRow = { key: string; amountRupees: string; mode: (typeof PAYMENT_MODES)[number]; reference: string };

function computeTotals(
  subtotalPaise: number,
  discountMode: "none" | "flat" | "percent",
  discountFlatPaise: number,
  discountPercent: number,
  gstPercent: number,
) {
  let taxable = subtotalPaise;
  if (discountMode === "flat") taxable = Math.max(0, subtotalPaise - discountFlatPaise);
  else if (discountMode === "percent") taxable = Math.max(0, subtotalPaise - Math.floor((subtotalPaise * discountPercent) / 100));
  const gst = Math.floor((taxable * gstPercent) / 100);
  const total = taxable + gst;
  return { taxablePaise: taxable, gstAmountPaise: gst, totalPaise: total };
}

export function OrderWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [quickAdd, setQuickAdd] = useState(false);

  const [patientSearch, setPatientSearch] = useState("");
  const [patientHits, setPatientHits] = useState<PatientRow[]>([]);
  const [patient, setPatient] = useState<PatientRow | null>(null);

  const [rxList, setRxList] = useState<Record<string, unknown>[]>([]);
  const [rxId, setRxId] = useState<number | null>(null);
  const [noRx, setNoRx] = useState(false);

  const [frameQ, setFrameQ] = useState("");
  const [frameHits, setFrameHits] = useState<FrameRow[]>([]);
  const [frame, setFrame] = useState<FrameRow | null>(null);
  const [noFrame, setNoFrame] = useState(false);
  const [frameQty, setFrameQty] = useState(1);

  const [specQ, setSpecQ] = useState("");
  const [specHits, setSpecHits] = useState<SpectacleLensRow[]>([]);
  const [specLines, setSpecLines] = useState<{ lens: SpectacleLensRow; qty: number }[]>([]);
  const [noSpec, setNoSpec] = useState(false);
  const [matchField, setMatchField] = useState<(typeof RX_MATCH_FIELDS)[number]["value"]>("dv_re");

  const [conQ, setConQ] = useState("");
  const [conHits, setConHits] = useState<ContactLensRow[]>([]);
  const [conLines, setConLines] = useState<{ lens: ContactLensRow; qty: number }[]>([]);
  const [noCon, setNoCon] = useState(false);

  const [services, setServices] = useState<SvcRow[]>([]);

  const [discountMode, setDiscountMode] = useState<"none" | "flat" | "percent">("none");
  const [discountFlat, setDiscountFlat] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [gstPercent, setGstPercent] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [labNotes, setLabNotes] = useState("");
  const [payRows, setPayRows] = useState<PayRow[]>([]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getClinicSettings().then((s) => setGstPercent(s.defaultGstPercent));
  }, []);

  useEffect(() => {
    if (patientSearch.trim().length < 2) {
      setPatientHits([]);
      return;
    }
    const t = setTimeout(() => {
      void listPatients({ search: patientSearch, limit: 15 }).then((r) => setPatientHits(r.data));
    }, 300);
    return () => clearTimeout(t);
  }, [patientSearch]);

  useEffect(() => {
    if (!patient) {
      setRxList([]);
      return;
    }
    void listPrescriptionsForPatient(patient.id, { limit: 50 }).then((r) => setRxList(r.data));
  }, [patient]);

  function searchFrames() {
    void listFrames({ q: frameQ || undefined, limit: 30 }).then((r) => setFrameHits(r.data));
  }
  function searchSpec() {
    void listSpectacleLenses({ q: specQ || undefined, limit: 30 }).then((r) => setSpecHits(r.data));
  }
  function searchCon() {
    void listContactLenses({ q: conQ || undefined, limit: 30 }).then((r) => setConHits(r.data));
  }

  async function runMatch() {
    if (!rxId) {
      toast.error("Select a prescription first");
      return;
    }
    try {
      const r = await matchLensesFromPrescription(rxId, matchField);
      setSpecHits(r.data);
      toast.success(`Found ${r.data.length} match(es) for Rx SPH/CYL`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Match failed");
    }
  }

  const lineSubtotalPaise = useMemo(() => {
    let s = 0;
    if (!noFrame && frame) s += frame.sellingPrice * frameQty;
    for (const l of specLines) s += l.lens.sellingPrice * l.qty;
    for (const c of conLines) s += c.lens.sellingPrice * c.qty;
    for (const sv of services) {
      const up = parseRupeesToPaise(sv.unitRupees);
      if (up !== null) s += up * sv.qty;
    }
    return s;
  }, [noFrame, frame, frameQty, specLines, conLines, services]);

  const billing = useMemo(() => {
    const flat = parseRupeesToPaise(discountFlat) ?? 0;
    const pct = parseInt(discountPct, 10) || 0;
    return computeTotals(lineSubtotalPaise, discountMode, flat, Math.min(100, Math.max(0, pct)), gstPercent);
  }, [lineSubtotalPaise, discountMode, discountFlat, discountPct, gstPercent]);

  function addService() {
    setServices((x) => [...x, { key: crypto.randomUUID(), description: "", qty: 1, unitRupees: "" }]);
  }
  function addPayRow() {
    setPayRows((x) => [...x, { key: crypto.randomUUID(), amountRupees: "", mode: "cash", reference: "" }]);
  }

  function validateStep(s: number): boolean {
    if (s === 1 && !patient) {
      toast.error("Select a patient");
      return false;
    }
    if (s === 2) {
      if (!noRx && !rxId) {
        toast.error("Select a prescription or choose No Rx on file");
        return false;
      }
      if (noRx && rxId) {
        toast.error("Clear prescription or uncheck No Rx");
        return false;
      }
    }
    if (s === 3) {
      const svcOk = services.some((sv) => {
        if (!sv.description.trim()) return false;
        const up = parseRupeesToPaise(sv.unitRupees);
        return up !== null && sv.qty >= 1;
      });
      const hasAny =
        (!noFrame && !!frame) ||
        (!noSpec && specLines.length > 0) ||
        (!noCon && conLines.length > 0) ||
        svcOk;
      if (!hasAny) {
        toast.error("Add at least one item (inventory or service)");
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((x) => Math.min(5, x + 1));
  }
  function back() {
    setStep((x) => Math.max(1, x - 1));
  }

  async function submit() {
    if (!patient) return;
    if (!validateStep(3)) return;
    const items: Record<string, unknown>[] = [];
    if (!noFrame && frame) {
      items.push({
        itemType: "frame",
        itemId: frame.id,
        description: `${frame.brand} ${frame.modelName} — ${frame.color} (${frame.size})`,
        qty: frameQty,
        unitPricePaise: frame.sellingPrice,
      });
    }
    for (const l of specLines) {
      items.push({
        itemType: "spectacle_lens",
        itemId: l.lens.id,
        description: `${l.lens.sku} ${l.lens.brand} ${l.lens.lensType} ${l.lens.lensIndex} (${l.lens.coating})`,
        qty: l.qty,
        unitPricePaise: l.lens.sellingPrice,
      });
    }
    for (const c of conLines) {
      items.push({
        itemType: "contact_lens",
        itemId: c.lens.id,
        description: `${c.lens.sku} ${c.lens.brand} ${c.lens.contactType} ${(c.lens.power / 100).toFixed(2)}D (box)`,
        qty: c.qty,
        unitPricePaise: c.lens.sellingPrice,
      });
    }
    for (const sv of services) {
      if (!sv.description.trim()) continue;
      const up = parseRupeesToPaise(sv.unitRupees);
      if (up === null) continue;
      items.push({
        itemType: "service",
        itemId: null,
        description: sv.description.trim(),
        qty: sv.qty,
        unitPricePaise: up,
      });
    }
    if (items.length === 0) {
      toast.error("No billable lines");
      return;
    }

    const payments: { amountPaise: number; paymentMode: string; reference: string | null }[] = [];
    for (const p of payRows) {
      const a = parseRupeesToPaise(p.amountRupees);
      if (a !== null && a > 0) {
        payments.push({ amountPaise: a, paymentMode: p.mode, reference: p.reference.trim() || null });
      }
    }

    const flat = parseRupeesToPaise(discountFlat) ?? 0;
    const pct = parseInt(discountPct, 10) || 0;

    setSaving(true);
    try {
      const created = await createOrder({
        patientId: patient.id,
        prescriptionId: noRx ? null : rxId,
        noRxOnFile: noRx,
        doctorName: null,
        items,
        discountMode,
        discountFlatPaise: flat,
        discountPercent: Math.min(100, Math.max(0, pct)),
        gstPercent,
        deliveryDate: deliveryDate ? `${deliveryDate}T12:00:00.000Z` : null,
        orderNotes: orderNotes.trim() || null,
        labInstructions: labNotes.trim() || null,
        payments,
      });
      toast.success("Order created");
      navigate(`/orders/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">New order</h1>
        <Link to="/orders" className="text-sm text-accent hover:underline">
          Back to list
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`rounded-full px-3 py-1 ${step === n ? "bg-accent text-accent-foreground" : step > n ? "bg-accent/15 text-zinc-900 dark:text-accent" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            {n}. {["Patient", "Prescription", "Items", "Billing", "Confirm"][n - 1]}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <p className="text-sm text-zinc-600">Search by name, phone, or patient ID.</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search patients…"
              className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
            />
            <button type="button" onClick={() => setQuickAdd(true)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
              Quick add patient
            </button>
          </div>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-72 overflow-y-auto">
            {patientHits.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPatient(p);
                    setPatientSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{p.firstName} {p.lastName}</span>{" "}
                  <span className="text-zinc-500 font-mono text-xs">{p.patientCode}</span> · {p.phone1}
                </button>
              </li>
            ))}
            {patientHits.length === 0 && patientSearch.length >= 2 && <li className="px-3 py-4 text-sm text-zinc-500">No matches</li>}
          </ul>
          {patient && (
            <div className="rounded-lg bg-accent/5 border border-accent/20 px-3 py-2 text-sm">
              Selected: <strong>{patient.firstName} {patient.lastName}</strong> ({patient.patientCode})
            </div>
          )}
        </div>
      )}

      {step === 2 && patient && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={noRx} onChange={(e) => { setNoRx(e.target.checked); if (e.target.checked) setRxId(null); }} />
            New Rx — no prescription on file
          </label>
          {!noRx && (
            <ul className="space-y-1 max-h-64 overflow-y-auto">
              {rxList.map((rx) => {
                const id = Number(rx.id);
                const num = String(rx.rxNumber ?? "");
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setRxId(id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${rxId === id ? "border-accent bg-accent/10" : "border-zinc-200"}`}
                    >
                      {num} · {String(rx.rxDate ?? "").slice(0, 10)} · {String(rx.doctorName ?? "")}
                    </button>
                  </li>
                );
              })}
              {rxList.length === 0 && <p className="text-sm text-zinc-500">No prescriptions for this patient.</p>}
            </ul>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="font-medium">Frame</h2>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={noFrame} onChange={(e) => { setNoFrame(e.target.checked); if (e.target.checked) setFrame(null); }} />
                No frame
              </label>
            </div>
            {!noFrame && (
              <>
                <div className="flex gap-2">
                  <input
                    value={frameQ}
                    onChange={(e) => setFrameQ(e.target.value)}
                    placeholder="Brand, SKU, model…"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => searchFrames()} className="rounded-lg border px-3 py-2 text-sm">
                    Search
                  </button>
                </div>
                <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                  {frameHits.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => setFrame(f)} className="w-full text-left rounded border px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        {f.brand} {f.modelName} · {f.color} · {formatInrPaiseDisplay(f.sellingPrice)} · stock {f.stockQty}
                      </button>
                    </li>
                  ))}
                </ul>
                {frame && (
                  <div className="flex flex-wrap gap-3 items-center text-sm">
                    <span>Selected: {frame.brand} {frame.modelName}</span>
                    <label>
                      Qty
                      <input
                        type="number"
                        min={1}
                        value={frameQty}
                        onChange={(e) => setFrameQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="ml-1 w-16 rounded border px-2 py-1 tabular-nums"
                      />
                    </label>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="font-medium">Spectacle lenses</h2>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={noSpec} onChange={(e) => { setNoSpec(e.target.checked); if (e.target.checked) setSpecLines([]); }} />
                No spectacle lenses
              </label>
            </div>
            {!noSpec && (
              <>
                <div className="flex flex-wrap gap-2 items-end">
                  <select
                    value={matchField}
                    onChange={(e) => setMatchField(e.target.value as (typeof RX_MATCH_FIELDS)[number]["value"])}
                    className="rounded-lg border px-2 py-2 text-sm"
                  >
                    {RX_MATCH_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void runMatch()} disabled={!rxId} className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm disabled:opacity-50">
                    Find matching lenses
                  </button>
                </div>
                <div className="flex gap-2">
                  <input value={specQ} onChange={(e) => setSpecQ(e.target.value)} placeholder="Manual search…" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
                  <button type="button" onClick={() => searchSpec()} className="rounded-lg border px-3 py-2 text-sm">
                    Search
                  </button>
                </div>
                <ul className="text-xs space-y-1 max-h-44 overflow-y-auto font-mono">
                  {specHits.map((l) => (
                    <li key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-1">
                      <span>
                        {l.sku} {l.sphRangeLabel} / {l.cylRangeLabel} · {formatInrPaiseDisplay(l.sellingPrice)}
                      </span>
                      <button
                        type="button"
                        className="text-accent font-sans"
                        onClick={() => {
                          if (specLines.some((x) => x.lens.id === l.id)) return;
                          setSpecLines((x) => [...x, { lens: l, qty: 1 }]);
                        }}
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
                {specLines.length > 0 && (
                  <div className="space-y-2">
                    {specLines.map((line) => (
                      <div key={line.lens.id} className="flex flex-wrap gap-2 items-center text-sm">
                        <span className="flex-1">{line.lens.sku}</span>
                        <label>
                          Pairs
                          <input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => {
                              const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setSpecLines((rows) => rows.map((r) => (r.lens.id === line.lens.id ? { ...r, qty: q } : r)));
                            }}
                            className="ml-1 w-14 rounded border px-1 tabular-nums"
                          />
                        </label>
                        <button type="button" className="text-red-600 text-xs" onClick={() => setSpecLines((r) => r.filter((x) => x.lens.id !== line.lens.id))}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="font-medium">Contact lenses</h2>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={noCon} onChange={(e) => { setNoCon(e.target.checked); if (e.target.checked) setConLines([]); }} />
                No contact lenses
              </label>
            </div>
            {!noCon && (
              <>
                <div className="flex gap-2">
                  <input value={conQ} onChange={(e) => setConQ(e.target.value)} placeholder="Brand, power, SKU…" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
                  <button type="button" onClick={() => searchCon()} className="rounded-lg border px-3 py-2 text-sm">
                    Search
                  </button>
                </div>
                <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                  {conHits.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2 border-b border-zinc-100 pb-1">
                      <span>
                        {l.sku} {(l.power / 100).toFixed(2)}D · {formatInrPaiseDisplay(l.sellingPrice)}/box · stock {l.stockQty}
                      </span>
                      <button
                        type="button"
                        className="text-accent"
                        onClick={() => {
                          if (conLines.some((x) => x.lens.id === l.id)) return;
                          setConLines((x) => [...x, { lens: l, qty: 1 }]);
                        }}
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
                {conLines.map((line) => (
                  <div key={line.lens.id} className="flex flex-wrap gap-2 items-center text-sm">
                    <span className="flex-1">{line.lens.sku}</span>
                    <label>
                      Boxes
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(e) => {
                          const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setConLines((rows) => rows.map((r) => (r.lens.id === line.lens.id ? { ...r, qty: q } : r)));
                        }}
                        className="ml-1 w-14 rounded border px-1 tabular-nums"
                      />
                    </label>
                    <button type="button" className="text-red-600 text-xs" onClick={() => setConLines((r) => r.filter((x) => x.lens.id !== line.lens.id))}>
                      Remove
                    </button>
                  </div>
                ))}
              </>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-medium">Services &amp; extras</h2>
              <button type="button" onClick={addService} className="text-sm text-accent">
                + Add row
              </button>
            </div>
            {services.map((sv) => (
              <div key={sv.key} className="flex flex-wrap gap-2 items-end">
                <input
                  value={sv.description}
                  onChange={(e) => setServices((rows) => rows.map((r) => (r.key === sv.key ? { ...r, description: e.target.value } : r)))}
                  placeholder="Description"
                  className="flex-1 min-w-[160px] rounded border px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={sv.qty}
                  onChange={(e) =>
                    setServices((rows) => rows.map((r) => (r.key === sv.key ? { ...r, qty: Math.max(1, parseInt(e.target.value, 10) || 1) } : r)))
                  }
                  className="w-16 rounded border px-2 py-1 text-sm"
                />
                <input
                  value={sv.unitRupees}
                  onChange={(e) => setServices((rows) => rows.map((r) => (r.key === sv.key ? { ...r, unitRupees: e.target.value } : r)))}
                  placeholder="रू unit"
                  className="w-28 rounded border px-2 py-1 text-sm tabular-nums"
                />
                <button type="button" className="text-red-600 text-xs" onClick={() => setServices((rows) => rows.filter((r) => r.key !== sv.key))}>
                  ✕
                </button>
              </div>
            ))}
          </section>
        </div>
      )}

      {step === 4 && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 text-sm">
          <div className="grid sm:grid-cols-2 gap-4">
            <label>
              <span className="text-xs text-zinc-500">Discount</span>
              <select value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "none" | "flat" | "percent")} className="mt-0.5 w-full rounded-lg border px-3 py-2">
                <option value="none">None</option>
                <option value="flat">Flat (रू)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </label>
            {discountMode === "flat" && (
              <label>
                <span className="text-xs text-zinc-500">Flat amount (NPR)</span>
                <input value={discountFlat} onChange={(e) => setDiscountFlat(e.target.value)} className="mt-0.5 w-full rounded-lg border px-3 py-2 tabular-nums" />
              </label>
            )}
            {discountMode === "percent" && (
              <label>
                <span className="text-xs text-zinc-500">Percent</span>
                <input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className="mt-0.5 w-full rounded-lg border px-3 py-2 tabular-nums" />
              </label>
            )}
            <label>
              <span className="text-xs text-zinc-500">GST %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={gstPercent}
                onChange={(e) => setGstPercent(Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                className="mt-0.5 w-full rounded-lg border px-3 py-2 tabular-nums"
              />
            </label>
            <label>
              <span className="text-xs text-zinc-500">Delivery date</span>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-0.5 w-full rounded-lg border px-3 py-2" />
            </label>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-1 tabular-nums">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatInrPaiseDisplay(lineSubtotalPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span>After discount / taxable</span>
              <span>{formatInrPaiseDisplay(billing.taxablePaise)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST ({gstPercent}%)</span>
              <span>{formatInrPaiseDisplay(billing.gstAmountPaise)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base border-t border-zinc-300 pt-1">
              <span>Total</span>
              <span>{formatInrPaiseDisplay(billing.totalPaise)}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Payments (part-payment: add multiple rows)</span>
              <button type="button" onClick={addPayRow} className="text-accent text-sm">
                + Payment
              </button>
            </div>
            {payRows.map((p) => (
              <div key={p.key} className="flex flex-wrap gap-2 mb-2">
                <input
                  value={p.amountRupees}
                  onChange={(e) => setPayRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, amountRupees: e.target.value } : r)))}
                  placeholder="Amount"
                  className="w-28 rounded border px-2 py-1 tabular-nums"
                />
                <select
                  value={p.mode}
                  onChange={(e) => setPayRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, mode: e.target.value as (typeof PAYMENT_MODES)[number] } : r)))}
                  className="rounded border px-2 py-1 text-sm"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_LABEL[m]}
                    </option>
                  ))}
                </select>
                <input
                  value={p.reference}
                  onChange={(e) => setPayRows((rows) => rows.map((r) => (r.key === p.key ? { ...r, reference: e.target.value } : r)))}
                  placeholder="Ref"
                  className="flex-1 min-w-[100px] rounded border px-2 py-1 text-sm"
                />
                <button type="button" className="text-red-600 text-xs" onClick={() => setPayRows((rows) => rows.filter((r) => r.key !== p.key))}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <label>
            <span className="text-xs text-zinc-500">Order notes</span>
            <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} rows={2} className="mt-0.5 w-full rounded-lg border px-3 py-2" />
          </label>
          <label>
            <span className="text-xs text-zinc-500">Lab instructions</span>
            <textarea value={labNotes} onChange={(e) => setLabNotes(e.target.value)} rows={2} className="mt-0.5 w-full rounded-lg border px-3 py-2" />
          </label>
        </div>
      )}

      {step === 5 && patient && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3 text-sm">
          <p>
            <strong>Patient:</strong> {patient.firstName} {patient.lastName} ({patient.patientCode})
          </p>
          <p>
            <strong>Prescription:</strong> {noRx ? "No Rx on file" : rxId ? `#${rxId}` : "—"}
          </p>
          <p>
            <strong>Total:</strong> {formatInrPaiseDisplay(billing.totalPaise)} (incl. VAT/GST)
          </p>
          <p className="text-zinc-600">Saving creates the order in Pending status. Stock is deducted when status moves to Sent to Lab.</p>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <button type="button" disabled={step <= 1} onClick={back} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">
          Back
        </button>
        {step < 5 ? (
          <button type="button" onClick={next} className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium">
            Continue
          </button>
        ) : (
          <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
            {saving ? "Saving…" : "Confirm & save"}
          </button>
        )}
      </div>

      <QuickAddPatientModal
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        onCreated={({ id }) => {
          void getPatient(id).then((p) => setPatient(p));
        }}
      />
    </div>
  );
}
