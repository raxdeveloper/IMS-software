import type { ReactNode } from "react";
import {
  decodeOptical,
  decodePdMm,
  formatAddDiopter,
  formatAxisDisplay,
  formatDiopter,
  transpose,
} from "../../lib/optical";
import type { PrescriptionRecord } from "../../types/prescription";

function pdLine(rx: PrescriptionRecord): string {
  if (rx.pdType === "monocular") {
    return `RE: ${decodePdMm(rx.pdRe)} mm | LE: ${decodePdMm(rx.pdLe)} mm (Monocular)`;
  }
  return `${decodePdMm(rx.pdBinocular)} mm (Binocular)`;
}

function RxRow({
  eye,
  sph,
  cyl,
  axis,
  add,
  va,
  diff,
}: {
  eye: string;
  sph: number;
  cyl: number;
  axis: number | null;
  add: number;
  va: string | null;
  diff?: { sph?: boolean; cyl?: boolean; axis?: boolean; add?: boolean; va?: boolean };
}) {
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-700 print:border-zinc-300">
      <td className="py-1.5 pr-2 font-medium">{eye}</td>
      <td className={`py-1.5 pr-2 tabular-nums ${diff?.sph ? "bg-yellow-200 print:bg-yellow-100" : ""}`}>
        {formatDiopter(sph)}
      </td>
      <td className={`py-1.5 pr-2 tabular-nums ${diff?.cyl ? "bg-yellow-200 print:bg-yellow-100" : ""}`}>
        {formatDiopter(cyl)}
      </td>
      <td className={`py-1.5 pr-2 ${diff?.axis ? "bg-yellow-200 print:bg-yellow-100" : ""}`}>
        {formatAxisDisplay(cyl, axis)}
      </td>
      <td className={`py-1.5 pr-2 tabular-nums ${diff?.add ? "bg-yellow-200 print:bg-yellow-100" : ""}`}>
        {formatAddDiopter(add)}
      </td>
      <td className={`py-1.5 ${diff?.va ? "bg-yellow-200 print:bg-yellow-100" : ""}`}>{va || "—"}</td>
    </tr>
  );
}

function TransposedRxRow({
  eye,
  sph,
  cyl,
  axis,
  addDisplay,
  va,
}: {
  eye: string;
  sph: number;
  cyl: number;
  axis: number | null;
  addDisplay: string;
  va: string | null;
}) {
  if (cyl === 0) {
    return (
      <tr className="border-t border-zinc-200 dark:border-zinc-700 print:border-zinc-300 italic text-zinc-600">
        <td className="py-1 pr-2">{eye}</td>
        <td colSpan={5} className="py-1">
          Spherical — no transposition
        </td>
      </tr>
    );
  }
  if (axis === null || axis === undefined) {
    return (
      <tr className="border-t border-zinc-200 dark:border-zinc-700 print:border-zinc-300 italic text-zinc-600">
        <td className="py-1 pr-2">{eye}</td>
        <td colSpan={5} className="py-1">
          —
        </td>
      </tr>
    );
  }
  const t = transpose(sph, cyl, axis);
  return (
    <tr className="border-t border-zinc-200 dark:border-zinc-700 print:border-zinc-300">
      <td className="py-1 pr-2 font-medium">{eye}</td>
      <td className="py-1 pr-2 tabular-nums">{formatDiopter(t.sph)}</td>
      <td className="py-1 pr-2 tabular-nums">{formatDiopter(t.cyl)}</td>
      <td className="py-1 pr-2">{t.axis === null ? "—" : String(t.axis)}</td>
      <td className="py-1 pr-2 tabular-nums">{addDisplay}</td>
      <td className="py-1">{va || "—"}</td>
    </tr>
  );
}

