import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  createContactLens,
  getContactBrands,
  getContactLens,
  listContactStockMovements,
  suggestContactSku,
  updateContactLens,
} from "../../api/lenses";
import { COLOR_TYPES, CONTACT_MODALITIES, CONTACT_TYPES } from "../../constants/lenses";
import { movementLabel } from "../../constants/frames";
import { parseRupeesToPaise } from "../../lib/moneyInr";
import { useAuth } from "../../auth/AuthContext";

type BatchRow = { batchCode: string; expiryDate: string };
type Tab = "details" | "history";

export function ContactLensFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = location.pathname === "/lenses/contact/new";
  const lid = !isNew && id ? parseInt(id, 10) : NaN;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";

  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(!isNew);
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [contactType, setContactType] = useState<(typeof CONTACT_TYPES)[number]>("Spherical");
  const [modality, setModality] = useState<(typeof CONTACT_MODALITIES)[number]>("Monthly");
  const [power, setPower] = useState("-3.00");
  const [bc, setBc] = useState("8.6");
  const [dia, setDia] = useState("14.2");
  const [colorType, setColorType] = useState<(typeof COLOR_TYPES)[number]>("Clear");
  const [colorName, setColorName] = useState("");
  const [boxQty, setBoxQty] = useState("6");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("5");
  const [expiryTracking, setExpiryTracking] = useState(false);
  const [batches, setBatches] = useState<BatchRow[]>([{ batchCode: "", expiryDate: "" }]);
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hist, setHist] = useState<
    { id: number; movementType: string; quantity: number; stockChange: number; reason: string; createdAt: string; doneByName: string | null }[]
  >([]);

  useEffect(() => {
    void getContactBrands().then((r) => setBrands(r.brands));
  }, []);

  useEffect(() => {
    if (isNew) {
      void suggestContactSku().then((r) => setSku(r.sku));
      return;
    }
    if (Number.isNaN(lid)) return;
    let c = false;
    setLoading(true);
    void getContactLens(lid)
      .then((f) => {
        if (c) return;
        setSku(f.sku);
        setBrand(f.brand);
        setContactType(f.contactType as (typeof CONTACT_TYPES)[number]);
        setModality(f.modality as (typeof CONTACT_MODALITIES)[number]);
        setPower((f.power / 100).toFixed(2));
        setBc(f.bc);
        setDia(f.dia);
        setColorType(f.colorType as (typeof COLOR_TYPES)[number]);
        setColorName(f.colorName ?? "");
        setBoxQty(String(f.boxQty));
        setPurchasePrice((f.purchasePrice / 100).toFixed(2));
        setSellingPrice((f.sellingPrice / 100).toFixed(2));
        setStockQty(String(f.stockQty));
        setReorderLevel(String(f.reorderLevel));
        setExpiryTracking(f.expiryTracking);
        setBatches(
          f.batches.length ? f.batches.map((b) => ({ batchCode: b.batchCode, expiryDate: b.expiryDate })) : [{ batchCode: "", expiryDate: "" }],
        );
        setSupplierName(f.supplierName ?? "");
        setNotes(f.notes ?? "");
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [isNew, lid]);

  useEffect(() => {
    if (tab !== "history" || isNew || Number.isNaN(lid)) return;
    void listContactStockMovements(lid)
      .then((r) => setHist(r.data))
      .catch(() => toast.error("Failed to load history"));
  }, [tab, lid, isNew]);

  const pp = parseRupeesToPaise(purchasePrice);
  const sp = parseRupeesToPaise(sellingPrice);
  const pow = parseRupeesToPaise(power);
  const priceWarn = pp !== null && sp !== null && sp < pp;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    if (pow === null || pp === null || sp === null) {
      toast.error("Invalid power or prices");
      return;
    }
    const bq = parseInt(boxQty, 10);
    const sq = parseInt(stockQty, 10);
    const rl = parseInt(reorderLevel, 10);
    if (Number.isNaN(bq) || bq < 1 || Number.isNaN(sq) || sq < 0 || Number.isNaN(rl) || rl < 0) {
      toast.error("Invalid quantities");
      return;
    }
    if (colorType === "Colored" && !colorName.trim()) {
      toast.error("Color name required for colored lenses");
      return;
    }
    const batchPayload = batches
      .filter((b) => b.batchCode.trim() && b.expiryDate)
      .map((b) => ({ batchCode: b.batchCode.trim(), expiryDate: b.expiryDate }));
    if (expiryTracking && batchPayload.length === 0) {
      toast.error("Add at least one batch when expiry tracking is on");
      return;
    }
    const body: Record<string, unknown> = {
      sku: sku.trim(),
      brand: brand.trim(),
      contactType,
      modality,
      power: pow,
      bc: bc.trim(),
      dia: dia.trim(),
      colorType,
      colorName: colorType === "Colored" ? colorName.trim() : null,
      boxQty: bq,
      purchasePrice: pp,
      sellingPrice: sp,
      stockQty: sq,
      reorderLevel: rl,
      expiryTracking,
      supplierName: supplierName.trim() || null,
      notes: notes.trim() || null,
      batches: expiryTracking ? batchPayload : [],
    };
    setSaving(true);
    try {
      if (isNew) {
        await createContactLens(body);
        toast.success("Contact lens created");
        navigate("/lenses?tab=contact");
      } else {
        await updateContactLens(lid, body);
        toast.success("Saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && Number.isNaN(lid)) return <p className="text-red-600">Invalid id</p>;
  if (loading) return <div className="animate-pulse h-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl max-w-3xl" />;
  const readOnly = !canWrite;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-xl font-semibold">{isNew ? "Add contact lens" : "Edit contact lens"}</h1>
        <Link to="/lenses?tab=contact" className="text-sm text-accent">
          ← Back
        </Link>
      </div>

      {!isNew && (
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2">
          <button
            type="button"
            onClick={() => setTab("details")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "details" ? "border-accent text-accent/90" : "border-transparent text-zinc-500"}`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "history" ? "border-accent text-accent/90" : "border-transparent text-zinc-500"}`}
          >
            Stock History
          </button>
        </div>
      )}

      {tab === "history" && !isNew && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 text-sm">
          {hist.length === 0 ? (
            <p className="p-4 text-zinc-500">No movements</p>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">By</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((m) => (
                  <tr key={m.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{movementLabel(m.movementType)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {m.quantity} (Δ {m.stockChange > 0 ? "+" : ""}
                      {m.stockChange})
                    </td>
                    <td className="px-3 py-2">{m.reason}</td>
                    <td className="px-3 py-2">{m.doneByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {(isNew || tab === "details") && (
        <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-zinc-500">SKU</span>
              <div className="flex gap-2 mt-1">
                <input value={sku} onChange={(e) => setSku(e.target.value)} disabled={readOnly} className="flex-1 rounded-lg border px-3 py-2 font-mono text-sm" required />
                {isNew && canWrite && (
                  <button type="button" onClick={() => void suggestContactSku().then((r) => setSku(r.sku))} className="text-xs border rounded px-2">
                    Regenerate
                  </button>
                )}
              </div>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Brand</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} list="con-brands" disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
              <datalist id="con-brands">
                {brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Type</span>
              <select value={contactType} onChange={(e) => setContactType(e.target.value as (typeof CONTACT_TYPES)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {CONTACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Modality</span>
              <select value={modality} onChange={(e) => setModality(e.target.value as (typeof CONTACT_MODALITIES)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {CONTACT_MODALITIES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Power (D)</span>
              <input value={power} onChange={(e) => setPower(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">BC</span>
              <input value={bc} onChange={(e) => setBc(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">DIA</span>
              <input value={dia} onChange={(e) => setDia(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Color</span>
              <select value={colorType} onChange={(e) => setColorType(e.target.value as (typeof COLOR_TYPES)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {COLOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {colorType === "Colored" && (
              <label className="text-sm">
                <span className="text-zinc-500">Color name</span>
                <input value={colorName} onChange={(e) => setColorName(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            )}
            <label className="text-sm">
              <span className="text-zinc-500">Lenses per box</span>
              <input type="number" min={1} value={boxQty} onChange={(e) => setBoxQty(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Purchase / box (NPR)</span>
              <input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Selling / box (NPR)</span>
              <input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" required />
            </label>
            {priceWarn && <p className="sm:col-span-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Selling below purchase — confirm if intentional.</p>}
            <label className="text-sm">
              <span className="text-zinc-500">Stock (boxes)</span>
              <input type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Reorder level</span>
              <input type="number" min={0} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </label>
            <label className="text-sm sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={expiryTracking} onChange={(e) => setExpiryTracking(e.target.checked)} disabled={readOnly} />
              <span>Expiry tracking (batches)</span>
            </label>
            {expiryTracking && (
              <div className="sm:col-span-2 space-y-2">
                <p className="text-sm text-zinc-500">Batches</p>
                {batches.map((b, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-end">
                    <input
                      placeholder="Batch code"
                      value={b.batchCode}
                      onChange={(e) => {
                        const next = [...batches];
                        next[i] = { ...next[i]!, batchCode: e.target.value };
                        setBatches(next);
                      }}
                      disabled={readOnly}
                      className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-[120px]"
                    />
                    <input
                      type="date"
                      value={b.expiryDate}
                      onChange={(e) => {
                        const next = [...batches];
                        next[i] = { ...next[i]!, expiryDate: e.target.value };
                        setBatches(next);
                      }}
                      disabled={readOnly}
                      className="rounded-lg border px-3 py-2 text-sm"
                    />
                    {canWrite && batches.length > 1 && (
                      <button type="button" className="text-xs text-red-600" onClick={() => setBatches(batches.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {canWrite && (
                  <button type="button" className="text-sm text-accent" onClick={() => setBatches([...batches, { batchCode: "", expiryDate: "" }])}>
                    + Add batch
                  </button>
                )}
              </div>
            )}
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Supplier</span>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
            </label>
          </div>
          {canWrite && (
            <button type="submit" disabled={saving} className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium">
              {saving ? "Saving…" : isNew ? "Create" : "Save"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
