import { useEffect, useMemo, useRef, useState } from "react";
import { encodePdMm } from "../../lib/optical";
import { OpticalInput } from "../../components/rx/OpticalInput";
import { RxTable, type EyeRow } from "../../components/rx/RxTable";
import { TransposedTable } from "../../components/rx/TransposedTable";
import { VAInput } from "../../components/rx/VAInput";
import { decodeOptical } from "../../utils/optical";
import { validatePrescription } from "../../utils/validation";

const LENS_TYPES = [
  "Single Vision",
  "Bifocal",
  "Progressive",
  "Reading Only",
  "No Change",
  "No Glasses",
] as const;

const FRAME_TYPES = ["Full Rim", "Half Rim", "Rimless", "Any", "Existing Frame"] as const;
const TINTS = ["Clear", "Light Tint", "Photochromic", "Polarized"] as const;

const COATINGS: { key: string; label: string }[] = [
  { key: "Anti-Reflective", label: "Anti-Reflective" },
  { key: "Hard Coat", label: "Hard Coat" },
  { key: "Blue Cut", label: "Blue Cut" },
  { key: "UV Protection", label: "UV Protection" },
  { key: "Scratch Resistant", label: "Scratch Resistant" },
];

const emptyEye = (): EyeRow => ({
  sph: 0,
  cyl: 0,
  axis: null,
  add: 0,
  va: "",
});

export type PrescriptionEditorProps = {
  patientId: number;
  patientLabel: string;
  doctors: { id: string; name: string }[];
  initial?: Record<string, unknown>;
  rxNumberReadonly?: string;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
};

function todayISODate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

