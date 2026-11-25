import { ModelError, type ModelRequest, type Reply } from '../model.ts';
import type { Answered, AskOptions, Attempt, Provider } from '../provider.ts';
import { GeminiError, requestBody, send } from './http.ts';
import { cooldownMs, type KeyName, type KeyState, nextStep, type Step, type Why } from './plan.ts';

/** A try on its way: with which key, its attempt as logged, when sent, how to cancel it. */
interface Try {
  name: KeyName;
  key: string;
  attempt: Attempt;
  t: number;
  controller: AbortController;
  /** Its outcome: never rejects. */
  done: Promise<{ r: Try; reply: Reply } | { r: Try; error: GeminiError }>;
}

/**
 * Gemini as a Provider (provider.ts): asks with the user's keys, each step as its plan (plan.ts)
 * says, over its wire (http.ts): up to a try per key on its way at once (a hedge), the first
 * answer taken and the other cancelled. One per tab or process (createGemini), so what it learns of a
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
    /** The tries on their way, by key. */
    const running = new Map<KeyName, Try>();
    /** A key's or the request's own error: no new tries; a try on its way may still answer. */
    let stopped: ModelError | undefined;
    let last: GeminiError | undefined;
    const since = (t: number) => t - started;
    const fail = (message: string, more: { reply?: GeminiError['reply']; key?: KeyName } = {}) =>
      new ModelError(message, {
        sent: attempts.length > 0,
        ...(more.reply && { reply: more.reply }),
        ...(more.key && { key: more.key }),
        attempts,
      });
    /** Gives up the tries on their way: another answered, or the caller aborted. */
    const cancelRunning = () => {
      for (const r of running.values()) {
        r.attempt.ms = Math.round(now() - r.t);
        r.attempt.cancelled = true;
        r.controller.abort();
      }
      running.clear();
    };

    function start(name: KeyName, key: string, step: { timeoutMs: number; why?: Why }): void {
      if (name === 'key') sentAt.set(key, [...(sentAt.get(key) ?? []), now()]);
      o.onProgress?.({ why: step.why === 'slow' ? 'slow' : 'sending', waitMs: 0 });
      const t = now();
      const attempt: Attempt = {
        key: name,
        keyEnd: key.slice(-4),
        at: Math.round(since(t)),
        ms: 0,
        ...(step.why && { why: step.why }),
      };
      attempts.push(attempt);
      const controller = new AbortController();
      const r = { name, key, attempt, t, controller } as Try;
      r.done = send(key, request.model, body, {
        timeoutMs: step.timeoutMs,
        signal: AbortSignal.any([controller.signal, ...(o.signal ? [o.signal] : [])]),
      }).then(
        (reply) => ({ r, reply }),
        (err: unknown) => ({
          r,
          error: err instanceof GeminiError ? err : new GeminiError(String(err)),
        }),
      );
      running.set(name, r);
    }

    for (;;) {
      if (o.signal?.aborted) {
        cancelRunning();
        throw fail('cancelled');
      }
      let step: Step | null = null;
      if (!stopped) {
        const set = await keys();
        const state = (name: KeyName): KeyState => ({
          set: !!set[name],
          coolMs: since(coolUntil.get(set[name]) ?? -Infinity),
          paceMs: name === 'key' ? since(paceUntil(set[name])) : -Infinity,
          busy: busy[name].n,
          busyEndMs: busy[name].endMs,
          running: running.has(name),
        });
        step = nextStep({
          urgency: o.urgency,
          elapsedMs: since(now()),
          keys: { key: state('key'), key2: state('key2') },
        });
        if (step && 'send' in step) {
          start(step.send, set[step.send], step);
          continue;
        }
      }

      if (running.size === 0) {
        if (stopped) throw stopped;
        if (!step) throw fail(last?.message ?? NO_KEY, { reply: last?.reply });
        // nothing on its way: a backoff or a quota to wait out
        const waitMs = Math.ceil(step.waitMs);
        if (step.why !== 'answer') o.onProgress?.({ why: step.why, waitMs });
        await wait(waitMs, o.signal);
        continue;
      }

      // a try on its way: its answer, or the step's time, whichever comes first
      const timer = new AbortController();
      const waitMs = step ? Math.ceil(step.waitMs) : Infinity;
      const ticked = Number.isFinite(waitMs)
        ? wait(waitMs, AbortSignal.any([timer.signal, ...(o.signal ? [o.signal] : [])])).then(
            () => null,
          )
        : new Promise<null>(() => {});
      const outcome = await Promise.race([ticked, ...[...running.values()].map((r) => r.done)]);
      timer.abort();
      if (!outcome) continue;

      const { r } = outcome;
      running.delete(r.name);
      r.attempt.ms = Math.round(now() - r.t);
      if ('reply' in outcome) {
        cancelRunning();
        return { ...outcome.reply, attempts };
      }
      const e = outcome.error;
      r.attempt.error = e.message;
      if (e.kind === 'cancelled') r.attempt.cancelled = true;
      else if (e.kind === 'key')
        stopped ??= fail(`${LABEL[r.name]}: ${e.message}`, { key: r.name });
      else if (e.kind === 'final') stopped ??= fail(e.message, { reply: e.reply });
      else if (e.kind === 'quota') coolUntil.set(r.key, now() + cooldownMs(e.quota!));
      else busy[r.name] = { n: busy[r.name].n + 1, endMs: since(now()) };
      if (e.kind === 'quota' || e.kind === 'busy') last = e;
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
