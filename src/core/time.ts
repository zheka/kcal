/**
 * Stored times are UTC timestamps to the millisecond (`2026-11-17T07:30:41.512Z`). Forms and
 * screens work with local dates (`YYYY-MM-DD`) and local minutes (`YYYY-MM-DDTHH:mm`) in the
 * device's current time zone.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date of `d`: `YYYY-MM-DD`. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date and time of `d` to the minute: `YYYY-MM-DDTHH:mm`, as a datetime-local input. */
export function localMinute(d: Date): string {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Local time of `d` to the second, with the zone's offset: `YYYY-MM-DDTHH:mm:ss+01:00`. Both
 * the instant and the wall-clock time it was where it happened.
 */
export function localTime(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const abs = Math.abs(offset);
  const zone = `${offset < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return `${localMinute(d)}:${pad(d.getSeconds())}${zone}`;
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
export function isValidLocalMinute(text: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(text);
  return !!m && isValidDate(m[1]!) && Number(m[2]) < 24 && Number(m[3]) < 60;
}

/** The date `days` after `date` (negative: before). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return localDate(new Date(y, m - 1, d + days));
}

/** A stored timestamp: UTC to the millisecond, exactly as `toISOString()` writes it. */
export function isValidUtc(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)) return false;
  const ms = Date.parse(text);
  return !Number.isNaN(ms) && new Date(ms).toISOString() === text;
}

/** The local date of a stored timestamp. */
export function localDateOf(utc: string): string {
  return localDate(new Date(utc));
}

/** The local minute of a stored timestamp, for a datetime-local input. */
export function localMinuteOf(utc: string): string {
  return localMinute(new Date(utc));
}

/**
 * The timestamp of a local minute (`YYYY-MM-DDTHH:mm`), with its seconds and milliseconds
 * taken from `subMinute`: editing a time changes only its minute, so the hidden seconds keep
 * entries of the same minute in the order they were logged.
 */
export function atLocalMinute(local: string, subMinute: Date): string {
  if (!isValidLocalMinute(local)) throw new Error(`not a local minute: ${local}`);
  const [date = '', time = ''] = local.split('T');
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const at = new Date(y, mo - 1, d, h, mi, subMinute.getSeconds(), subMinute.getMilliseconds());
  return at.toISOString();
}
