import { describe, expect, it } from 'vitest';
import { isValidDate, isValidDateTime, localDate, localDateTime } from './time';

describe('local dates', () => {
  it('formats local date and time', () => {
    const d = new Date(2026, 0, 5, 7, 3);
    expect(localDate(d)).toBe('2026-01-05');
    expect(localDateTime(d)).toBe('2026-01-05T07:03');
  });

  it('accepts real dates only', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('2026-1-5')).toBe(false);
  });

  it('accepts local date-times to the minute', () => {
    expect(isValidDateTime('2026-11-17T08:30')).toBe(true);
    expect(isValidDateTime('2026-11-17T24:00')).toBe(false);
    expect(isValidDateTime('2026-11-17T08:30:00')).toBe(false);
    expect(isValidDateTime('2026-11-17T08:30Z')).toBe(false);
    expect(isValidDateTime('2026-11-31T08:30')).toBe(false);
  });
});
