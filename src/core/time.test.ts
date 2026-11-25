import { describe, expect, it } from 'vitest';
import {
  addDays,
  atLocalMinute,
  isValidDate,
  isValidLocalMinute,
  isValidUtc,
  localDate,
  localDateOf,
  localMinute,
  localMinuteOf,
  localTime,
} from './time';

// Tests run in Europe/Berlin (see vite.config.ts): UTC+1 in winter, UTC+2 in summer.

describe('local dates and minutes', () => {
  it('formats local date and minute', () => {
    const d = new Date(2026, 0, 5, 7, 3, 41, 512);
    expect(localDate(d)).toBe('2026-01-05');
    expect(localMinute(d)).toBe('2026-01-05T07:03');
  });

  it('formats local time with its offset, the same instant', () => {
    const winter = new Date('2026-01-05T06:03:41.512Z');
    expect(localTime(winter)).toBe('2026-01-05T07:03:41+01:00');
    expect(new Date(localTime(winter)).getTime()).toBe(winter.getTime() - 512);
    expect(localTime(new Date('2026-07-05T22:30:00Z'))).toBe('2026-07-06T00:30:00+02:00');
  });

  it('accepts real dates and minutes only', () => {
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2026-1-5')).toBe(false);
    expect(isValidLocalMinute('2026-11-17T08:30')).toBe(true);
    expect(isValidLocalMinute('2026-11-17T24:00')).toBe(false);
    expect(isValidLocalMinute('2026-11-17T08:30:00')).toBe(false);
  });

  it('adds days across months, years and daylight saving changes', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', -1)).toBe('2026-10-24');
  });
});

describe('stored timestamps', () => {
  it('are UTC to the millisecond, exactly as toISOString writes them', () => {
    expect(isValidUtc('2026-11-17T07:30:41.512Z')).toBe(true);
    expect(isValidUtc('2026-11-17T07:30Z')).toBe(false);
    expect(isValidUtc('2026-11-17T07:30:41Z')).toBe(false);
    expect(isValidUtc('2026-11-17T08:30:41.512+01:00')).toBe(false);
    expect(isValidUtc('2026-02-30T07:30:41.512Z')).toBe(false);
  });

  it('are shown in local time', () => {
    expect(localMinuteOf('2026-11-17T07:30:41.512Z')).toBe('2026-11-17T08:30');
    expect(localMinuteOf('2026-07-17T07:30:41.512Z')).toBe('2026-07-17T09:30');
    // 23:30 UTC is already the next local day
    expect(localDateOf('2026-11-17T23:30:00.000Z')).toBe('2026-11-18');
  });

  it('change only their minute when a local minute is set', () => {
    const logged = new Date('2026-11-17T07:30:41.512Z');
    expect(atLocalMinute('2026-11-17T12:05', logged)).toBe('2026-11-17T11:05:41.512Z');
    expect(atLocalMinute('2026-07-01T12:05', logged)).toBe('2026-07-01T10:05:41.512Z');
  });
});
