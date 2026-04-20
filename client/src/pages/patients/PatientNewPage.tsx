import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createPatientForm } from "../../api/patients";
import { PatientForm } from "../../components/patients/PatientForm";

export function PatientNewPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Register patient</h1>
      <PatientForm
        mode="create"
        submitLabel="Register patient"
        onSubmit={async (fd) => {
          const row = await createPatientForm(fd);
          const name = `${row.firstName} ${row.lastName}`;
          toast.success(`Patient ${name} registered successfully — ${row.patientCode}`);
          navigate(`/patients/${row.id}`);
        }}
      />
    </div>
  );
}
