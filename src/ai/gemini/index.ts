import { ModelError, type ModelRequest } from '../model.ts';
import type { Answered, AskOptions, Attempt, Provider } from '../provider.ts';
import { GeminiError, requestBody, send } from './http.ts';
import { type KeyName, nextStep, type Tried } from './plan.ts';

/**
 * Gemini as a Provider (provider.ts): asks with the user's keys, each try as its plan (plan.ts)
 * says, over its wire (http.ts). One per tab or process (createGemini), so what it knows of a
 * key (its pace) holds for every request sent through it.
 */

/** The keys as they are now: Key (cheap, free tier), Key 2 (reliable, paid); '' when not set. */
export type GeminiKeys = Record<KeyName, string>;

export interface GeminiOptions {
  /**
   * Reads the keys: before every try, so a key set or forgotten meanwhile is the one used. The
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
 * Tries a minute per key, across all requests: under the free tier's 15 for Flash-Lite, so
 * the quota isn't what fails a try (docs/lab-meal-prompt.md, The model).
 */
export const PER_MINUTE = 9;

const NO_KEY = 'no Gemini key';

export function createGemini(options: GeminiOptions): Provider {
  const {
    keys,
    online = () => navigator.onLine,
    now = () => performance.now(),
    wait = defaultWait,
  } = options;
  /** When each key's recent tries were sent. */
  const sentAt: Record<KeyName, number[]> = { key: [], key2: [] };

  /** Waits for the key's next turn within PER_MINUTE, then takes it. */
  async function pace(key: KeyName, o: AskOptions) {
    const sent = sentAt[key];
    for (;;) {
      while (sent.length > 0 && sent[0]! + 60_000 <= now()) sent.shift();
      if (sent.length < PER_MINUTE) {
        sent.push(now());
        return;
      }
      const waitMs = Math.ceil(sent[0]! + 60_000 - now());
      o.onProgress?.({ why: 'quota', waitMs });
      await wait(waitMs, o.signal);
      if (o.signal?.aborted) return;
    }
  }

  async function ask(request: ModelRequest, o: AskOptions): Promise<Answered> {
    const started = now();
    if (!online()) throw new ModelError('offline', { sent: false });
    if (!hasKey(await keys())) throw new ModelError(NO_KEY, { sent: false });
    const body = JSON.stringify(await requestBody(request, o.files));

    const attempts: Attempt[] = [];
    const tried: Tried[] = [];
    let last: GeminiError | undefined;
    const fail = (message: string, reply = last?.reply) =>
      new ModelError(message, {
        sent: attempts.length > 0,
        ...(reply && { reply }),
        attempts,
      });

    for (;;) {
      const set = await keys();
      const step = nextStep({
        urgency: o.urgency,
        elapsedMs: now() - started,
        keys: { key: !!set.key, key2: !!set.key2 },
        tried,
      });
      if (!step) throw fail(last?.message ?? NO_KEY);
      if (step.waitMs > 0) {
        o.onProgress?.({ why: 'busy', waitMs: step.waitMs });
        await wait(step.waitMs, o.signal);
      }
      if (!o.signal?.aborted) await pace(step.key, o);
      if (o.signal?.aborted) throw fail('cancelled');
      // the key as it is now: forgotten while waiting, the other one if there is one
      const current = await keys();
      const name: KeyName = current[step.key] ? step.key : step.key === 'key' ? 'key2' : 'key';
      const key = current[name];
      if (!key) throw fail(NO_KEY);

      o.onProgress?.({ why: 'sending', waitMs: 0 });
      const t = now();
      const ms = () => Math.round(now() - t);
      try {
        const reply = await send(key, request.model, body, {
          timeoutMs: step.timeoutMs,
          signal: o.signal,
        });
        attempts.push({ key: name, ms: ms() });
        return { ...reply, attempts };
      } catch (err) {
        const e = err instanceof GeminiError ? err : new GeminiError(String(err));
        attempts.push({
          key: name,
          ms: ms(),
          error: e.message,
          ...(e.cancelled && { cancelled: true }),
        });
        if (e.cancelled) throw fail('cancelled', undefined);
        tried.push({ key: name, busy: e.busy });
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
