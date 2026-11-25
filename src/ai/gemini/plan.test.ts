import { describe, expect, it } from 'vitest';
import { BACKOFF_MS, nextStep, type Situation, TRY_TIMEOUT_MS, type Tried } from './plan';

const LAB = { targetMs: Infinity, limitMs: 300_000 };
const FORM = { targetMs: 10_000, limitMs: 40_000 };
const BOTH = { key: true, key2: true };
const busy = (n: number): Tried[] => Array.from({ length: n }, () => ({ key: 'key', busy: true }));
const step = (s: Partial<Situation>) =>
  nextStep({ urgency: LAB, elapsedMs: 0, keys: BOTH, tried: [], ...s });

describe('Gemini’s next try', () => {
  it('first: Key at once, given the longest a try may take, within the limit', () => {
    expect(step({})).toEqual({ key: 'key', waitMs: 0, timeoutMs: TRY_TIMEOUT_MS });
    expect(step({ urgency: FORM })).toEqual({ key: 'key', waitMs: 0, timeoutMs: 40_000 });
  });

  it('Key 2 when there is no Key; nothing without keys', () => {
    expect(step({ keys: { key: false, key2: true } })).toMatchObject({ key: 'key2' });
    expect(step({ keys: { key: false, key2: false } })).toBeNull();
  });

  it('after a busy try, again after the next wait, the last repeated', () => {
    expect(step({ tried: busy(1), elapsedMs: 1_000 })).toMatchObject({ waitMs: BACKOFF_MS[0] });
    expect(step({ tried: busy(3), elapsedMs: 30_000 })).toMatchObject({ waitMs: BACKOFF_MS[2] });
    const long = { targetMs: Infinity, limitMs: 3_600_000 };
    expect(step({ urgency: long, tried: busy(9), elapsedMs: 0 })).toMatchObject({
      waitMs: BACKOFF_MS.at(-1),
    });
  });

  it('a try never runs past the limit, and none is started with too little left', () => {
    // 1 s in, wait 5 s: 34 s left
    expect(step({ urgency: FORM, tried: busy(1), elapsedMs: 1_000 })).toMatchObject({
      timeoutMs: 34_000,
    });
    // 22 s in, wait 30 s: past the limit
    expect(step({ urgency: FORM, tried: busy(3), elapsedMs: 22_000 })).toBeNull();
  });

  it('nothing after an error that isn’t busy', () => {
    expect(step({ tried: [{ key: 'key', busy: false }] })).toBeNull();
  });
});
