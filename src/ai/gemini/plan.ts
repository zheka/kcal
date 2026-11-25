import type { Urgency } from '../provider.ts';

/**
 * Gemini's strategy, pure: given the urgency, the keys there are and the tries so far, the next
 * try (which key, after how long, given how long), or none. Run by index.ts, which owns the
 * clock and the network.
 *
 * For now one key at a time, as before there were two: Key (cheap) when there is one, else Key 2;
 * a busy try is tried again after BACKOFF_MS while the limit allows. The target isn't used yet:
 * spending Key 2 to meet it (switching, hedging, cooldowns) is the next step (docs/ai.md).
 */

/** The keys, as the user names them: Key (cheap, free tier), Key 2 (reliable, paid). */
export type KeyName = 'key' | 'key2';

/** A try so far: its key, and whether it failed as busy (worth another try). */
export interface Tried {
  key: KeyName;
  busy: boolean;
}

export interface Situation {
  urgency: Urgency;
  /** Since the request was asked. */
  elapsedMs: number;
  /** Which keys are set. */
  keys: Record<KeyName, boolean>;
  tried: readonly Tried[];
}

export interface Step {
  key: KeyName;
  /** How long to wait before sending. */
  waitMs: number;
  /** How long the try may take before it is given up, as busy. */
  timeoutMs: number;
}

/**
 * Waits before each new try of a busy Gemini, the last repeated. Why: 503s at a busy hour are
 * common and pass within minutes (docs/lab-meal-prompt.md, The model).
 */
export const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000] as const;
/** The longest a try may take: answers take 2–9 s; a stuck one is worth another try. */
export const TRY_TIMEOUT_MS = 120_000;
/** No new try with less time than this left before the limit: it would only time out. */
export const MIN_TRY_MS = 5_000;

/** The next try, or null: nothing left worth trying (an answer, a non-busy error, the limit). */
export function nextStep({ urgency, elapsedMs, keys, tried }: Situation): Step | null {
  const key: KeyName | null = keys.key ? 'key' : keys.key2 ? 'key2' : null;
  if (!key) return null;
  const last = tried.at(-1);
  if (!last) return { key, waitMs: 0, timeoutMs: Math.min(TRY_TIMEOUT_MS, urgency.limitMs) };
  if (!last.busy) return null;
  const waitMs = BACKOFF_MS[Math.min(tried.length, BACKOFF_MS.length) - 1]!;
  const left = urgency.limitMs - elapsedMs - waitMs;
  if (left < MIN_TRY_MS) return null;
  return { key, waitMs, timeoutMs: Math.min(TRY_TIMEOUT_MS, left) };
}