export function PrescriptionEditor({
  patientId,
  patientLabel,
  doctors,
  initial,
  rxNumberReadonly,
  submitLabel,
  onSubmit,
}: PrescriptionEditorProps) {
  const [doctorName, setDoctorName] = useState(String(initial?.doctorName ?? ""));
  const [rxDate, setRxDate] = useState(String(initial?.rxDate ?? todayISODate()).slice(0, 10));
  const [rxTime, setRxTime] = useState(String(initial?.rxTime ?? nowTime()));
  const [chiefComplaint, setChiefComplaint] = useState(String(initial?.chiefComplaint ?? ""));
  const [vaReUn, setVaReUn] = useState(String(initial?.vaReUnaided ?? ""));
  const [vaLeUn, setVaLeUn] = useState(String(initial?.vaLeUnaided ?? ""));
  const [vaReA, setVaReA] = useState(String(initial?.vaReAided ?? ""));
  const [vaLeA, setVaLeA] = useState(String(initial?.vaLeAided ?? ""));

  const [dvRe, setDvRe] = useState<EyeRow>(() =>
    initial
      ? {
          sph: Number(initial.dvReSph ?? 0),
          cyl: Number(initial.dvReCyl ?? 0),
          axis:
            initial.dvReAxis === null || initial.dvReAxis === undefined
              ? null
              : Number(initial.dvReAxis),
          add: Number(initial.dvReAdd ?? 0),
          va: String(initial.dvReVa ?? ""),
        }
      : emptyEye(),
  );
  const [dvLe, setDvLe] = useState<EyeRow>(() =>
    initial
      ? {
          sph: Number(initial.dvLeSph ?? 0),
          cyl: Number(initial.dvLeCyl ?? 0),
          axis:
            initial.dvLeAxis === null || initial.dvLeAxis === undefined
              ? null
              : Number(initial.dvLeAxis),
          add: Number(initial.dvLeAdd ?? 0),
          va: String(initial.dvLeVa ?? ""),
        }
      : emptyEye(),
  );
  const [nvRe, setNvRe] = useState<EyeRow>(() =>
    initial
      ? {
          sph: Number(initial.nvReSph ?? 0),
          cyl: Number(initial.nvReCyl ?? 0),
          axis:
            initial.nvReAxis === null || initial.nvReAxis === undefined
              ? null
              : Number(initial.nvReAxis),
          add: Number(initial.nvReAdd ?? 0),
          va: String(initial.nvReVa ?? ""),
        }
      : emptyEye(),
  );
  const [nvLe, setNvLe] = useState<EyeRow>(() =>
    initial
      ? {
          sph: Number(initial.nvLeSph ?? 0),
          cyl: Number(initial.nvLeCyl ?? 0),
          axis:
            initial.nvLeAxis === null || initial.nvLeAxis === undefined
              ? null
              : Number(initial.nvLeAxis),
          add: Number(initial.nvLeAdd ?? 0),
          va: String(initial.nvLeVa ?? ""),
        }
      : emptyEye(),
  );

  const [pdType, setPdType] = useState<"binocular" | "monocular">(
    (initial?.pdType as "binocular" | "monocular") || "binocular",
  );
  const [pdBinMm, setPdBinMm] = useState(() => {
    const v = initial?.pdBinocular as number | undefined;
    return v != null ? v / 10 : 64;
  });
  const [pdReMm, setPdReMm] = useState(() => {
    const v = initial?.pdRe as number | undefined;
    return v != null ? v / 10 : 32;
  });
  const [pdLeMm, setPdLeMm] = useState(() => {
    const v = initial?.pdLe as number | undefined;
    return v != null ? v / 10 : 32;
  });

  const [prismOpen, setPrismOpen] = useState(
    !!(initial?.prismRePower || initial?.prismLePower || initial?.prismReBase || initial?.prismLeBase),
  );
  const [prismReP, setPrismReP] = useState(Number(initial?.prismRePower ?? 0));
  const [prismReB, setPrismReB] = useState(String(initial?.prismReBase ?? ""));
  const [prismLeP, setPrismLeP] = useState(Number(initial?.prismLePower ?? 0));
  const [prismLeB, setPrismLeB] = useState(String(initial?.prismLeBase ?? ""));

  const [lensType, setLensType] = useState(String(initial?.lensType ?? "Single Vision"));
  const [frameType, setFrameType] = useState(String(initial?.frameType ?? "Full Rim"));
  const [tint, setTint] = useState(String(initial?.tint ?? "Clear"));
  const [coatings, setCoatings] = useState<string[]>(() => {
    const c = initial?.coating;
    if (Array.isArray(c)) return c.map(String);
    return [];
  });

  const [doctorNotes, setDoctorNotes] = useState(String(initial?.doctorNotes ?? ""));
  const [nextVisit, setNextVisit] = useState(
    initial?.nextVisitDate ? String(initial.nextVisitDate).slice(0, 10) : "",
  );
  const [followup, setFollowup] = useState(String(initial?.followupReason ?? ""));

  const [busy, setBusy] = useState(false);
  const [summaryErr, setSummaryErr] = useState<string[]>([]);
  const [softWarnings, setSoftWarnings] = useState<string[]>([]);
  const prevReAddRef = useRef(nvRe.add);

  useEffect(() => {
    const prevRe = prevReAddRef.current;
    prevReAddRef.current = nvRe.add;
    setNvLe((le) => {
      if (le.add !== 0 && le.add !== prevRe) return le;
      return { ...le, add: nvRe.add };
    });
  }, [nvRe.add]);

  const anisoWarn =
    dvRe.sph !== 0 &&
    dvLe.sph !== 0 &&
    Math.abs(dvRe.sph - dvLe.sph) >= 250;

  const doctorOptions = useMemo(() => doctors.map((d) => d.name), [doctors]);

  function patchDv(eye: "re" | "le", p: Partial<EyeRow>) {
    if (eye === "re") setDvRe((s) => ({ ...s, ...p }));
    else setDvLe((s) => ({ ...s, ...p }));
  }
  function patchNv(eye: "re" | "le", p: Partial<EyeRow>) {
    if (eye === "re") setNvRe((s) => ({ ...s, ...p }));
    else setNvLe((s) => ({ ...s, ...p }));
  }

  function toggleCoating(k: string) {
    setCoatings((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  function buildPayload(): Record<string, unknown> {
    return {
      patientId,
      doctorName: doctorName.trim(),
      rxDate,
      rxTime,
      chiefComplaint: chiefComplaint || null,
      vaReUnaided: vaReUn || null,
      vaLeUnaided: vaLeUn || null,
      vaReAided: vaReA || null,
      vaLeAided: vaLeA || null,
      dvReSph: dvRe.sph,
      dvReCyl: dvRe.cyl,
      dvReAxis: dvRe.cyl === 0 ? null : dvRe.axis,
      dvReAdd: dvRe.add,
      dvReVa: dvRe.va || null,
      dvLeSph: dvLe.sph,
      dvLeCyl: dvLe.cyl,
      dvLeAxis: dvLe.cyl === 0 ? null : dvLe.axis,
      dvLeAdd: dvLe.add,
      dvLeVa: dvLe.va || null,
      nvReSph: nvRe.sph,
      nvReCyl: nvRe.cyl,
      nvReAxis: nvRe.cyl === 0 ? null : nvRe.axis,
      nvReAdd: nvRe.add,
      nvReVa: nvRe.va || null,
      nvLeSph: nvLe.sph,
      nvLeCyl: nvLe.cyl,
      nvLeAxis: nvLe.cyl === 0 ? null : nvLe.axis,
      nvLeAdd: nvLe.add,
      nvLeVa: nvLe.va || null,
      pdType,
      pdBinocular: pdType === "binocular" ? encodePdMm(pdBinMm) : null,
      pdRe: pdType === "monocular" ? encodePdMm(pdReMm) : null,
      pdLe: pdType === "monocular" ? encodePdMm(pdLeMm) : null,
      prismRePower: prismOpen ? prismReP : null,
      prismReBase: prismOpen && prismReB ? prismReB : null,
      prismLePower: prismOpen ? prismLeP : null,
      prismLeBase: prismOpen && prismLeB ? prismLeB : null,
      lensType,
      frameType: frameType || null,
      tint: tint || null,
      coating: coatings.length ? coatings : null,
      doctorNotes: doctorNotes || null,
      nextVisitDate: nextVisit || null,
      followupReason: followup || null,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSummaryErr([]);
    setSoftWarnings([]);
    const pv = {
      doctorName: doctorName.trim(),
      lensType,
      dvReSph: dvRe.sph,
      dvReCyl: dvRe.cyl,
      dvReAxis: dvRe.cyl === 0 ? null : dvRe.axis,
      dvReAdd: dvRe.add,
      dvLeSph: dvLe.sph,
      dvLeCyl: dvLe.cyl,
      dvLeAxis: dvLe.cyl === 0 ? null : dvLe.axis,
      dvLeAdd: dvLe.add,
      nvReSph: nvRe.sph,
      nvReCyl: nvRe.cyl,
      nvReAxis: nvRe.cyl === 0 ? null : nvRe.axis,
      nvReAdd: nvRe.add,
      nvLeSph: nvLe.sph,
      nvLeCyl: nvLe.cyl,
      nvLeAxis: nvLe.cyl === 0 ? null : nvLe.axis,
      nvLeAdd: nvLe.add,
      pdType,
      pdBinocular: pdType === "binocular" ? encodePdMm(pdBinMm) : null,
      pdRe: pdType === "monocular" ? encodePdMm(pdReMm) : null,
      pdLe: pdType === "monocular" ? encodePdMm(pdLeMm) : null,
      dvReVa: dvRe.va,
      dvLeVa: dvLe.va,
      nvReVa: nvRe.va,
      nvLeVa: nvLe.va,
    };
    const { valid, errors, warnings } = validatePrescription(pv);
    if (!valid) {
      setSummaryErr(errors);
      return;
    }
    setSoftWarnings(warnings);
    setBusy(true);
    try {
      await onSubmit(buildPayload());
    } catch (err) {
      const e = err as Error & { body?: { errors?: string[] } };
      const errs = e.body?.errors;
      if (errs?.length) setSummaryErr(errs);
      else setSummaryErr([err instanceof Error ? err.message : "Save failed"]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <p className="text-sm text-zinc-500">Patient</p>
        <p className="font-semibold text-lg">{patientLabel}</p>
        {rxNumberReadonly && (
          <p className="text-sm font-mono mt-1">
            RX <strong>{rxNumberReadonly}</strong>
          </p>
        )}
      </div>

      {summaryErr.length > 0 && (
        <div
          className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          <p className="font-medium">Please fix the following:</p>
          <ul className="list-disc pl-5 mt-2 space-y-0.5">
            {summaryErr.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {(softWarnings.length > 0 || anisoWarn) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-medium">Please confirm</p>
          <ul className="list-disc pl-5 mt-2 space-y-0.5">
            {anisoWarn && <li>Anisometropia detected — confirm RE vs LE sphere difference</li>}
            {softWarnings.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Appointment info
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">Doctor name *</label>
            <input
              required
              list="doctor-list"
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
            <datalist id="doctor-list">
              {doctorOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500">Date *</label>
              <input
                type="date"
                required
                className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
                value={rxDate}
                onChange={(e) => setRxDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Time *</label>
              <input
                type="time"
                step={1}
                className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
                value={rxTime.slice(0, 5)}
                onChange={(e) => setRxTime(e.target.value + ":00")}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Chief complaint</label>
          <textarea
            rows={3}
            className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 pb-1 mb-3">
          Visual acuity
        </h2>
        <div className="grid grid-cols-3 gap-2 text-xs text-center mb-1 max-w-lg">
          <div />
          <div className="text-sky-700 dark:text-sky-400 font-medium">RE</div>
          <div className="text-emerald-700 dark:text-emerald-400 font-medium">LE</div>
        </div>
        <div className="grid grid-cols-3 gap-2 items-center max-w-lg mb-2">
          <span className="text-xs text-zinc-500">Unaided</span>
          <VAInput re value={vaReUn} onChange={setVaReUn} />
          <VAInput value={vaLeUn} onChange={setVaLeUn} />
        </div>
        <div className="grid grid-cols-3 gap-2 items-center max-w-lg">
          <span className="text-xs text-zinc-500">Aided</span>
          <VAInput re value={vaReA} onChange={setVaReA} />
          <VAInput value={vaLeA} onChange={setVaLeA} />
        </div>
      </section>

      <section className="space-y-4">
        <RxTable label="Distance Vision (DV)" re={dvRe} le={dvLe} onChange={patchDv} />
        <TransposedTable
          reSph={dvRe.sph}
          reCyl={dvRe.cyl}
          reAxis={dvRe.axis}
          leSph={dvLe.sph}
          leCyl={dvLe.cyl}
          leAxis={dvLe.axis}
        />
        <RxTable label="Near Vision (NV)" re={nvRe} le={nvLe} onChange={patchNv} />
        {(nvRe.add > 0 || nvLe.add > 0) && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs italic text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            <p className="font-medium not-italic text-zinc-700 dark:text-zinc-300 mb-1">NV SPH preview (DV + ADD)</p>
            <p>
              RE: {decodeOptical(dvRe.sph)} + {decodeOptical(nvRe.add)} → {decodeOptical(dvRe.sph + nvRe.add)} (editable
              above)
            </p>
            <p>
              LE: {decodeOptical(dvLe.sph)} + {decodeOptical(nvLe.add)} → {decodeOptical(dvLe.sph + nvLe.add)}
            </p>
          </div>
        )}
        <p className="text-xs text-zinc-500">LE ADD: copied from RE when LE ADD is 0 — override LE ADD anytime.</p>
        <TransposedTable
          reSph={nvRe.sph}
          reCyl={nvRe.cyl}
          reAxis={nvRe.axis}
          leSph={nvLe.sph}
          leCyl={nvLe.cyl}
          leAxis={nvLe.axis}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 pb-1">PD</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="pd"
              checked={pdType === "binocular"}
              onChange={() => setPdType("binocular")}
            />
            Binocular
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="pd"
              checked={pdType === "monocular"}
              onChange={() => setPdType("monocular")}
            />
            Monocular
          </label>
        </div>
        {pdType === "binocular" ? (
          <label className="text-sm">
            PD (mm)
            <input
              type="number"
              step={0.5}
              min={50}
              max={80}
              className="ml-2 w-24 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1"
              value={pdBinMm}
              onChange={(e) => setPdBinMm(parseFloat(e.target.value) || 0)}
            />
          </label>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-4">
              <label className="text-sm">
                RE PD (mm)
                <input
                  type="number"
                  step={0.5}
                  min={25}
                  max={45}
                  className="ml-2 w-24 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1"
                  value={pdReMm}
                  onChange={(e) => setPdReMm(parseFloat(e.target.value) || 0)}
                />
              </label>
              <label className="text-sm">
                LE PD (mm)
                <input
                  type="number"
                  step={0.5}
                  min={25}
                  max={45}
                  className="ml-2 w-24 rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1"
                  value={pdLeMm}
                  onChange={(e) => setPdLeMm(parseFloat(e.target.value) || 0)}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">Total (RE + LE): {(pdReMm + pdLeMm).toFixed(1)} mm</p>
          </div>
        )}
      </section>

      <section>
        <button
          type="button"
          className="text-sm text-accent font-medium"
          onClick={() => setPrismOpen((o) => !o)}
        >
          {prismOpen ? "− Hide prism" : "+ Add prism"}
        </button>
        {prismOpen && (
          <div className="mt-3 grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-sky-700">RE</p>
              <div className="text-xs text-zinc-500 mb-0.5">Power (Δ)</div>
              <OpticalInput
                value={prismReP}
                onChange={setPrismReP}
                min={-1000}
                max={1000}
                disabled={false}
              />
              <select
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-sm"
                value={prismReB}
                onChange={(e) => setPrismReB(e.target.value)}
              >
                <option value="">Base…</option>
                <option>Base In</option>
                <option>Base Out</option>
                <option>Base Up</option>
                <option>Base Down</option>
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-700">LE</p>
              <OpticalInput
                value={prismLeP}
                onChange={setPrismLeP}
                min={-1000}
                max={1000}
              />
              <select
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-sm"
                value={prismLeB}
                onChange={(e) => setPrismLeB(e.target.value)}
              >
                <option value="">Base…</option>
                <option>Base In</option>
                <option>Base Out</option>
                <option>Base Up</option>
                <option>Base Down</option>
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Recommendations
        </h2>
        <fieldset>
          <legend className="text-xs text-zinc-500 mb-1">Lens type *</legend>
          <div className="flex flex-wrap gap-2">
            {LENS_TYPES.map((lt) => (
              <label key={lt} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="lens"
                  required
                  checked={lensType === lt}
                  onChange={() => setLensType(lt)}
                />
                {lt}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs text-zinc-500 mb-1">Frame type</legend>
          <div className="flex flex-wrap gap-2">
            {FRAME_TYPES.map((ft) => (
              <label key={ft} className="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="frame"
                  checked={frameType === ft}
                  onChange={() => setFrameType(ft)}
                />
                {ft}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs text-zinc-500 mb-1">Tint</legend>
          <div className="flex flex-wrap gap-2">
            {TINTS.map((t) => (
              <label key={t} className="flex items-center gap-1 text-sm">
                <input type="radio" name="tint" checked={tint === t} onChange={() => setTint(t)} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <p className="text-xs text-zinc-500 mb-1">Coating (multi-select)</p>
          <div className="flex flex-wrap gap-3">
            {COATINGS.map((c) => (
              <label key={c.key} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={coatings.includes(c.key)}
                  onChange={() => toggleCoating(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold border-b border-zinc-200 dark:border-zinc-700 pb-1">Notes</h2>
        <textarea
          rows={4}
          placeholder="Any special instructions, findings, or recommendations..."
          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
          value={doctorNotes}
          onChange={(e) => setDoctorNotes(e.target.value)}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500">Next visit date</label>
            <input
              type="date"
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={nextVisit}
              onChange={(e) => setNextVisit(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Follow-up reason</label>
            <input
              className="mt-0.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-2 py-2 text-sm"
              value={followup}
              onChange={(e) => setFollowup(e.target.value)}
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent hover:brightness-95 text-accent-foreground px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
