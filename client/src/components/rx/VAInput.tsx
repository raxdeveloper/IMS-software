import { useId, useState } from "react";

const OPTIONS = [
  "6/6",
  "6/9",
  "6/12",
  "6/18",
  "6/24",
  "6/36",
  "6/60",
  "5/60",
  "4/60",
  "3/60",
  "2/60",
  "1/60",
  "CF",
  "HM",
  "PL",
  "NPL",
  "N6",
  "N8",
  "N10",
  "N12",
];

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  re?: boolean;
  className?: string;
};

export function VAInput({ value, onChange, disabled, re, className = "" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const bg = re ? "bg-sky-50 dark:bg-sky-950/40" : "bg-emerald-50 dark:bg-emerald-950/40";

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        disabled={disabled}
        style={{ width: 70 }}
        list={id}
        className={`rounded border border-zinc-300 dark:border-zinc-600 px-1 py-1 text-sm ${bg}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <datalist id={id}>
        {OPTIONS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      {open && (
        <div className="absolute z-20 mt-1 flex flex-wrap gap-1 max-w-[220px] rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 shadow-lg">
          {OPTIONS.slice(0, 12).map((o) => (
            <button
              key={o}
              type="button"
              className="rounded px-1.5 py-0.5 text-[10px] bg-zinc-100 dark:bg-zinc-800 hover:bg-accent/15 dark:hover:bg-accent/10"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o);
                setOpen(false);
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
