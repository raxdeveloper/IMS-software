import { formatPowerDisplay } from "../../lib/optical";

type Props = {
  value: number;
  zeroAs?: "0.00" | "Plano" | "plano" | "—";
  className?: string;
};

export function OpticalDisplay({ value, zeroAs = "0.00", className = "" }: Props) {
  return <span className={`tabular-nums ${className}`}>{formatPowerDisplay(value, zeroAs)}</span>;
}
