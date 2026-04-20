import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import imageCompression from "browser-image-compression";
import { checkPhone } from "../../api/patients";
import { calculateAge } from "../../lib/patientUtils";
import { getDistrictsByProvince, NEPAL_CITIES, NEPAL_PROVINCES, isValidNepalPhone } from "../../utils/nepal";
import { PatientAvatar } from "./PatientAvatar";

export type PatientFormValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  gender: "Male" | "Female" | "Other";
  bloodGroup: string;
  phone1: string;
  phone2: string;
  email: string;
  address: string;
  city: string;
  province: string;
  district: string;
  postalCode: string;
  occupation: string;
  referredBy: string;
  knownAllergies: string;
  medicalHistory: string;
};

const empty: PatientFormValues = {
  firstName: "",
  middleName: "",
  lastName: "",
  dob: "",
  gender: "Male",
  bloodGroup: "",
  phone1: "",
  phone2: "",
  email: "",
  address: "",
  city: "",
  province: "",
  district: "",
  postalCode: "",
  occupation: "",
  referredBy: "",
  knownAllergies: "",
  medicalHistory: "",
};

type Props = {
  mode: "create" | "edit";
  patientCode?: string;
  editingId?: number;
  initial?: Partial<PatientFormValues> & { photoUrl?: string | null };
  submitLabel: string;
  onSubmit: (fd: FormData) => Promise<void>;
};

function validatePhone1(v: string): string | undefined {
  const d = v.replace(/\D/g, "");
  if (!isValidNepalPhone(d)) return "Enter a valid Nepal mobile (10 digits: 96–98…) or landline";
  return undefined;
}

function validatePhone2(v: string): string | undefined {
  if (!v.trim()) return undefined;
  const d = v.replace(/\D/g, "");
  if (!isValidNepalPhone(d)) return "Invalid secondary phone";
  return undefined;
}

function validatePostal(v: string): string | undefined {
  if (!v.trim()) return undefined;
  if (!/^\d{5}$/.test(v.trim())) return "Postal code must be 5 digits";
  return undefined;
}

function validateEmail(v: string): string | undefined {
  if (!v.trim()) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Invalid email";
  return undefined;
}

function validateDob(dob: string): string | undefined {
  if (!dob) return "Required";
  const d = new Date(dob + "T12:00:00");
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return "Cannot be in the future";
  const oldest = new Date();
  oldest.setFullYear(oldest.getFullYear() - 120);
  if (d < oldest) return "Cannot be more than 120 years ago";
  return undefined;
}

