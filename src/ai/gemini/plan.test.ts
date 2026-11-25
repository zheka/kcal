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
const APP = { targetMs: 15_000, limitMs: 30_000 };
const LAB = { targetMs: 30_000, limitMs: 90_000 };
const FAST = { targetMs: 5_000, limitMs: 30_000 };

const READY: KeyState = {
  set: true,
  coolMs: -Infinity,
  paceMs: -Infinity,
  busy: 0,
  busyEndMs: 0,
  running: false,
};
const UNSET: KeyState = { ...READY, set: false };
/** A key busy `n` times in this request, the last ending at `endMs`. */
const busy = (n: number, endMs: number): KeyState => ({ ...READY, busy: n, busyEndMs: endMs });
const cooling = (untilMs: number): KeyState => ({ ...READY, coolMs: untilMs });
const paced = (untilMs: number): KeyState => ({ ...READY, paceMs: untilMs });
const RUNNING: KeyState = { ...READY, running: true };

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
      'app, Key busy once: Key again after 2 s',
      APP,
      2_000,
      busy(1, 2_000),
      READY,
      { waitMs: 2_000, why: 'busy' },
    ],
    [
      'app, Key busy twice: Key 2 (a retry after 10 s is too late)',
      APP,
      6_000,
      busy(2, 6_000),
      READY,
      { send: 'key2', timeoutMs: 24_000, why: 'busy' },
    ],
    [
      'lab, Key busy twice: Key again after 10 s, still by 30 s',
      LAB,
      6_000,
      busy(2, 6_000),
      READY,
      { waitMs: 10_000, why: 'busy' },
    ],
    [
      'lab, Key busy 3 times: Key 2 (a retry after 30 s is too late)',
      LAB,
      18_000,
      busy(3, 18_000),
      READY,
      { send: 'key2', timeoutMs: 72_000, why: 'busy' },
    ],
    [
      'a short target, Key busy: Key 2 at once',
      { targetMs: 8_000, limitMs: 30_000 },
      2_000,
      busy(1, 2_000),
      READY,
      { send: 'key2', timeoutMs: 28_000, why: 'busy' },
    ],
    [
      'no target, Key busy: Key again, never Key 2',
      STRICT,
      2_000,
      busy(1, 2_000),
      READY,
      { waitMs: 2_000, why: 'busy' },
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
      17_000,
      READY,
      busy(1, 16_000),
      { send: 'key', timeoutMs: 13_000 },
    ],
    [
      'past the target: Key on a tie',
      APP,
      17_000,
      READY,
      READY,
      { send: 'key', timeoutMs: 13_000 },
    ],
    [
      'past the target: Key 2 when it can start first',
      APP,
      17_000,
      busy(2, 16_000),
      READY,
      { send: 'key2', timeoutMs: 13_000, why: 'busy' },
    ],
    [
      'both held: wait for whichever starts first',
      APP,
      17_000,
      busy(2, 16_000),
      busy(1, 16_000),
      { waitMs: 1_000, why: 'busy' },
    ],

    // a try on its way: waited for, until another can only just answer by the target
    [
      'app, Key on its way: wait for it until 10 s',
      APP,
      1_000,
      RUNNING,
      READY,
      { waitMs: 9_000, why: 'answer' },
    ],
    [
      'app, Key still on its way at 10 s: Key 2 too',
      APP,
      10_000,
      RUNNING,
      READY,
      { send: 'key2', timeoutMs: 20_000, why: 'slow' },
    ],
    [
      'lab, Key on its way: Key 2 too only at 25 s',
      LAB,
      10_000,
      RUNNING,
      READY,
      { waitMs: 15_000, why: 'answer' },
    ],
    [
      'no target, Key on its way: wait for it, Key 2 never',
      STRICT,
      200_000,
      RUNNING,
      READY,
      { waitMs: Infinity, why: 'answer' },
    ],
    ['both on their way: wait', APP, 12_000, RUNNING, RUNNING, { waitMs: Infinity, why: 'answer' }],
    [
      'Key 2 on its way (Key cooled), Key free again past 10 s: Key too',
      APP,
      11_000,
      READY,
      RUNNING,
      { send: 'key', timeoutMs: 19_000 },
    ],
    [
      'Key on its way, Key 2 backing off: wait for whichever first',
      APP,
      11_000,
      RUNNING,
      busy(1, 10_000),
      { waitMs: 1_000, why: 'busy' },
    ],
    [
      'only Key, on its way past 10 s: wait for it',
      APP,
      11_000,
      RUNNING,
      UNSET,
      { waitMs: Infinity, why: 'answer' },
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
