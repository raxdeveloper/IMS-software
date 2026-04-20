import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getPatient } from "../../api/patients";
import { getDoctors, getPrescription, updatePrescription } from "../../api/prescriptions";
import { PrescriptionEditor } from "./PrescriptionEditor";

export function PrescriptionEditPage() {
  const { id } = useParams();
  const rid = parseInt(id ?? "", 10);
  const navigate = useNavigate();
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [patientLabel, setPatientLabel] = useState("");
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Number.isNaN(rid)) return;
    let c = false;
    void getPrescription(rid)
      .then(async (rx) => {
        if (c) return;
        setInitial(rx as Record<string, unknown>);
        const pid = Number((rx as { patientId?: number }).patientId);
        const p = await getPatient(pid);
        if (!c) setPatientLabel(`${p.firstName} ${p.lastName} (${p.patientCode})`);
      })
      .catch(() => toast.error("Failed to load prescription"))
      .finally(() => {
        if (!c) setLoading(false);
      });
    void getDoctors().then((d) => {
      if (!c) setDoctors(d.doctors);
    });
    return () => {
      c = true;
    };
  }, [rid]);

  if (Number.isNaN(rid)) return <p className="text-red-600">Invalid prescription</p>;
  if (loading || !initial) {
    return <div className="animate-pulse h-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl max-w-4xl" />;
  }

  const rxNumber = String(initial.rxNumber ?? "");

  return (
    <div>
      <div className="mb-4">
        <Link to={`/prescriptions/${rid}`} className="text-sm text-accent">
          ← Back to prescription
        </Link>
      </div>
      <h1 className="text-xl font-semibold mb-6">Edit prescription</h1>
      <PrescriptionEditor
        patientId={Number(initial.patientId)}
        patientLabel={patientLabel}
        doctors={doctors}
        initial={initial}
        rxNumberReadonly={rxNumber}
        submitLabel="Update prescription"
        onSubmit={async (payload) => {
          await updatePrescription(rid, payload);
          toast.success(`Prescription ${rxNumber} updated`);
          navigate(`/prescriptions/${rid}`);
        }}
      />
    </div>
  );
}
