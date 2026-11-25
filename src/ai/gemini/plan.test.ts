import { describe, expect, it } from 'vitest';
import {
  BACKOFF_MS,
  cooldownMs,
  DAY_COOLDOWN_MS,
  type KeyState,
  MINUTE_COOLDOWN_MS,
  nextStep,
  type Situation,
  TRY_TIMEOUT_MS,
} from './plan';

const STRICT = { targetMs: Infinity, limitMs: 300_000 };
const APP = { targetMs: 10_000, limitMs: 30_000 };
const LAB = { targetMs: 30_000, limitMs: 90_000 };
const FAST = { targetMs: 5_000, limitMs: 30_000 };

const READY: KeyState = { set: true, coolMs: -Infinity, paceMs: -Infinity, busy: 0, busyEndMs: 0 };
const UNSET: KeyState = { ...READY, set: false };
/** A key busy `n` times in this request, the last ending at `endMs`. */
const busy = (n: number, endMs: number): KeyState => ({ ...READY, busy: n, busyEndMs: endMs });
const cooling = (untilMs: number): KeyState => ({ ...READY, coolMs: untilMs });
const paced = (untilMs: number): KeyState => ({ ...READY, paceMs: untilMs });

const step = (
  urgency: Situation['urgency'],
  elapsedMs: number,
  key: KeyState,
  key2: KeyState = READY,
) => nextStep({ urgency, elapsedMs, keys: { key, key2 } });

describe('Gemini’s next step', () => {
  it.each([
    // [what, urgency, elapsed, Key, Key 2, the step]
    ['first: Key', APP, 0, READY, READY, { send: 'key', timeoutMs: 30_000 }],
    [
      'a try never outlasts TRY_TIMEOUT_MS',
      STRICT,
      0,
      READY,
      READY,
      { send: 'key', timeoutMs: TRY_TIMEOUT_MS },
    ],
    [
      'Key 2 alone when there is no Key',
      STRICT,
      0,
      UNSET,
      READY,
      { send: 'key2', timeoutMs: TRY_TIMEOUT_MS, why: 'only' },
    ],
    [
      'a target no longer than an answer takes: Key 2 alone, at once',
      FAST,
      0,
      READY,
      READY,
      { send: 'key2', timeoutMs: 30_000, why: 'slow' },
    ],
    ['…but Key when it is the only one', FAST, 0, READY, UNSET, { send: 'key', timeoutMs: 30_000 }],

    // a busy Key
    [
      'app, Key busy: Key 2 at once (a retry can’t answer by 10 s)',
      APP,
      500,
      busy(1, 500),
      READY,
      { send: 'key2', timeoutMs: 29_500, why: 'busy' },
    ],
    [
      'lab, Key busy once: Key again after 5 s',
      LAB,
      500,
      busy(1, 500),
      READY,
      { waitMs: 5_000, why: 'busy' },
    ],
    [
      'lab, Key busy twice: Key again after 15 s, still by 30 s',
      LAB,
      6_000,
      busy(2, 6_000),
      READY,
      { waitMs: 15_000, why: 'busy' },
    ],
    [
      'lab, Key busy 3 times: Key 2 (a retry after 30 s is too late)',
      LAB,
      21_500,
      busy(3, 21_500),
      READY,
      { send: 'key2', timeoutMs: 68_500, why: 'busy' },
    ],
    [
      'no target, Key busy: Key again, never Key 2',
      STRICT,
      500,
      busy(1, 500),
      READY,
      { waitMs: 5_000, why: 'busy' },
    ],
    [
      'the last wait repeats',
      { targetMs: Infinity, limitMs: 3_600_000 },
      0,
      busy(9, 0),
      READY,
      { waitMs: BACKOFF_MS.at(-1), why: 'busy' },
    ],

    // quotas: a cooldown, the pace
    [
      'app, Key cooling: Key 2 at once',
      APP,
      0,
      cooling(20_000),
      READY,
      { send: 'key2', timeoutMs: 30_000, why: 'cooling' },
    ],
    [
      'lab, Key cooling briefly: wait for it',
      LAB,
      0,
      cooling(20_000),
      READY,
      { waitMs: 20_000, why: 'quota' },
    ],
    [
      'app, Key out of pace: Key 2 at once',
      APP,
      0,
      paced(40_000),
      READY,
      { send: 'key2', timeoutMs: 30_000, why: 'paced' },
    ],
    [
      'no target, Key out of pace: wait for it',
      STRICT,
      0,
      paced(40_000),
      READY,
      { waitMs: 40_000, why: 'quota' },
    ],
    [
      'no target, Key cooling past the limit: nothing (Key 2 isn’t asked)',
      STRICT,
      0,
      cooling(DAY_COOLDOWN_MS),
      READY,
      null,
    ],

    // past the target
    [
      'past the target: Key when it can start first',
      APP,
      12_000,
      READY,
      busy(1, 11_000),
      { send: 'key', timeoutMs: 18_000 },
    ],
    [
      'past the target: Key on a tie',
      APP,
      12_000,
      READY,
      READY,
      { send: 'key', timeoutMs: 18_000 },
    ],
    [
      'past the target: Key 2 when it can start first',
      APP,
      12_000,
      busy(2, 11_000),
      READY,
      { send: 'key2', timeoutMs: 18_000, why: 'busy' },
    ],
    [
      'both held: wait for whichever starts first',
      APP,
      12_000,
      busy(2, 11_000),
      busy(1, 11_000),
      { waitMs: 4_000, why: 'busy' },
    ],

    // the limit
    ['no try with too little left before the limit', APP, 26_000, READY, READY, null],
    ['no try whose start would be too late', LAB, 60_000, busy(4, 60_000), UNSET, null],
    ['no keys: nothing', APP, 0, UNSET, UNSET, null],
  ] as const)('%s', (_, urgency, elapsed, key, key2, expected) => {
    expect(step(urgency, elapsed, key, key2)).toEqual(expected);
  });
});

describe('a key’s cooldown after a quota error', () => {
  it('Gemini’s retry delay, else a minute; an hour for the day’s quota', () => {
    expect(cooldownMs({ daily: false, retryMs: 37_000 })).toBe(37_000);
    expect(cooldownMs({ daily: false })).toBe(MINUTE_COOLDOWN_MS);
    expect(cooldownMs({ daily: true, retryMs: 37_000 })).toBe(DAY_COOLDOWN_MS);
  });
});
