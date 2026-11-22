/**
 * A model request and its outcome, the same whatever the provider: what an experiment builds,
 * what the lab logs, what an adapter (gemini.ts) turns into its provider's own request and back.
 */

/** One part of the request's content, in order: text, or a photo by its lab file id. */
export type Part = { text: string } | { image: string };

/**
 * How the model answers: the answer's JSON schema; `temperature` (null: the model's default);
 * `thinking` off asks it not to reason before answering (faster; a model that can't turn it off
 * refuses the request, which says so).
 */
export interface Config {
  schema: object;
  temperature: number | null;
  thinking: 'default' | 'off';
}

/** The settings part of Config: what the user picks. */
export type Options = Omit<Config, 'schema'>;

export const DEFAULT_OPTIONS: Options = { thinking: 'default', temperature: 0.2 };

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
  constructor(
    message: string,
    readonly options: { sent: boolean; busy?: boolean; reply?: Omit<Reply, 'text'> },
  ) {
    super(message);
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

/** Waits before each new try of a busy provider: two more tries. */
export const RETRY_DELAYS_MS = [5_000, 15_000];

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
}

/**
 * Sends the request, again after a busy provider (RETRY_DELAYS_MS), and reads the answer: JSON
 * that fits `check`. Null when nothing was sent (no key, offline): nothing to log then. A
 * response with `error` has no usable answer.
 */
export async function run(
  request: ModelRequest,
  options: RunOptions,
): Promise<ModelResponse | null> {
  const {
    send,
    check,
    onRetry,
    notSent,
    wait = (ms) => new Promise<void>((r) => setTimeout(r, ms)),
    now = () => performance.now(),
  } = options;
  const retried: string[] = [];
  const also = () => (retried.length > 0 ? { retried } : {});
  for (let attempt = 0; ; attempt++) {
    const started = now();
    const ms = () => Math.round(now() - started);
    let reply: Reply;
    try {
      reply = await send(request);
    } catch (err) {
      const error = err instanceof ModelError ? err : null;
      if (error && !error.options.sent) {
        notSent?.(error.message);
        return null;
      }
      const delay = RETRY_DELAYS_MS[attempt];
      if (error?.options.busy && delay !== undefined) {
        retried.push(error.message);
        onRetry?.(attempt + 2, RETRY_DELAYS_MS.length + 1, delay);
        await wait(delay);
        continue;
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
}