export function PatientForm({ mode, patientCode, editingId, initial, submitLabel, onSubmit }: Props) {
  const [v, setV] = useState<PatientFormValues>(empty);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof PatientFormValues | "form", string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof PatientFormValues, boolean>>>({});
  const [dup, setDup] = useState<{ name: string; code: string; id: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setV({
      ...empty,
      ...initial,
      gender: (initial.gender as PatientFormValues["gender"]) || "Male",
    });
    if (initial.photoUrl) setPhotoPreview(initial.photoUrl.startsWith("http") ? initial.photoUrl : initial.photoUrl);
  }, [initial]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const age = v.dob ? calculateAge(v.dob) : null;

  const blur = useCallback(
    async (field: keyof PatientFormValues) => {
      setTouched((t) => ({ ...t, [field]: true }));
      let err: string | undefined;
      if (field === "phone1") err = validatePhone1(v.phone1);
      if (field === "phone2") err = validatePhone2(v.phone2);
      if (field === "postalCode") err = validatePostal(v.postalCode);
      if (field === "email") err = validateEmail(v.email);
      if (field === "dob") err = validateDob(v.dob);
      setErrors((e) => ({ ...e, [field]: err }));
      if (field === "phone1" && !err) {
        const d = v.phone1.replace(/\D/g, "");
        if (d.length >= 9) {
          try {
            const r = await checkPhone(d);
            if (r.exists && r.patient) {
              if (editingId !== undefined && r.patient.id === editingId) {
                setDup(null);
              } else {
                setDup({
                  id: r.patient.id,
                  code: r.patient.patientCode,
                  name: `${r.patient.firstName} ${r.patient.lastName}`,
                });
              }
            } else setDup(null);
          } catch {
            setDup(null);
          }
        } else setDup(null);
      }
    },
    [v, editingId],
  );

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 400,
      useWebWorker: true,
    });
    setPhotoFile(compressed);
    const url = URL.createObjectURL(compressed);
    setPhotoPreview(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Partial<typeof errors> = {};
    next.firstName = !v.firstName.trim() ? "Required" : undefined;
    next.lastName = !v.lastName.trim() ? "Required" : undefined;
    next.dob = validateDob(v.dob);
    next.phone1 = validatePhone1(v.phone1);
    next.phone2 = validatePhone2(v.phone2);
    next.postalCode = validatePostal(v.postalCode);
    next.email = validateEmail(v.email);
    setErrors(next);
    setTouched({
      firstName: true,
      lastName: true,
      dob: true,
      phone1: true,
      phone2: true,
      postalCode: true,
      email: true,
    });
    if (Object.values(next).some(Boolean)) return;

    const fd = new FormData();
    fd.append("firstName", v.firstName.trim());
    fd.append("middleName", v.middleName.trim());
    fd.append("lastName", v.lastName.trim());
    fd.append("dob", v.dob);
    fd.append("gender", v.gender);
    fd.append("bloodGroup", v.bloodGroup);
    fd.append("phone1", v.phone1.replace(/\D/g, ""));
    fd.append("phone2", v.phone2.replace(/\D/g, ""));
    fd.append("email", v.email.trim());
    fd.append("address", v.address);
    fd.append("city", v.city.trim());
    fd.append("province", v.province);
    fd.append("district", v.district.trim());
    fd.append("postalCode", v.postalCode.trim());
    fd.append("occupation", v.occupation.trim());
    fd.append("referredBy", v.referredBy.trim());
    fd.append("knownAllergies", v.knownAllergies);
    fd.append("medicalHistory", v.medicalHistory);
    fd.append("profileComplete", "true");
    if (photoFile) fd.append("photo", photoFile, photoFile.name || "photo.jpg");

    setBusy(true);
    try {
      await onSubmit(fd);
    } finally {
      setBusy(false);
    }
  }

  function fieldErr(k: keyof PatientFormValues) {
    return touched[k] && errors[k] ? (
      <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">{errors[k]}</p>
    ) : null;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {mode === "edit" && patientCode && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-2 text-sm">
          Patient code: <strong>{patientCode}</strong>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Personal information
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-zinc-500">First name *</label>
            <input
              required
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.firstName}
              onChange={(e) => setV((s) => ({ ...s, firstName: e.target.value }))}
              onBlur={() => blur("firstName")}
            />
            {fieldErr("firstName")}
          </div>
          <div>
            <label className="text-xs text-zinc-500">Middle name</label>
            <input
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.middleName}
              onChange={(e) => setV((s) => ({ ...s, middleName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Last name *</label>
            <input
              required
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.lastName}
              onChange={(e) => setV((s) => ({ ...s, lastName: e.target.value }))}
              onBlur={() => blur("lastName")}
            />
            {fieldErr("lastName")}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-zinc-500">Date of birth *</label>
            <input
              type="date"
              required
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.dob}
              onChange={(e) => setV((s) => ({ ...s, dob: e.target.value }))}
              onBlur={() => blur("dob")}
            />
            {fieldErr("dob")}
          </div>
          <div>
            <label className="text-xs text-zinc-500">Age</label>
            <div className="mt-0.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 px-2 py-2 text-sm text-zinc-600 dark:text-zinc-400">
              {age !== null ? `${age} yrs` : "—"}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Blood group</label>
            <select
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.bloodGroup}
              onChange={(e) => setV((s) => ({ ...s, bloodGroup: e.target.value }))}
            >
              <option value="">—</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="text-xs text-zinc-500 mb-1">Gender *</legend>
          <div className="flex flex-wrap gap-3">
            {(["Male", "Female", "Other"] as const).map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="gender"
                  checked={v.gender === g}
                  onChange={() => setV((s) => ({ ...s, gender: g }))}
                />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Contact
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">Primary phone *</label>
            <input
              inputMode="numeric"
              maxLength={10}
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.phone1}
              onChange={(e) => setV((s) => ({ ...s, phone1: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
              onBlur={() => blur("phone1")}
            />
            {fieldErr("phone1")}
            {dup && (
              <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
                A patient with this phone already exists: {dup.name} ({dup.code}) —{" "}
                <Link className="underline" to={`/patients/${dup.id}`}>
                  View existing patient
                </Link>
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500">Secondary phone</label>
            <input
              inputMode="numeric"
              maxLength={10}
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.phone2}
              onChange={(e) => setV((s) => ({ ...s, phone2: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
              onBlur={() => blur("phone2")}
            />
            {fieldErr("phone2")}
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Email</label>
          <input
            type="email"
            className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            value={v.email}
            onChange={(e) => setV((s) => ({ ...s, email: e.target.value }))}
            onBlur={() => blur("email")}
          />
          {fieldErr("email")}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Address
        </h2>
        <div>
          <label className="text-xs text-zinc-500">Address</label>
          <textarea
            rows={3}
            className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            value={v.address}
            onChange={(e) => setV((s) => ({ ...s, address: e.target.value }))}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">Province</label>
            <select
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.province}
              onChange={(e) =>
                setV((s) => ({ ...s, province: e.target.value, district: "" }))
              }
            >
              <option value="">—</option>
              {NEPAL_PROVINCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">District</label>
            <select
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.district}
              onChange={(e) => setV((s) => ({ ...s, district: e.target.value }))}
              disabled={!v.province}
            >
              <option value="">—</option>
              {getDistrictsByProvince(v.province).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">City (autocomplete)</label>
            <input
              list="nepal-cities"
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.city}
              onChange={(e) => setV((s) => ({ ...s, city: e.target.value }))}
            />
            <datalist id="nepal-cities">
              {NEPAL_CITIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Postal code (5 digits)</label>
            <input
              inputMode="numeric"
              maxLength={5}
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.postalCode}
              onChange={(e) =>
                setV((s) => ({ ...s, postalCode: e.target.value.replace(/\D/g, "").slice(0, 5) }))
              }
              onBlur={() => blur("postalCode")}
            />
            {fieldErr("postalCode")}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Clinical
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">Occupation</label>
            <input
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.occupation}
              onChange={(e) => setV((s) => ({ ...s, occupation: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Referred by</label>
            <input
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={v.referredBy}
              onChange={(e) => setV((s) => ({ ...s, referredBy: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Known allergies</label>
          <textarea
            rows={2}
            className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            value={v.knownAllergies}
            onChange={(e) => setV((s) => ({ ...s, knownAllergies: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Medical history</label>
          <textarea
            rows={2}
            className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            value={v.medicalHistory}
            onChange={(e) => setV((s) => ({ ...s, medicalHistory: e.target.value }))}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Photo
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <PatientAvatar
            photoUrl={photoPreview}
            firstName={v.firstName || "?"}
            lastName={v.lastName || "?"}
            size="lg"
          />
          <label className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Upload photo
            <input type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
          </label>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent hover:brightness-95 text-accent-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
