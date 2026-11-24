import { withRetries } from '../data/retry.ts';

/**
 * A model request and its outcome, the same whatever the provider: what a task builds (the
 * lab's meal, the app's), what the lab logs, what an adapter (gemini.ts) turns into its
 * provider's own request and back.
 */

/**
 * One part of the request's content, in order: text, or a photo by an id the sender resolves
 * (gemini.ts, PhotoData), so a request, as logged, never holds a photo's data.
 */
export type Part = { text: string } | { image: string };

/**
 * How the model answers: the answer's schema, Google's OpenAPI subset unless `schemaFormat` is
 * `json` (standard JSON Schema, kept in its key order); `temperature` (null: the model's default);
 * `thinking` off asks it not to reason before answering (faster; a model that can't turn it off
 * refuses the request, which says so), a level asks for that much (Gemini 3).
 */
export interface Config {
  schema: object;
  schemaFormat?: 'json';
  temperature: number | null;
  thinking: 'default' | 'off' | ThinkingLevel;
}

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export interface ModelRequest {
  /** As asked: an id or an alias. */
  model: string;
  /** The system instruction; empty for none. */
  instructions: string;
  content: Part[];
  config: Config;
}

/** What a provider sent back, decoded by its adapter. */
export interface Reply {
  /** The model that answered (an alias resolved), when the provider says. */
  model?: string;
  /** Why it stopped: end, max_tokens, safety, or `other: <the provider's reason>`. */
  stop?: string;
  tokens?: { input: number; output: number; thinking?: number };
  /** The answer's text parts, as received (reasoning left out). */
  text: string[];
}

/**
 * A request that got no usable reply. `sent`: it reached the provider (or was on its way), so
 * it is logged; `busy`: worth trying again a little later; `reply`: what came back anyway.
 */
export class ModelError extends Error {
  readonly options: { sent: boolean; busy?: boolean; reply?: Omit<Reply, 'text'> };
  constructor(message: string, options: ModelError['options']) {
    super(message);
    this.options = options;
  }
}

/** The outcome of a request, as logged. */
export interface ModelResponse {
  model?: string;
  stop?: string;
  tokens?: Reply['tokens'];
  /** From sending to the whole reply, of the last try. */
  ms: number;
  /** The busy errors of the tries before, when there were any. */
  retried?: string[];
  /** The answer, when it is JSON (whether it fits the schema or not). */
  answer?: unknown;
  /** The answer's text parts as received, when they aren't JSON. */
  undecoded?: string[];
  /** Why there is no usable answer, when there isn't. */
  error?: string;
}

export interface RunOptions {
  /** Sends the request (an adapter, with its key and photos), timing out by itself. */
  send: (request: ModelRequest) => Promise<Reply>;
  /** What doesn't fit the answer's shape, if anything: then the answer isn't usable. */
  check: (answer: unknown) => string[];
  /** A busy provider: which try comes next, of how many, after how long. */
  onRetry?: (attempt: number, of: number, delayMs: number) => void;
  /** Nothing was sent (no key, offline): why. */
  notSent?: (why: string) => void;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
  /** The waits before each new try of a busy provider: their number is how many more tries. */
  delays: readonly number[];
}

/**
 * Sends the request, again after a busy provider (`delays`), and reads the answer: JSON
 * that fits `check`. Null when nothing was sent (no key, offline): nothing to log then. A
 * response with `error` has no usable answer.
 */
export async function run(
  request: ModelRequest,
  options: RunOptions,
): Promise<ModelResponse | null> {
  const { send, check, onRetry, notSent, wait, now = () => performance.now(), delays } = options;
  const retried: string[] = [];
  const also = () => (retried.length > 0 ? { retried } : {});
  let started = 0;
  const ms = () => Math.round(now() - started);
  let reply: Reply;
  try {
    reply = await withRetries(
      () => {
        started = now();
        return send(request);
      },
      {
        delays,
        retriable: (err) => err instanceof ModelError && !!err.options.busy,
        onRetry: (err, attempt, of, delay) => {
          retried.push(err instanceof Error ? err.message : String(err));
          onRetry?.(attempt, of, delay);
        },
        ...(wait && { wait }),
      },
    );
  } catch (err) {
    const error = err instanceof ModelError ? err : null;
    if (error && !error.options.sent) {
      notSent?.(error.message);
      return null;
    }
    return {
      ...error?.options.reply,
      ms: ms(),
      ...also(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const { text, ...about } = reply;
  const done = { ...about, ms: ms(), ...also() };
  if (text.length === 0) return { ...done, error: `no answer: ${reply.stop ?? 'no text'}` };
  let answer: unknown;
  try {
    answer = JSON.parse(text.join(''));
  } catch {
    return { ...done, undecoded: text, error: 'answer isn’t JSON' };
  }
  const problems = check(answer);
  return problems.length > 0
    ? { ...done, answer, error: `answer doesn’t fit the schema: ${problems.join('; ')}` }
    : { ...done, answer };
}
