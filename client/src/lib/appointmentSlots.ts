/** Generate slot start minutes from settings (minutes from midnight). */
export function generateSlotMinutes(startMin: number, endMin: number, stepMin: number): number[] {
  const out: number[] = [];
  for (let m = startMin; m < endMin; m += stepMin) {
    out.push(m);
  }
  return out;
}

export function minutesToTimeInput(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function minutesToLabel(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

/** Combine local date (YYYY-MM-DD) + slot minutes → Date */
export function localDateTimeFromParts(dateYmd: string, minutesFromMidnight: number): Date {
  const [y, mo, d] = dateYmd.split("-").map((x) => parseInt(x, 10));
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return new Date(y, mo - 1, d, h, m, 0, 0);
}

/** Start of week Monday for a date */
export function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const x = new Date(d);
  x.setDate(d.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Mon–Sat dates for week containing `cursor` */
export function weekMonToSat(cursor: Date): Date[] {
  const mon = startOfWeekMonday(cursor);
  const days: Date[] = [];
  for (let i = 0; i < 6; i++) {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    days.push(x);
  }
  return days;
}
