import { decodeRxDisplay, transpose, transpositionLabel } from "../../utils/optical";

type Props = {
  reSph: number;
  reCyl: number;
  reAxis: number | null;
  leSph: number;
  leCyl: number;
  leAxis: number | null;
};

function Row({
  label,
  sph,
  cyl,
  axis,
}: {
  label: string;
  sph: number;
  cyl: number;
  axis: number | null;
}) {
  if (cyl !== 0 && (axis === null || axis === undefined)) {
    return (
      <tr className="italic text-amber-700 dark:text-amber-300">
        <td className="p-2 font-medium">{label}</td>
        <td colSpan={3} className="p-2 text-xs">
          Axis required for transposition
        </td>
      </tr>
    );
  }
  const a = axis === null || axis === undefined ? 0 : axis;
  const t = cyl === 0 ? { sph, cyl: 0, axis: null as number | null } : transpose(sph, cyl, a);
  const showAxis = t.axis === null ? "—" : String(t.axis);
  return (
    <tr className="italic text-zinc-600 dark:text-zinc-400">
      <td className="p-2 font-medium">{label}</td>
      <td className="p-2 tabular-nums">{decodeRxDisplay(t.sph)}</td>
      <td className="p-2 tabular-nums">{decodeRxDisplay(t.cyl)}</td>
      <td className="p-2 tabular-nums">{showAxis}</td>
    </tr>
  );
}

export function TransposedTable({ reSph, reCyl, reAxis, leSph, leCyl, leAxis }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 border-l-4 border-l-amber-400 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 p-3 space-y-2">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Transposed form (auto-calculated — do not edit)
      </p>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">RE — {transpositionLabel(reCyl)}</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="p-1">Eye</th>
                <th className="p-1">SPH</th>
                <th className="p-1">CYL</th>
                <th className="p-1">AXIS</th>
              </tr>
            </thead>
            <tbody>
              <Row label="RE" sph={reSph} cyl={reCyl} axis={reAxis} />
            </tbody>
          </table>
        </div>
        <div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">LE — {transpositionLabel(leCyl)}</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="p-1">Eye</th>
                <th className="p-1">SPH</th>
                <th className="p-1">CYL</th>
                <th className="p-1">AXIS</th>
              </tr>
            </thead>
            <tbody>
              <Row label="LE" sph={leSph} cyl={leCyl} axis={leAxis} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
