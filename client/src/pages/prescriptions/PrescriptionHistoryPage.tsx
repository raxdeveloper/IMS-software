import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getPatient } from "../../api/patients";
import { listPrescriptionsForPatient } from "../../api/prescriptions";
import {
  PrescriptionFullDisplay,
  PrescriptionPrintChrome,
} from "../../components/rx/PrescriptionFullDisplay";
import { formatDiopter } from "../../lib/optical";
import type { PatientDetail } from "../../types/patient";
import type { PrescriptionRecord } from "../../types/prescription";

function asRecord(row: unknown): PrescriptionRecord {
  return row as PrescriptionRecord;
}

export function PrescriptionHistoryPage() {
  const { id } = useParams();
  const pid = parseInt(id ?? "", 10);

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [rows, setRows] = useState<PrescriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [printRx, setPrintRx] = useState<PrescriptionRecord | null>(null);
  const [pdfRx, setPdfRx] = useState<PrescriptionRecord | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Number.isNaN(pid)) return;
    let c = false;
    setLoading(true);
    void Promise.all([getPatient(pid), listPrescriptionsForPatient(pid, { limit: 500, page: 1 })])
      .then(([p, res]) => {
        if (c) return;
        setPatient(p);
        setRows(res.data.map(asRecord));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [pid]);

  const patientName = patient
    ? [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ")
    : "";
  const patientDob = patient ? patient.dob.slice(0, 10) : "";

  const toggleExpand = (rid: number) => {
    setExpandedId((prev) => (prev === rid ? null : rid));
  };

  const rxById = (idNum: number) => rows.find((r) => r.id === idNum);

  useEffect(() => {
    if (!printRx) return;
    const onDone = () => setPrintRx(null);
    window.addEventListener("afterprint", onDone);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", onDone);
    };
  }, [printRx]);

  const runPdf = useCallback(async (rx: PrescriptionRecord) => {
    setPdfRx(rx);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const el = pdfRef.current;
    if (!el) {
      setPdfRx(null);
      toast.error("Could not prepare PDF");
      return;
    }
    try {
      const mod = await import("html2pdf.js");
      const html2pdf = mod.default;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `rx-${rx.rxNumber}.pdf`,
          image: { type: "jpeg", quality: 0.96 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a5", orientation: "portrait" },
        })
        .from(el)
        .save();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setPdfRx(null);
    }
  }, []);

  if (Number.isNaN(pid)) return <p className="text-red-600">Invalid patient</p>;

  if (loading || !patient) {
    return (
      <div className="animate-pulse space-y-4 max-w-5xl">
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
        <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    );
  }

  const compareA = selected[0] != null ? rxById(selected[0]) : undefined;
  const compareB = selected[1] != null ? rxById(selected[1]) : undefined;

  return (
    <>
      <div className="no-print max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Prescription history</h1>
          <p className="text-sm text-zinc-500">
            <Link to={`/patients/${patient.id}`} className="text-accent font-medium">
              {patientName}
            </Link>
            <span className="mx-2">·</span>
            {patient.patientCode}
          </p>
        </div>
        <Link
          to={`/prescriptions/new?patient_id=${patient.id}`}
          className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm font-medium hover:brightness-95"
        >
          New prescription
        </Link>
      </div>

      {selected.length === 2 && compareA && compareB && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCompareOpen(true)}
            className="rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-200"
          >
            Compare selected ({compareA.rxNumber} vs {compareB.rxNumber})
          </button>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="w-10 px-2 py-2" scope="col">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="px-3 py-2 font-medium">RX #</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Doctor</th>
                <th className="px-3 py-2 font-medium tabular-nums">DV RE SPH</th>
                <th className="px-3 py-2 font-medium tabular-nums">DV RE CYL</th>
                <th className="px-3 py-2 font-medium tabular-nums">DV LE SPH</th>
                <th className="px-3 py-2 font-medium tabular-nums">DV LE CYL</th>
                <th className="px-3 py-2 font-medium">Lens</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    No prescriptions on file
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const open = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleExpand(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpand(r.id);
                          }
                        }}
                        className={`border-t border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                          open ? "bg-accent/10 dark:bg-accent/5" : ""
                        }`}
                      >
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.includes(r.id)}
                            onChange={() =>
                              setSelected((prev) => {
                                if (prev.includes(r.id)) return prev.filter((x) => x !== r.id);
                                if (prev.length >= 2) return [prev[0], r.id];
                                return [...prev, r.id];
                              })
                            }
                            className="rounded border-zinc-400"
                            aria-label={`Select ${r.rxNumber} for comparison`}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono font-medium text-accent">
                          {r.rxNumber}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.rxDate}</td>
                        <td className="px-3 py-2">{r.doctorName}</td>
                        <td className="px-3 py-2 tabular-nums">{formatDiopter(r.dvReSph)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatDiopter(r.dvReCyl)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatDiopter(r.dvLeSph)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatDiopter(r.dvLeCyl)}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate" title={r.lensType}>
                          {r.lensType}
                        </td>
                      </tr>
                      {open && (
                        <tr key={`${r.id}-detail`} className="bg-zinc-50/80 dark:bg-zinc-900/40">
                          <td colSpan={9} className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">
                            <div className="space-y-4 max-w-4xl">
                              <PrescriptionFullDisplay
                                rx={r}
                                patientName={patientName}
                                patientDob={patientDob}
                              />
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrintRx(r);
                                  }}
                                  className="rounded-lg bg-zinc-200 dark:bg-zinc-700 px-3 py-2 text-sm font-medium"
                                >
                                  Print Rx
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void runPdf(r);
                                  }}
                                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium"
                                >
                                  Download PDF
                                </button>
                                <Link
                                  to={`/prescriptions/${r.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded-lg border border-accent text-accent px-3 py-2 text-sm font-medium"
                                >
                                  Open full page
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* Print template — screen: hidden; print: visible via CSS */}
      {printRx && (
        <div className="rx-print-sheet">
          <PrescriptionPrintChrome
            doctorName={printRx.doctorName}
            nextVisitDate={printRx.nextVisitDate}
            patientAge={patient.age}
          >
            <PrescriptionFullDisplay
              rx={printRx}
              patientName={patientName}
              patientDob={patientDob}
              hideNextVisit
            />
          </PrescriptionPrintChrome>
        </div>
      )}

      {/* Off-screen PDF capture */}
      {pdfRx && (
        <div
          ref={pdfRef}
          className="pdf-capture-root fixed left-[-12000px] top-0 w-[148mm] bg-white p-4 text-black z-50"
          aria-hidden
        >
          <PrescriptionPrintChrome
            doctorName={pdfRx.doctorName}
            nextVisitDate={pdfRx.nextVisitDate}
            patientAge={patient.age}
          >
            <PrescriptionFullDisplay
              rx={pdfRx}
              patientName={patientName}
              patientDob={patientDob}
              hideNextVisit
            />
          </PrescriptionPrintChrome>
        </div>
      )}

      {compareOpen && compareA && compareB && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 no-print"
          role="dialog"
          aria-modal
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Compare prescriptions</h2>
              <button
                type="button"
                onClick={() => setCompareOpen(false)}
                className="rounded-lg px-3 py-1 text-sm border border-zinc-300 dark:border-zinc-600"
              >
                Close
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs font-mono text-accent mb-2">{compareA.rxNumber}</p>
                <PrescriptionFullDisplay
                  rx={compareA}
                  patientName={patientName}
                  patientDob={patientDob}
                  diffAgainst={compareB}
                  compact
                />
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs font-mono text-accent mb-2">{compareB.rxNumber}</p>
                <PrescriptionFullDisplay
                  rx={compareB}
                  patientName={patientName}
                  patientDob={patientDob}
                  diffAgainst={compareA}
                  compact
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
