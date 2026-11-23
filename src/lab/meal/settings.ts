/**
 * How the meal request is sent, for the lab and the command-line tool alike (scripts/meal.ts, the
 * bench), retries and timeout included: one place, kept with the prompt (prompt.md) and the schema (schema.ts), and recorded in
 * every log entry with the request. Changed here, not per run or in the lab's menu, so that runs
 * and answers are comparable. Why each: docs/lab-meal-prompt.md, The model.
 */
export const SETTINGS = {
  /** Flash-Lite: the cheapest and fastest, with the most generous free quota. */
  model: 'gemini-3.5-flash-lite',
  /** Thinks only when it judges a request hard; `medium` thinks always, at twice the time. */
  thinking: 'low',
  /** The model's default (null): Gemini 3 reasons worse away from it. */
  temperature: null,
  /** Requests a minute, retries included: under the free tier's 15 for Flash-Lite. */
  perMinute: 9,
  /** Photos as sent (shrunk by src/lab/ai/image.ts and the tool alike): longer side, quality. */
  photo: { maxSide: 1024, quality: 85 },
  /**
   * Waits before each new try of a busy model (503 at a busy hour, 429): five more tries over
   * about 4 minutes. Long for a phone, but the lab is a test too: a busy minute shouldn't lose it.
   */
  retryDelaysMs: [5_000, 15_000, 30_000, 60_000, 120_000],
  /** How long one try may take before it is given up (and tried again, as busy). */
  timeoutMs: 120_000,
} as const;
