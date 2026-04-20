import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { createFrame, getBrands, getFrame, listStockMovements, suggestSku, updateFrame } from "../../api/frames";
import { FRAME_GENDERS, FRAME_MATERIALS, FRAME_TYPES, movementLabel } from "../../constants/frames";
import { parseRupeesToPaise } from "../../lib/moneyInr";
import { useAuth } from "../../auth/AuthContext";

type Tab = "details" | "history";

export function FrameFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const isNew = location.pathname === "/frames/new";
  const fid = !isNew && id ? parseInt(id, 10) : NaN;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = user?.role === "admin" || user?.role === "staff";

  const [tab, setTab] = useState<Tab>("details");
  const [loading, setLoading] = useState(!isNew);
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [frameType, setFrameType] = useState<string>(FRAME_TYPES[0]);
  const [material, setMaterial] = useState<string>(FRAME_MATERIALS[0]);
  const [gender, setGender] = useState<string>(FRAME_GENDERS[2]);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("5");
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [barcode, setBarcode] = useState("");
  const [notes, setNotes] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [hist, setHist] = useState<Awaited<ReturnType<typeof listStockMovements>>["data"]>([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    void getBrands().then((r) => setBrands(r.brands));
  }, []);

  useEffect(() => {
    if (isNew) {
      void suggestSku().then((r) => setSku(r.sku));
      return;
    }
    if (Number.isNaN(fid)) return;
    let c = false;
    setLoading(true);
    void getFrame(fid)
      .then((f) => {
        if (c) return;
        setSku(f.sku);
        setBrand(f.brand);
        setModelName(f.modelName);
        setColor(f.color);
        setSize(f.size);
        setFrameType(f.frameType);
        setMaterial(f.material);
        setGender(f.gender);
        setPurchasePrice((f.purchasePrice / 100).toFixed(2));
        setSellingPrice((f.sellingPrice / 100).toFixed(2));
        setStockQty(String(f.stockQty));
        setReorderLevel(String(f.reorderLevel));
        setSupplierName(f.supplierName ?? "");
        setSupplierContact(f.supplierContact ?? "");
        setBarcode(f.barcode ?? "");
        setNotes(f.notes ?? "");
      })
      .catch(() => toast.error("Failed to load frame"))
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [isNew, fid]);

  useEffect(() => {
    if (tab !== "history" || isNew || Number.isNaN(fid)) return;
    setHistLoading(true);
    void listStockMovements(fid, { limit: 100 })
      .then((r) => setHist(r.data))
      .catch(() => toast.error("Failed to load stock history"))
      .finally(() => setHistLoading(false));
  }, [tab, fid, isNew]);

  const pp = parseRupeesToPaise(purchasePrice);
  const sp = parseRupeesToPaise(sellingPrice);
  const priceWarning = pp !== null && sp !== null && sp < pp;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    if (pp === null || sp === null) {
      toast.error("Invalid prices");
      return;
    }
    const sq = parseInt(stockQty, 10);
    const rl = parseInt(reorderLevel, 10);
    if (Number.isNaN(sq) || sq < 0) {
      toast.error("Stock cannot be negative");
      return;
    }
    if (Number.isNaN(rl) || rl < 0) {
      toast.error("Invalid reorder level");
      return;
    }
    const body = {
      sku: sku.trim(),
      brand: brand.trim(),
      modelName: modelName.trim(),
      color: color.trim(),
      size: size.trim(),
      frameType,
      material,
      gender,
      purchasePrice: pp,
      sellingPrice: sp,
      stockQty: sq,
      reorderLevel: rl,
      supplierName: supplierName.trim() || null,
      supplierContact: supplierContact.trim() || null,
      barcode: barcode.trim() || null,
      notes: notes.trim() || null,
    };
    setSaving(true);
    try {
      if (isNew) {
        await createFrame(body);
        toast.success("Frame created");
        navigate("/frames");
      } else {
        await updateFrame(fid, body);
        toast.success("Frame saved");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && Number.isNaN(fid)) return <p className="text-red-600">Invalid id</p>;
  if (loading) {
    return <div className="animate-pulse h-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl max-w-3xl" />;
  }

  const readOnly = !canWrite;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{isNew ? "Add frame" : "Edit frame"}</h1>
        <Link to="/frames" className="text-sm text-accent">
          ← Back to list
        </Link>
      </div>

      {!isNew && (
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2">
          <button
            type="button"
            onClick={() => setTab("details")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "details" ? "border-accent text-accent" : "border-transparent text-zinc-500"
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "history" ? "border-accent text-accent" : "border-transparent text-zinc-500"
            }`}
          >
            Stock History
          </button>
        </div>
      )}

      {tab === "history" && !isNew && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
          {histLoading ? (
            <p className="p-4 text-sm text-zinc-500">Loading…</p>
          ) : hist.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">No movements yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Done by</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map((m) => (
                    <tr key={m.id} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{movementLabel(m.movementType)}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {m.stockChange > 0 ? "+" : ""}
                        {m.quantity}
                        <span className="text-zinc-500 text-xs ml-1">
                          (Δ {m.stockChange > 0 ? "+" : ""}
                          {m.stockChange})
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={m.reason}>
                        {m.reason}
                      </td>
                      <td className="px-3 py-2">{m.reference ?? "—"}</td>
                      <td className="px-3 py-2">{m.doneByName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-mono disabled:opacity-70"
                  required
                />
                {isNew && canWrite && (
                  <button
                    type="button"
                    onClick={() => void suggestSku().then((r) => setSku(r.sku))}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Brand</span>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                list="brand-suggestions"
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
                required
              />
              <datalist id="brand-suggestions">
                {brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Model name</span>
              <input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Color</span>
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Size (e.g. 52-18-140)</span>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Frame type</span>
              <select
                value={frameType}
                onChange={(e) => setFrameType(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
              >
                {FRAME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Material</span>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
              >
                {FRAME_MATERIALS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
              >
                {FRAME_GENDERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Purchase price (NPR)</span>
              <input
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                disabled={readOnly}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm tabular-nums disabled:opacity-70"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Selling price (NPR)</span>
              <input
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                disabled={readOnly}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm tabular-nums disabled:opacity-70"
                required
              />
            </label>
            {priceWarning && (
              <p className="sm:col-span-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                Selling price is below purchase price — please confirm this is intentional.
              </p>
            )}
            <label className="text-sm">
              <span className="text-zinc-500">Stock quantity</span>
              <input
                type="number"
                min={0}
                step={1}
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm tabular-nums disabled:opacity-70"
                required
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-500">Reorder level</span>
              <input
                type="number"
                min={0}
                step={1}
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm tabular-nums disabled:opacity-70"
                required
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Supplier name</span>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Supplier contact (optional)</span>
              <input
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Barcode (optional)</span>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-500">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={readOnly}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
          </div>
          {!isNew && (
            <p className="text-sm text-zinc-500">
              Current stock: <strong>{stockQty}</strong> — use <strong>Adjust stock</strong> from the list to record movements.
            </p>
          )}
          {canWrite && (
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : isNew ? "Create frame" : "Save changes"}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