function visionDiff(
  a: PrescriptionRecord,
  b: PrescriptionRecord | undefined,
  side: "dv" | "nv",
  eye: "re" | "le",
): { sph?: boolean; cyl?: boolean; axis?: boolean; add?: boolean; va?: boolean } | undefined {
  if (!b) return undefined;
  const p = `${side}${eye === "re" ? "Re" : "Le"}` as const;
  const sphK = `${p}Sph` as keyof PrescriptionRecord;
  const cylK = `${p}Cyl` as keyof PrescriptionRecord;
  const axisK = `${p}Axis` as keyof PrescriptionRecord;
  const addK = `${p}Add` as keyof PrescriptionRecord;
  const vaK = `${p}Va` as keyof PrescriptionRecord;
  return {
    sph: Number(a[sphK]) !== Number(b[sphK]),
    cyl: Number(a[cylK]) !== Number(b[cylK]),
    axis: (a[axisK] as number | null) !== (b[axisK] as number | null),
    add: Number(a[addK]) !== Number(b[addK]),
    va: String(a[vaK] ?? "") !== String(b[vaK] ?? ""),
  };
}

export type PrescriptionFullDisplayProps = {
  rx: PrescriptionRecord;
  patientName: string;
  patientDob: string;
  /** Optional second Rx for side-by-side comparison highlighting */
  diffAgainst?: PrescriptionRecord;
  /** Extra class on outer wrapper */
  className?: string;
  /** Smaller typography */
  compact?: boolean;
  /** Hide the Next Visit row (e.g. when shown in print footer only) */
  hideNextVisit?: boolean;
};

