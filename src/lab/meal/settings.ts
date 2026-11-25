/**
 * How the meal request is sent, for the lab and the command-line tool alike (scripts/meal.ts, the
 * bench): one place, kept with the prompt (prompt.md) and the schema (schema.ts). Changed here,
 * not per run or in the lab's menu, so that runs and answers are comparable. How Gemini gets the
 * answer within the urgency (keys, retries, its quota) is Gemini's (src/ai/gemini/). Why each:
 * docs/lab-meal-prompt.md, The model.
 */
export const SETTINGS = {
  /** Flash-Lite: the cheapest and fastest, with the most generous free quota. */
  model: 'gemini-3.5-flash-lite',
  /** Thinks only when it judges a request hard; `medium` thinks always, at twice the time. */
  thinking: 'low',
  /** The model's default (null): Gemini 3 reasons worse away from it. */
  temperature: null,
  /** Photos as sent (shrunk by src/ai/image.ts and the tool alike): longer side, quality. */
  photo: { maxSide: 1024, quality: 85 },
  /**
   * No target: Key 2 is never spent (the lab is a test as much as the bench is: free, and runs
   * comparable); given up after 5 minutes. Long for a phone, but a busy minute (503s at a busy
   * hour) shouldn't lose a run.
   */
  urgency: { targetMs: Infinity, limitMs: 300_000 },
} as const;
