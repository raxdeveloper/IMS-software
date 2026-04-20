import { OPTICAL_CONSTANTS } from "../../utils/optical";

type Props = {
  cyl: number;
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  invalid?: boolean;
};

const { AXIS_MIN, AXIS_MAX } = OPTICAL_CONSTANTS;

export function AxisInput({ cyl, value, onChange, disabled, invalid }: Props) {
  const empty = cyl === 0;
  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled || empty}
      placeholder={empty ? "—" : ""}
      style={{ width: 60 }}
      className={`rounded border px-1 py-1 text-center text-sm tabular-nums ${
        invalid ? "border-red-500 ring-1 ring-red-400" : "border-zinc-300 dark:border-zinc-600"
      } ${empty ? "bg-zinc-100 dark:bg-zinc-800" : "bg-sky-50 dark:bg-sky-950/30"}`}
      value={empty ? "" : value === null || value === undefined ? "" : value}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") {
          onChange(null);
          return;
        }
        const n = parseInt(v.replace(/\D/g, ""), 10);
        if (Number.isNaN(n)) return;
        if (n === 0) {
          onChange(0);
          return;
        }
        onChange(Math.min(AXIS_MAX, Math.max(AXIS_MIN, n)));
      }}
    />
  );
}
