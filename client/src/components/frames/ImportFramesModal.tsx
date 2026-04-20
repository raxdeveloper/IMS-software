import { useState } from "react";
import { toast } from "sonner";
import { confirmImport, previewImport } from "../../api/frames";
import { CSV_TEMPLATE_HEADER } from "../../constants/frames";

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function ImportFramesModal({ open, onClose, onImported }: Props) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewImport>> | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function runPreview() {
    if (!csv.trim()) {
      toast.error("Paste CSV content or load a file");
      return;
    }
    setLoading(true);
    try {
      const p = await previewImport(csv);
      setPreview(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function runConfirm() {
    if (!preview) return;
    const payloads = preview.rows.filter((r) => r.valid && r.payload).map((r) => r.payload!);
    if (payloads.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setLoading(true);
    try {
      const res = await confirmImport(payloads);
      toast.success(`Imported ${res.imported}, skipped ${res.skipped}`);
      if (res.errors.length) toast.info(res.errors.slice(0, 5).join("; "));
      onImported();
      onClose();
      setCsv("");
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const sample = `${CSV_TEMPLATE_HEADER}\nFRM-00001,Acme,Model A,Black,52-18-140,Full Rim,Acetate,Unisex,500.00,899.00,10,5,Supplier Co,,,`;
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "frames-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50" role="dialog">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-700">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Import frames (CSV)</h2>
          <button type="button" onClick={onClose} className="text-sm rounded-lg border px-2 py-1">
            Close
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <button type="button" onClick={downloadTemplate} className="text-accent font-medium">
              Download sample template
            </button>{" "}
            — prices in rupees with decimals (e.g. 1250.00).
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="Paste CSV here…"
            rows={8}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-mono"
          />
          <div className="flex flex-wrap gap-2">
            <label className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm cursor-pointer">
              Load file
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  void f.text().then(setCsv);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void runPreview()}
              disabled={loading}
              className="rounded-lg bg-zinc-200 dark:bg-zinc-700 px-3 py-2 text-sm"
            >
              Preview
            </button>
          </div>

          {preview && (
            <div className="space-y-2">
              <p className="text-sm">
                Valid: <strong>{preview.summary.valid}</strong> · Invalid:{" "}
                <strong>{preview.summary.invalid}</strong> · Total lines: {preview.summary.total}
              </p>
              <div className="overflow-x-auto max-h-64 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="px-2 py-1">Line</th>
                      <th className="px-2 py-1">OK</th>
                      <th className="px-2 py-1">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.line} className="border-t border-zinc-200 dark:border-zinc-700">
                        <td className="px-2 py-1">{r.line}</td>
                        <td className="px-2 py-1">{r.valid ? "✓" : "—"}</td>
                        <td className="px-2 py-1 text-red-600 dark:text-red-400">{r.errors.join("; ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={loading || preview.summary.valid === 0}
                onClick={() => void runConfirm()}
                className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Import {preview.summary.valid} row(s)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
