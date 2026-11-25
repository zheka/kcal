/**
 * Trying a request again after errors worth retrying (a busy or unreachable server), waiting
 * longer each time. Used for Open Food Facts lookups; model requests have their provider's own
 * (docs/ai.md).
 */
export interface RetryOptions {
  /** The waits before each new try, in ms: their number is how many more tries there are. */
  delays: readonly number[];
  /** Whether this error is worth another try. */
  retriable: (err: unknown) => boolean;
  /** Before a new try: the error that came before, which try is next (from 2), of how many. */
  onRetry?: (err: unknown, attempt: number, of: number, delayMs: number) => void;
  wait?: (ms: number) => Promise<void>;
}

export async function withRetries<T>(attempt: () => Promise<T>, options: RetryOptions): Promise<T> {
  const {
    delays,
    retriable,
    onRetry,
    wait = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = options;
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      const delay = delays[i];
      if (delay === undefined || !retriable(err)) throw err;
      onRetry?.(err, i + 2, delays.length + 1, delay);
      await wait(delay);
    }
  }
}
