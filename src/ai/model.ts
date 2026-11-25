import type { Attempt, AskOptions, Provider } from './provider.ts';

/**
 * A model request and its outcome, the same whatever the provider: what a task builds (the
 * lab's meal, the app's), what the lab logs, what a provider (provider.ts; gemini/) turns into
 * its service's own request and back.
 */

/**
 * One part of the request's content, in order: text, or a file (a photo, say) by an id the
 * caller's FileSource resolves (provider.ts), so a request, as logged, never holds a file's data.
 */
export type Part = { text: string } | { file: string };

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
 * it is logged; `reply`: what came back anyway; `attempts`: the tries it took.
 */
export class ModelError extends Error {
  readonly options: { sent: boolean; reply?: Omit<Reply, 'text'>; attempts?: Attempt[] };
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
  /** From asking to the answer (or giving up): every try and wait included. */
  ms: number;
  /** Each try, in order (provider.ts, Attempt). */
  attempts?: Attempt[];
  /** The answer, when it is JSON (whether it fits the schema or not). */
  answer?: unknown;
  /** The answer's text parts as received, when they aren't JSON. */
  undecoded?: string[];
  /** Why there is no usable answer, when there isn't. */
  error?: string;
}

export interface RunOptions extends AskOptions {
  provider: Provider;
  /** What doesn't fit the answer's shape, if anything: then the answer isn't usable. */
  check: (answer: unknown) => string[];
  /** Nothing was sent (no key, offline): why. */
  notSent?: (why: string) => void;
  now?: () => number;
}

/**
 * Asks the provider (which tries as often as the urgency allows) and reads the answer: JSON
 * that fits `check`. A usable reply is never asked again: an answer that doesn't fit is the
 * prompt's problem, not the provider's. Null when nothing was sent (no key, offline): nothing
 * to log then. A response with `error` has no usable answer.
 */
export async function run(
  request: ModelRequest,
  options: RunOptions,
): Promise<ModelResponse | null> {
  const { provider, check, notSent, now = () => performance.now(), ...ask } = options;
  const started = now();
  const ms = () => Math.round(now() - started);
  let answered;
  try {
    answered = await provider.ask(request, ask);
  } catch (err) {
    const error = err instanceof ModelError ? err : null;
    if (error && !error.options.sent) {
      notSent?.(error.message);
      return null;
    }
    return {
      ...error?.options.reply,
      ms: ms(),
      ...(error?.options.attempts && { attempts: error.options.attempts }),
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const { text, ...about } = answered;
  const done = { ...about, ms: ms() };
  if (text.length === 0) return { ...done, error: `no answer: ${answered.stop ?? 'no text'}` };
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
