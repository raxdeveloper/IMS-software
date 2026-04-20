import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { getPatient, updatePatientForm } from "../../api/patients";
import { PatientForm, type PatientFormValues } from "../../components/patients/PatientForm";

export function PatientEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const pid = parseInt(id ?? "", 10);
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<(Partial<PatientFormValues> & { photoUrl?: string | null }) | null>(
    null,
  );
  const [code, setCode] = useState("");

  useEffect(() => {
    if (Number.isNaN(pid)) return;
    let cancelled = false;
    void getPatient(pid)
      .then((p) => {
        if (cancelled) return;
        setCode(p.patientCode);
        setInitial({
          firstName: p.firstName,
          middleName: p.middleName ?? "",
          lastName: p.lastName,
          dob: p.dob,
          gender: p.gender as PatientFormValues["gender"],
          bloodGroup: p.bloodGroup ?? "",
          phone1: p.phone1,
          phone2: p.phone2 ?? "",
          email: p.email ?? "",
          address: p.address ?? "",
          city: p.city ?? "",
          province: p.province ?? "",
          district: p.district ?? "",
          postalCode: p.postalCode ?? "",
          occupation: p.occupation ?? "",
          referredBy: p.referredBy ?? "",
          knownAllergies: p.knownAllergies ?? "",
          medicalHistory: p.medicalHistory ?? "",
          photoUrl: p.photoUrl,
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  if (Number.isNaN(pid)) {
    return <p className="text-red-600">Invalid patient</p>;
  }

  if (loading || !initial) {
    return (
      <div className="space-y-3 max-w-3xl animate-pulse">
        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
        <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link to={`/patients/${pid}`} className="text-accent">
          ← Back to profile
        </Link>
      </div>
      <h1 className="text-xl font-semibold mb-4">Edit patient</h1>
      <PatientForm
        mode="edit"
        patientCode={code}
        editingId={pid}
        initial={initial}
        submitLabel="Update patient"
        onSubmit={async (fd) => {
          await updatePatientForm(pid, fd);
          toast.success("Patient updated");
          navigate(`/patients/${pid}`);
        }}
      />
    </div>
  );
}
