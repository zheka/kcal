import { ModelError, type ModelRequest } from '../model.ts';
import type { Answered, AskOptions, Attempt, Provider } from '../provider.ts';
import { GeminiError, requestBody, send } from './http.ts';
import { cooldownMs, type KeyName, type KeyState, nextStep } from './plan.ts';

/**
 * Gemini as a Provider (provider.ts): asks with the user's keys, each step as its plan (plan.ts)
 * says, over its wire (http.ts). One per tab or process (createGemini), so what it learns of a
 * key (its cooldown, its pace) holds for every request sent through it.
 */

/** The keys as they are now: Key (cheap, free tier), Key 2 (reliable, paid); '' when not set. */
export type GeminiKeys = Record<KeyName, string>;

export interface GeminiOptions {
  /**
   * Reads the keys: before every step, so a key set or forgotten meanwhile is the one used. The
   * app's from its database (src/ai/browser.ts), the tool's from the environment.
   */
  keys: () => Promise<GeminiKeys>;
  /** Whether the device is online (navigator.onLine by default). */
  online?: () => boolean;
  now?: () => number;
  /** Waits, ending early when the signal aborts. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Key's tries a minute, across all requests: under the free tier's 15 for Flash-Lite, leaving
 * room for the app and the lab, which share its project's quota without knowing of each other
 * (docs/ai.md). Key 2 (paid) has no pace: its quota is far larger.
 */
export const PER_MINUTE = 12;

const NO_KEY = 'no Gemini key';
/** A key as the user knows it, in messages. */
const LABEL: Record<KeyName, string> = { key: 'Key', key2: 'Key 2' };

export function createGemini(options: GeminiOptions): Provider {
  const {
    keys,
    online = () => navigator.onLine,
    now = () => performance.now(),
    wait = defaultWait,
  } = options;
  /**
   * By the key's value, not its name, so a key changed meanwhile starts afresh: when its recent
   * tries were sent (Key's pace), until when it cools after a quota error.
   */
  const sentAt = new Map<string, number[]>();
  const coolUntil = new Map<string, number>();

  /** Until when Key waits for its next turn within PER_MINUTE (0: none). */
  function paceUntil(value: string): number {
    const sent = sentAt.get(value) ?? [];
    while (sent.length > 0 && sent[0]! + 60_000 <= now()) sent.shift();
    return sent.length < PER_MINUTE ? 0 : sent[0]! + 60_000;
  }

  async function ask(request: ModelRequest, o: AskOptions): Promise<Answered> {
    const started = now();
    if (!online()) throw new ModelError('offline', { sent: false });
    if (!hasKey(await keys())) throw new ModelError(NO_KEY, { sent: false });
    const body = JSON.stringify(await requestBody(request, o.files));

    const attempts: Attempt[] = [];
    const busy: Record<KeyName, { n: number; endMs: number }> = {
      key: { n: 0, endMs: 0 },
      key2: { n: 0, endMs: 0 },
    };
    let last: GeminiError | undefined;
    const since = (t: number) => t - started;
    const fail = (message: string, more: { reply?: GeminiError['reply']; key?: KeyName } = {}) =>
      new ModelError(message, {
        sent: attempts.length > 0,
        ...(more.reply && { reply: more.reply }),
        ...(more.key && { key: more.key }),
        attempts,
      });

    for (;;) {
      const set = await keys();
      const state = (name: KeyName): KeyState => ({
        set: !!set[name],
        coolMs: since(coolUntil.get(set[name]) ?? -Infinity),
        paceMs: name === 'key' ? since(paceUntil(set[name])) : -Infinity,
        busy: busy[name].n,
        busyEndMs: busy[name].endMs,
      });
      const step = nextStep({
        urgency: o.urgency,
        elapsedMs: since(now()),
        keys: { key: state('key'), key2: state('key2') },
      });
      if (!step) throw fail(last?.message ?? NO_KEY, { reply: last?.reply });
      if ('waitMs' in step) {
        o.onProgress?.({ why: step.why, waitMs: Math.ceil(step.waitMs) });
        await wait(Math.ceil(step.waitMs), o.signal);
        if (o.signal?.aborted) throw fail('cancelled');
        continue;
      }

      const name = step.send;
      const key = set[name];
      if (name === 'key') sentAt.set(key, [...(sentAt.get(key) ?? []), now()]);
      o.onProgress?.({ why: 'sending', waitMs: 0 });
      const t = now();
      const attempt: Attempt = {
        key: name,
        keyEnd: key.slice(-4),
        at: Math.round(since(t)),
        ms: 0,
        ...(step.why && { why: step.why }),
      };
      attempts.push(attempt);
      try {
        const reply = await send(key, request.model, body, {
          timeoutMs: step.timeoutMs,
          signal: o.signal,
        });
        attempt.ms = Math.round(now() - t);
        return { ...reply, attempts };
      } catch (err) {
        const e = err instanceof GeminiError ? err : new GeminiError(String(err));
        attempt.ms = Math.round(now() - t);
        attempt.error = e.message;
        if (e.kind === 'cancelled') {
          attempt.cancelled = true;
          throw fail('cancelled');
        }
        if (e.kind === 'key') throw fail(`${LABEL[name]}: ${e.message}`, { key: name });
        if (e.kind === 'final') throw fail(e.message, { reply: e.reply });
        if (e.kind === 'quota') coolUntil.set(key, now() + cooldownMs(e.quota!));
        else busy[name] = { n: busy[name].n + 1, endMs: since(now()) };
        last = e;
      }
    }
  }

  return { ask };
}

const hasKey = (k: GeminiKeys) => !!(k.key || k.key2);

function defaultWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done);
  });
}
