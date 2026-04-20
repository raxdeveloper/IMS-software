import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getPatient } from "../../api/patients";
import { createPrescription, getDoctors } from "../../api/prescriptions";
import { PrescriptionEditor } from "./PrescriptionEditor";

export function PrescriptionNewPage() {
  const [search] = useSearchParams();
  const patientId = parseInt(search.get("patient_id") ?? "", 10);
  const appointmentId = search.get("appointment_id") ? parseInt(search.get("appointment_id") ?? "", 10) : NaN;
  const navigate = useNavigate();
  const [label, setLabel] = useState("");
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Number.isNaN(patientId)) {
      setLoading(false);
      return;
    }
    let c = false;
    void Promise.all([getPatient(patientId), getDoctors()])
      .then(([p, d]) => {
        if (c) return;
        setLabel(`${p.firstName} ${p.lastName} (${p.patientCode})`);
        setDoctors(d.doctors);
      })
      .catch(() => toast.error("Could not load patient"))
      .finally(() => {
        if (!c) setLoading(false);
      });
    return () => {
      c = true;
    };
  }, [patientId]);

  if (Number.isNaN(patientId)) {
    return <p className="text-red-600">Missing or invalid patient_id</p>;
  }

  if (loading) {
    return <div className="animate-pulse h-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">New prescription</h1>
      <PrescriptionEditor
        patientId={patientId}
        patientLabel={label}
        doctors={doctors}
        submitLabel="Save prescription"
        onSubmit={async (payload) => {
          const row = await createPrescription({
            ...payload,
            ...(Number.isFinite(appointmentId) ? { appointmentId } : {}),
          });
          const num = Number((row as { id?: number }).id);
          const rx = String((row as { rxNumber?: string }).rxNumber ?? "");
          toast.success(`Prescription ${rx} saved successfully`);
          navigate(`/prescriptions/${num}`);
        }}
      />
    </div>
  );
}
