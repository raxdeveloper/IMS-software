import { useEffect, useState } from "react";
import { decodeOptical, parseOpticalToInt } from "../../utils/optical";

type Props = {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function OpticalInput({
  value,
  onChange,
  min,
  max,
  step = 25,
  disabled,
  className = "",
  placeholder = "0.00",
}: Props) {
  const [text, setText] = useState(() => decodeOptical(value));

  useEffect(() => {
    setText(decodeOptical(value));
  }, [value]);

  function applyInt(v: number) {
    const clamped = Math.min(max, Math.max(min, v));
    onChange(clamped);
    setText(decodeOptical(clamped));
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        disabled={disabled || value <= min}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-base leading-none hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
        onClick={() => applyInt(value - step)}
        aria-label="Decrease 0.25 D"
      >
        −
      </button>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        style={{ width: 80 }}
        className="rounded border border-zinc-300 bg-white px-1 py-1 text-center text-sm tabular-nums dark:border-zinc-600 dark:bg-zinc-950"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          const next = parseOpticalToInt(text, min, max);
          applyInt(next);
        }}
      />
      <button
        type="button"
        disabled={disabled || value >= max}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-base leading-none hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-600 dark:hover:bg-zinc-800"
        onClick={() => applyInt(value + step)}
        aria-label="Increase 0.25 D"
      >
        +
      </button>
    </div>
  );
}
