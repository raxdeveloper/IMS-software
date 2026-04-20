import { OpticalInput } from "./OpticalInput";
import { AxisInput } from "./AxisInput";
import { VAInput } from "./VAInput";

export type EyeRow = {
  sph: number;
  cyl: number;
  axis: number | null;
  add: number;
  va: string;
};

type Props = {
  label: string;
  re: EyeRow;
  le: EyeRow;
  onChange: (eye: "re" | "le", patch: Partial<EyeRow>) => void;
  readOnly?: boolean;
};

const SPH_MIN = -2000;
const SPH_MAX = 2000;
const CYL_MIN = -600;
const CYL_MAX = 600;
const ADD_MIN = 0;
const ADD_MAX = 400;

export function RxTable({ label, re, le, onChange, readOnly }: Props) {
  const ro = !!readOnly;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{label}</h3>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-900">
              <th className="p-2 text-left">Eye</th>
              <th className="p-2">SPH</th>
              <th className="p-2">CYL</th>
              <th className="p-2">AXIS</th>
              <th className="p-2">ADD</th>
              <th className="p-2">VA</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-[#EFF6FF] dark:bg-sky-950/20">
              <td className="p-2 font-medium text-sky-800 dark:text-sky-300">RE</td>
              <td className="p-1">
                <OpticalInput
                  value={re.sph}
                  onChange={(v) => onChange("re", { sph: v })}
                  min={SPH_MIN}
                  max={SPH_MAX}
                  disabled={ro}
                />
              </td>
              <td className="p-1">
                <OpticalInput
                  value={re.cyl}
                  onChange={(v) =>
                    onChange("re", {
                      cyl: v,
                      axis: v === 0 ? null : re.axis,
                    })
                  }
                  min={CYL_MIN}
                  max={CYL_MAX}
                  disabled={ro}
                />
              </td>
              <td className="p-1">
                <AxisInput
                  cyl={re.cyl}
                  value={re.axis}
                  disabled={ro}
                  invalid={re.cyl !== 0 && (re.axis === null || re.axis === undefined)}
                  onChange={(a) => onChange("re", { axis: a })}
                />
              </td>
              <td className="p-1">
                <OpticalInput
                  value={re.add}
                  onChange={(v) => onChange("re", { add: v })}
                  min={ADD_MIN}
                  max={ADD_MAX}
                  disabled={ro}
                />
              </td>
              <td className="p-1">
                <VAInput re value={re.va} onChange={(v) => onChange("re", { va: v })} disabled={ro} />
              </td>
            </tr>
            <tr className="bg-[#F0FDF4] dark:bg-emerald-950/20">
              <td className="p-2 font-medium text-emerald-800 dark:text-emerald-300">LE</td>
              <td className="p-1">
                <OpticalInput
                  value={le.sph}
                  onChange={(v) => onChange("le", { sph: v })}
                  min={SPH_MIN}
                  max={SPH_MAX}
                  disabled={ro}
                />
              </td>
              <td className="p-1">
                <OpticalInput
                  value={le.cyl}
                  onChange={(v) =>
                    onChange("le", {
                      cyl: v,
                      axis: v === 0 ? null : le.axis,
                    })
                  }
                  min={CYL_MIN}
                  max={CYL_MAX}
                  disabled={ro}
                />
              </td>
              <td className="p-1">
                <AxisInput
                  cyl={le.cyl}
                  value={le.axis}
                  disabled={ro}
                  invalid={le.cyl !== 0 && (le.axis === null || le.axis === undefined)}
                  onChange={(a) => onChange("le", { axis: a })}
                />
              </td>
              <td className="p-1">
                <OpticalInput
                  value={le.add}
                  onChange={(v) => onChange("le", { add: v })}
                  min={ADD_MIN}
                  max={ADD_MAX}
                  disabled={ro}
                />
              </td>
              <td className="p-1">
                <VAInput value={le.va} onChange={(v) => onChange("le", { va: v })} disabled={ro} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
