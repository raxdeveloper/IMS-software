import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { deletePrescription, getPrescription } from "../../api/prescriptions";
import { useAuth } from "../../auth/AuthContext";
import {
  PrescriptionFullDisplay,
  PrescriptionPrintChrome,
} from "../../components/rx/PrescriptionFullDisplay";
import type { PrescriptionRecord } from "../../types/prescription";

type Rx = Record<string, unknown> & {
  patient?: { id?: number; fullName?: string; dob?: string; patientCode?: string };
};

export function PrescriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rid = parseInt(id ?? "", 10);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "staff" || user?.role === "doctor";

  const [rx, setRx] = useState<Rx | null>(null);
  const [loading, setLoading] = useState(true);
  const [printRx, setPrintRx] = useState<PrescriptionRecord | null>(null);
  const [pdfRx, setPdfRx] = useState<PrescriptionRecord | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Number.isNaN(rid)) return;
    let c = false;
    void getPrescription(rid)
      .then((r) => {
        if (!c) setRx(r as Rx);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [rid]);

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

  async function runPdf(rec: PrescriptionRecord) {
    setPdfRx(rec);
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
          filename: `rx-${rec.rxNumber}.pdf`,
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
  }

  async function softDelete() {
    if (!confirm("Archive this prescription?")) return;
    try {
      await deletePrescription(rid);
      toast.success("Prescription archived");
      navigate(`/patients/${Number(rx?.patientId)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (Number.isNaN(rid)) return <p className="text-red-600">Invalid id</p>;
  if (loading || !rx) {
    return <div className="animate-pulse h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />;
  }

  const patient = rx.patient;
  const prx = rx as unknown as PrescriptionRecord;
  const patientName = patient?.fullName ?? "—";
  const patientDob = patient?.dob?.slice(0, 10) ?? "—";

  return (
    <div className="max-w-4xl space-y-6 print:max-w-none">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setPrintRx(prx)}
          className="rounded-lg bg-zinc-200 dark:bg-zinc-800 px-3 py-2 text-sm"
        >
          Print prescription
        </button>
        <button
          type="button"
          onClick={() => void runPdf(prx)}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
        >
          Download PDF
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm opacity-50"
          title="Coming soon"
        >
          Create order
        </button>
        {patient?.id && (
          <Link
            to={`/patients/${patient.id}`}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
          >
            Back to patient
          </Link>
        )}
        {patient?.id && (
          <Link
            to={`/patients/${patient.id}/prescriptions`}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm"
          >
            All prescriptions
          </Link>
        )}
        {canEdit && (
          <Link
            to={`/prescriptions/${rid}/edit`}
            className="rounded-lg bg-accent text-accent-foreground px-3 py-2 text-sm"
          >
            Edit Rx
          </Link>
        )}
        {isAdmin && (
          <button type="button" onClick={() => void softDelete()} className="text-sm text-red-600">
            Archive
          </button>
        )}
      </div>

      <div className="print:hidden">
        <PrescriptionFullDisplay rx={prx} patientName={patientName} patientDob={patientDob} />
      </div>

      {printRx && (
        <div className="rx-print-sheet">
          <PrescriptionPrintChrome
            doctorName={printRx.doctorName}
            nextVisitDate={printRx.nextVisitDate}
            patientAge={null}
          >
            <PrescriptionFullDisplay rx={printRx} patientName={patientName} patientDob={patientDob} hideNextVisit />
          </PrescriptionPrintChrome>
        </div>
      )}

      {pdfRx && (
        <div
          ref={pdfRef}
          className="pdf-capture-root fixed left-[-12000px] top-0 w-[148mm] bg-white p-4 text-black z-50"
          aria-hidden
        >
          <PrescriptionPrintChrome
            doctorName={pdfRx.doctorName}
            nextVisitDate={pdfRx.nextVisitDate}
            patientAge={null}
          >
            <PrescriptionFullDisplay rx={pdfRx} patientName={patientName} patientDob={patientDob} hideNextVisit />
          </PrescriptionPrintChrome>
        </div>
      )}

      <footer className="text-xs text-zinc-500 print:hidden">
        Created by {String(rx.createdByName ?? "—")} · {String(rx.createdAt ?? "")}
      </footer>
    </div>
  );
}
