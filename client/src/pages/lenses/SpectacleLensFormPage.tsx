import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  createSpectacleLens,
  getSpectacleBrands,
  getSpectacleLens,
  listSpectacleStockMovements,
  suggestSpectacleSku,
  updateSpectacleLens,
} from "../../api/lenses";
import { COATINGS, LENS_INDEXES, SIDE_OPTIONS, SPECTACLE_LENS_TYPES, STOCK_UNITS } from "../../constants/lenses";
import { movementLabel } from "../../constants/frames";
import { parseRupeesToPaise } from "../../lib/moneyInr";
import { useAuth } from "../../auth/AuthContext";

type Tab = "details" | "history";

export function SpectacleLensFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = location.pathname === "/lenses/spectacle/new";
  const lid = !isNew && id ? parseInt(id, 10) : NaN;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";

  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(!isNew);
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [lensType, setLensType] = useState<(typeof SPECTACLE_LENS_TYPES)[number]>(SPECTACLE_LENS_TYPES[0]);
  const [lensIndex, setLensIndex] = useState<(typeof LENS_INDEXES)[number]>(LENS_INDEXES[0]);
  const [coating, setCoating] = useState<(typeof COATINGS)[number]>(COATINGS[0]);
  const [sphFrom, setSphFrom] = useState("-6.00");
  const [sphTo, setSphTo] = useState("+2.00");
  const [cylFrom, setCylFrom] = useState("-2.00");
  const [cylTo, setCylTo] = useState("0.00");
  const [side, setSide] = useState<(typeof SIDE_OPTIONS)[number]>("Pair");
  const [stockUnit, setStockUnit] = useState<(typeof STOCK_UNITS)[number]>("pair");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("5");
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hist, setHist] = useState<{ id: number; movementType: string; quantity: number; stockChange: number; reason: string; reference: string | null; createdAt: string; doneByName: string | null }[]>([]);

  useEffect(() => {
    void getSpectacleBrands().then((r) => setBrands(r.brands));
  }, []);

  useEffect(() => {
    if (isNew) {
      void suggestSpectacleSku().then((r) => setSku(r.sku));
      return;
    }
    if (Number.isNaN(lid)) return;
    let c = false;
    setLoading(true);
    void getSpectacleLens(lid)
      .then((f) => {
        if (c) return;
        setSku(f.sku);
        setBrand(f.brand);
        setLensType(f.lensType as (typeof SPECTACLE_LENS_TYPES)[number]);
        setLensIndex(f.lensIndex as (typeof LENS_INDEXES)[number]);
        setCoating(f.coating as (typeof COATINGS)[number]);
        setSphFrom((f.sphFrom / 100).toFixed(2));
        setSphTo((f.sphTo / 100).toFixed(2));
        setCylFrom((f.cylFrom / 100).toFixed(2));
        setCylTo((f.cylTo / 100).toFixed(2));
        setSide(f.side as (typeof SIDE_OPTIONS)[number]);
        setStockUnit(f.stockUnit as (typeof STOCK_UNITS)[number]);
        setPurchasePrice((f.purchasePrice / 100).toFixed(2));
        setSellingPrice((f.sellingPrice / 100).toFixed(2));
        setStockQty(String(f.stockQty));
        setReorderLevel(String(f.reorderLevel));
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
    void listSpectacleStockMovements(lid)
      .then((r) => setHist(r.data))
      .catch(() => toast.error("Failed to load history"));
  }, [tab, lid, isNew]);

  const pp = parseRupeesToPaise(purchasePrice);
  const sp = parseRupeesToPaise(sellingPrice);
  const priceWarn = pp !== null && sp !== null && sp < pp;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    const sf = parseRupeesToPaise(sphFrom);
    const st = parseRupeesToPaise(sphTo);
    const cf = parseRupeesToPaise(cylFrom);
    const ct = parseRupeesToPaise(cylTo);
    if (sf === null || st === null || cf === null || ct === null || pp === null || sp === null) {
      toast.error("Invalid numbers");
      return;
    }
    const sq = parseInt(stockQty, 10);
    const rl = parseInt(reorderLevel, 10);
    if (Number.isNaN(sq) || sq < 0 || Number.isNaN(rl) || rl < 0) {
      toast.error("Invalid stock / reorder");
      return;
    }
    const body = {
      sku: sku.trim(),
      brand: brand.trim(),
      lensType,
      lensIndex,
      coating,
      sphFrom: sf,
      sphTo: st,
      cylFrom: cf,
      cylTo: ct,
      side,
      stockUnit,
      purchasePrice: pp,
      sellingPrice: sp,
      stockQty: sq,
      reorderLevel: rl,
      supplierName: supplierName.trim() || null,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      if (isNew) {
        await createSpectacleLens(body);
        toast.success("Lens created");
        navigate("/lenses?tab=spectacle");
      } else {
        await updateSpectacleLens(lid, body);
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
        <h1 className="text-xl font-semibold">{isNew ? "Add spectacle lens" : "Edit spectacle lens"}</h1>
        <Link to="/lenses?tab=spectacle" className="text-sm text-accent">
          ← Back
        </Link>
      </div>

      {!isNew && (
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2">
          <button
            type="button"
            onClick={() => setTab("details")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "details" ? "border-accent text-accent/90" : "border-transparent text-zinc-500"
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "history" ? "border-accent text-accent/90" : "border-transparent text-zinc-500"
            }`}
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
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  disabled={readOnly}
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 font-mono text-sm"
                  required
                />
                {isNew && canWrite && (
                  <button type="button" onClick={() => void suggestSpectacleSku().then((r) => setSku(r.sku))} className="text-xs border rounded px-2">
                    Regenerate
                  </button>
                )}
              </div>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Brand</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} list="spec-brands" disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
              <datalist id="spec-brands">
                {brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Lens type</span>
              <select value={lensType} onChange={(e) => setLensType(e.target.value as (typeof SPECTACLE_LENS_TYPES)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {SPECTACLE_LENS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Index</span>
              <select value={lensIndex} onChange={(e) => setLensIndex(e.target.value as (typeof LENS_INDEXES)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {LENS_INDEXES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Coating</span>
              <select value={coating} onChange={(e) => setCoating(e.target.value as (typeof COATINGS)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {COATINGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">SPH from (D)</span>
              <input value={sphFrom} onChange={(e) => setSphFrom(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">SPH to (D)</span>
              <input value={sphTo} onChange={(e) => setSphTo(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">CYL from (D)</span>
              <input value={cylFrom} onChange={(e) => setCylFrom(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">CYL to (D)</span>
              <input value={cylTo} onChange={(e) => setCylTo(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Side</span>
              <select value={side} onChange={(e) => setSide(e.target.value as (typeof SIDE_OPTIONS)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {SIDE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Stock unit</span>
              <select value={stockUnit} onChange={(e) => setStockUnit(e.target.value as (typeof STOCK_UNITS)[number])} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                {STOCK_UNITS.map((t) => (
                  <option key={t} value={t}>
                    {t === "pair" ? "Pair" : "Each (single lens)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Purchase (NPR)</span>
              <input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Selling (NPR)</span>
              <input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm tabular-nums" required />
            </label>
            {priceWarn && <p className="sm:col-span-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">Selling below purchase — confirm if intentional.</p>}
            <label className="text-sm">
              <span className="text-zinc-500">Stock qty</span>
              <input type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Reorder level</span>
              <input type="number" min={0} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} disabled={readOnly} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" required />
            </label>
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