export function PrescriptionFullDisplay({
  rx,
  patientName,
  patientDob,
  diffAgainst,
  className = "",
  compact = false,
  hideNextVisit = false,
}: PrescriptionFullDisplayProps) {
  const coating = Array.isArray(rx.coating) ? rx.coating.join(", ") : "";
  const text = compact ? "text-xs" : "text-sm";
  const box = "rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 print:border-zinc-300 print:bg-white overflow-x-auto";

  return (
    <div className={`space-y-4 ${text} ${className}`}>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 px-4 py-3 print:border-zinc-300">
        <p className="font-medium text-zinc-800 dark:text-zinc-100 print:text-black">
          Patient: {patientName} <span className="text-zinc-500 print:text-zinc-600">|</span> DOB: {patientDob}{" "}
          <span className="text-zinc-500 print:text-zinc-600">|</span> RX No:{" "}
          <span className="font-mono">{rx.rxNumber}</span> <span className="text-zinc-500 print:text-zinc-600">|</span>{" "}
          Date: {rx.rxDate}
        </p>
        <p className="mt-1 text-zinc-700 dark:text-zinc-300 print:text-black">
          Doctor: <span className="font-medium">{rx.doctorName}</span>
        </p>
      </div>

      {(rx.vaReUnaided || rx.vaLeUnaided || rx.vaReAided || rx.vaLeAided) && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 print:border-zinc-300">
          <p className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2 print:text-black">Visual acuity</p>
          <table className="text-sm w-full max-w-lg">
            <tbody>
              <tr>
                <td className="py-0.5 text-zinc-500 w-24">Unaided</td>
                <td className="py-0.5">RE {rx.vaReUnaided ?? "—"}</td>
                <td className="py-0.5">LE {rx.vaLeUnaided ?? "—"}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-zinc-500">Aided</td>
                <td className="py-0.5">RE {rx.vaReAided ?? "—"}</td>
                <td className="py-0.5">LE {rx.vaLeAided ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className={box}>
        <div className="bg-zinc-100 dark:bg-zinc-800 print:bg-zinc-100 px-3 py-2 text-center font-semibold text-zinc-800 dark:text-zinc-100 print:text-black border-b border-zinc-200 dark:border-zinc-700 print:border-zinc-300">
          DISTANCE VISION (DV)
        </div>
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="text-left text-zinc-500 dark:text-zinc-400 print:text-zinc-700">
              <th className="pl-3 pb-2 pt-2">Eye</th>
              <th className="pb-2">SPH</th>
              <th className="pb-2">CYL</th>
              <th className="pb-2">AXIS</th>
              <th className="pb-2">ADD</th>
              <th className="pr-3 pb-2">VA</th>
            </tr>
          </thead>
          <tbody>
            <RxRow
              eye="RE"
              sph={rx.dvReSph}
              cyl={rx.dvReCyl}
              axis={rx.dvReAxis}
              add={rx.dvReAdd}
              va={rx.dvReVa}
              diff={visionDiff(rx, diffAgainst, "dv", "re")}
            />
            <RxRow
              eye="LE"
              sph={rx.dvLeSph}
              cyl={rx.dvLeCyl}
              axis={rx.dvLeAxis}
              add={rx.dvLeAdd}
              va={rx.dvLeVa}
              diff={visionDiff(rx, diffAgainst, "dv", "le")}
            />
          </tbody>
        </table>
      </div>

      <div className={box}>
        <div className="bg-zinc-100 dark:bg-zinc-800 print:bg-zinc-100 px-3 py-2 text-center font-semibold text-zinc-800 dark:text-zinc-100 print:text-black border-b border-zinc-200 dark:border-zinc-700 print:border-zinc-300">
          NEAR VISION (NV)
        </div>
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="text-left text-zinc-500 dark:text-zinc-400 print:text-zinc-700">
              <th className="pl-3 pb-2 pt-2">Eye</th>
              <th className="pb-2">SPH</th>
              <th className="pb-2">CYL</th>
              <th className="pb-2">AXIS</th>
              <th className="pb-2">ADD</th>
              <th className="pr-3 pb-2">VA</th>
            </tr>
          </thead>
          <tbody>
            <RxRow
              eye="RE"
              sph={rx.nvReSph}
              cyl={rx.nvReCyl}
              axis={rx.nvReAxis}
              add={rx.nvReAdd}
              va={rx.nvReVa}
              diff={visionDiff(rx, diffAgainst, "nv", "re")}
            />
            <RxRow
              eye="LE"
              sph={rx.nvLeSph}
              cyl={rx.nvLeCyl}
              axis={rx.nvLeAxis}
              add={rx.nvLeAdd}
              va={rx.nvLeVa}
              diff={visionDiff(rx, diffAgainst, "nv", "le")}
            />
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/90 dark:bg-zinc-900/50 p-4 space-y-3 print:border-zinc-400">
        <p className="font-semibold text-zinc-800 dark:text-zinc-100 print:text-black">
          Transposed Form (auto-calculated)
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Minus- and plus-cylinder forms are equivalent; values below match the alternate notation.
        </p>

        <div className={box}>
          <div className="px-3 py-1.5 text-xs font-medium border-b border-zinc-200 dark:border-zinc-700 print:border-zinc-300">
            DV — transposed
          </div>
          <table className="w-full min-w-[520px] text-xs md:text-sm">
            <thead>
              <tr className="text-left text-zinc-500 print:text-zinc-700">
                <th className="pl-3 pb-1 pt-2">Eye</th>
                <th className="pb-1">SPH</th>
                <th className="pb-1">CYL</th>
                <th className="pb-1">AXIS</th>
                <th className="pb-1">ADD</th>
                <th className="pr-3 pb-1">VA</th>
              </tr>
            </thead>
            <tbody>
              <TransposedRxRow
                eye="RE"
                sph={rx.dvReSph}
                cyl={rx.dvReCyl}
                axis={rx.dvReAxis}
                addDisplay="—"
                va={rx.dvReVa}
              />
              <TransposedRxRow
                eye="LE"
                sph={rx.dvLeSph}
                cyl={rx.dvLeCyl}
                axis={rx.dvLeAxis}
                addDisplay="—"
                va={rx.dvLeVa}
              />
            </tbody>
          </table>
        </div>

        <div className={box}>
          <div className="px-3 py-1.5 text-xs font-medium border-b border-zinc-200 dark:border-zinc-700 print:border-zinc-300">
            NV — transposed
          </div>
          <table className="w-full min-w-[520px] text-xs md:text-sm">
            <thead>
              <tr className="text-left text-zinc-500 print:text-zinc-700">
                <th className="pl-3 pb-1 pt-2">Eye</th>
                <th className="pb-1">SPH</th>
                <th className="pb-1">CYL</th>
                <th className="pb-1">AXIS</th>
                <th className="pb-1">ADD</th>
                <th className="pr-3 pb-1">VA</th>
              </tr>
            </thead>
            <tbody>
              <TransposedRxRow
                eye="RE"
                sph={rx.nvReSph}
                cyl={rx.nvReCyl}
                axis={rx.nvReAxis}
                addDisplay={formatAddDiopter(rx.nvReAdd)}
                va={rx.nvReVa}
              />
              <TransposedRxRow
                eye="LE"
                sph={rx.nvLeSph}
                cyl={rx.nvLeCyl}
                axis={rx.nvLeAxis}
                addDisplay={formatAddDiopter(rx.nvLeAdd)}
                va={rx.nvLeVa}
              />
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2 text-zinc-800 dark:text-zinc-100 print:text-black">
        <p>
          <span className="text-zinc-500 print:text-zinc-600">PD:</span> {pdLine(rx)}
        </p>
        {(Number(rx.prismRePower ?? 0) !== 0 || Number(rx.prismLePower ?? 0) !== 0) && (
          <p>
            <span className="text-zinc-500 print:text-zinc-600">Prism:</span> RE{" "}
            {decodeOptical(Number(rx.prismRePower ?? 0))} Δ {String(rx.prismReBase ?? "—")} · LE{" "}
            {decodeOptical(Number(rx.prismLePower ?? 0))} Δ {String(rx.prismLeBase ?? "—")}
          </p>
        )}
        <p>
          <span className="text-zinc-500 print:text-zinc-600">Lens type:</span> {rx.lensType}
          <span className="text-zinc-500 print:text-zinc-600"> · Frame:</span> {rx.frameType ?? "—"}
          {rx.tint ? (
            <>
              <span className="text-zinc-500 print:text-zinc-600"> · Tint:</span> {rx.tint}
            </>
          ) : null}
        </p>
        {coating ? (
          <p>
            <span className="text-zinc-500 print:text-zinc-600">Coating:</span> {coating}
          </p>
        ) : null}
        {(rx.chiefComplaint || rx.doctorNotes) && (
          <div className="whitespace-pre-wrap">
            {rx.chiefComplaint ? (
              <p>
                <span className="text-zinc-500 print:text-zinc-600">Chief complaint:</span> {rx.chiefComplaint}
              </p>
            ) : null}
            {rx.doctorNotes ? (
              <p className="mt-1">
                <span className="text-zinc-500 print:text-zinc-600">Notes:</span> {rx.doctorNotes}
              </p>
            ) : null}
          </div>
        )}
        {!hideNextVisit && (
          <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 print:border-zinc-300">
            <p>
              <span className="text-zinc-500 print:text-zinc-600">Next Visit:</span>{" "}
              {rx.nextVisitDate ? rx.nextVisitDate.slice(0, 10) : "—"}
              {rx.followupReason ? ` — ${rx.followupReason}` : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function PrescriptionPrintChrome({
  children,
  clinicName = "Clinic Name",
  doctorName,
  nextVisitDate,
  patientAge,
}: {
  children: ReactNode;
  clinicName?: string;
  doctorName: string;
  nextVisitDate: string | null;
  /** Optional age in years for print header */
  patientAge?: number | null;
}) {
  const nv = nextVisitDate ? nextVisitDate.slice(0, 10) : null;
  return (
    <div className="rx-print-root text-black bg-white text-sm leading-snug">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-300 pb-3 mb-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{clinicName}</h1>
          <p className="text-xs text-zinc-600">Ophthalmic prescription</p>
          {patientAge != null && (
            <p className="text-xs text-zinc-600 mt-1">Age: {patientAge} years</p>
          )}
        </div>
        <div className="h-14 w-24 border border-dashed border-zinc-400 rounded flex items-center justify-center text-[10px] text-zinc-500 text-center px-1">
          Logo
        </div>
      </header>
      {children}
      <footer className="mt-8 pt-6 border-t border-zinc-300 flex flex-wrap justify-between items-end gap-6 text-sm">
        <div>
          <p className="text-zinc-600 text-xs">Prescribing doctor</p>
          <p className="font-medium mt-2">{doctorName}</p>
          <p className="border-t border-zinc-800 w-56 mt-6 pt-1 text-xs text-zinc-600">Signature</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-600">Next Visit</p>
          <p className="font-medium mt-1">{nv ?? "—"}</p>
        </div>
      </footer>
    </div>
  );
}
