const pad = (n: number) => String(n).padStart(2, '0');

/** Local date of `d`: `YYYY-MM-DD`. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date and time of `d` to the minute: `YYYY-MM-DDTHH:mm`. */
export function localDateTime(d: Date): string {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A real calendar date written as `YYYY-MM-DD`. */
export function isValidDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** A real local date and time written as `YYYY-MM-DDTHH:mm`. */
export function isValidDateTime(text: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(text);
  return !!m && isValidDate(m[1]!) && Number(m[2]) < 24 && Number(m[3]) < 60;
}

/** The date `days` after `date` (negative: before). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return localDate(new Date(y, m - 1, d + days));
}
