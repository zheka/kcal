import type { Urgency } from '../provider.ts';

/**
 * Gemini's strategy, pure: given the urgency, the time and what is known of each key, the next
 * step: send a try with a key, wait, or give up. Run by index.ts, which owns the clock, the
 * network and what it learns of the keys (cooldowns, pace). Why each rule: docs/ai.md.
 *
 * Key (cheap) is asked when it can answer before the target; else Key 2 (paid), when it can; else
 * whichever can start soonest (Key 2 on a tie before the target, Key on a tie past it). With no
 * target, Key 2 is never asked while there is a Key. A key the user left empty is never asked.
 * A try on its way is waited for until the last moment another could still answer by the target
 * (target − ANSWER_MS); then the other key is asked too (a hedge), the first answer taken.
 */

/** The keys, as the user names them: Key (cheap, free tier), Key 2 (reliable, paid). */
export type KeyName = 'key' | 'key2';

/**
 * A key as the plan sees it. Times are ms since the request was asked; one at or before now
 * holds nothing back.
 */
export interface KeyState {
  set: boolean;
  /** Until when it cools after a quota error (its value's, across requests). */
  coolMs: number;
  /** Until when it waits to keep to its pace (Key's, across requests). */
  paceMs: number;
  /** Its busy tries in this request, and when the last one ended. */
  busy: number;
  busyEndMs: number;
  /** A try with it is on its way. */
  running: boolean;
}

export interface Situation {
  urgency: Urgency;
  /** Since the request was asked. */
  elapsedMs: number;
  keys: Record<KeyName, KeyState>;
}

/**
 * Why Key 2 is asked: Key busy, cooling, keeping to its pace, too slow for the target (or
 * already slow to answer), or not set.
 */
export type Why = 'busy' | 'cooling' | 'paced' | 'slow' | 'only';

export type Step =
  | {
      send: KeyName;
      /** How long the try may take before it is given up, as busy. */
      timeoutMs: number;
      /** Key 2's tries only: why it is asked. */
      why?: Why;
    }
  | {
      /** How long to wait before planning again. */
      waitMs: number;
      /**
       * What for: a busy key's backoff, a quota (a cooldown, the pace), or the answer of a try on
       * its way (planning again when it comes, else after waitMs; Infinity: only then).
       */
      why: 'busy' | 'quota' | 'answer';
    };

/**
 * Waits before each new try of a busy key, the last repeated. Why: 503s at a busy hour are
 * common and pass within minutes (docs/lab-meal-prompt.md, The model).
 */
export const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000] as const;
/** The longest a try may take: answers take 2–9 s; a stuck one is worth another try. */
export const TRY_TIMEOUT_MS = 120_000;
/** No new try with less time than this left before the limit: it would only time out. */
export const MIN_TRY_MS = 5_000;
/** How long an answer takes, as the plan expects: whether a try can still answer by the target. */
export const ANSWER_MS = 5_000;
/** A key's cooldown after a quota error: Gemini's retry delay, else a minute; a day's: an hour. */
export const MINUTE_COOLDOWN_MS = 60_000;
export const DAY_COOLDOWN_MS = 3_600_000;

/** How long a key cools after a quota error. */
export function cooldownMs(quota: { daily: boolean; retryMs?: number | undefined }): number {
  return quota.daily ? DAY_COOLDOWN_MS : (quota.retryMs ?? MINUTE_COOLDOWN_MS);
}

const NAMES: readonly KeyName[] = ['key', 'key2'];

/** The next step, or null: nothing left worth trying (no key, the limit). */
export function nextStep({ urgency, elapsedMs: now, keys }: Situation): Step | null {
  const { targetMs: target, limitMs: limit } = urgency;
  const hedgeAt = target - ANSWER_MS;
  const running = NAMES.some((n) => keys[n].running);
  if (running && !(now >= hedgeAt)) return { waitMs: hedgeAt - now, why: 'answer' };
  const asked: readonly KeyName[] =
    target === Infinity && keys.key.set ? ['key'] : NAMES.filter((n) => keys[n].set);
  const options = asked
    .filter((name) => !keys[name].running)
    .map((name) => ({ name, ...start(keys[name], now) }))
    .filter((o) => o.at + MIN_TRY_MS <= limit);
  if (options.length === 0) return running ? { waitMs: Infinity, why: 'answer' } : null;

  const pick =
    options.find((o) => o.at + ANSWER_MS < target) ??
    options.reduce((a, b) => (b.at < a.at || (b.at === a.at && now < target) ? b : a));
  if (pick.at > now) {
    return { waitMs: pick.at - now, why: pick.held === 'busy' ? 'busy' : 'quota' };
  }
  const timeoutMs = Math.min(TRY_TIMEOUT_MS, limit - now);
  if (pick.name === 'key') return { send: 'key', timeoutMs };
  const why: Why = !keys.key.set
    ? 'only'
    : keys.key.running
      ? 'slow'
      : (start(keys.key, now).held ?? 'slow');
  return { send: 'key2', timeoutMs, why };
}

/** When a key can be sent next, and what holds it back till then (null: nothing). */
function start(
  k: KeyState,
  now: number,
): { at: number; held: 'busy' | 'cooling' | 'paced' | null } {
  const backoff =
    k.busy === 0 ? -Infinity : k.busyEndMs + BACKOFF_MS[Math.min(k.busy, BACKOFF_MS.length) - 1]!;
  const holds = [
    { at: backoff, held: 'busy' as const },
    { at: k.coolMs, held: 'cooling' as const },
    { at: k.paceMs, held: 'paced' as const },
  ];
  const latest = holds.reduce((a, b) => (b.at > a.at ? b : a));
  return latest.at > now ? latest : { at: now, held: null };
}
