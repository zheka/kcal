/**
 * How the meal request is sent, for the lab and the command-line tool alike (scripts/meal.ts, the
 * bench): one place, kept with the prompt (prompt.md) and the schema (schema.ts). Changed here,
 * not per run or in the lab's menu, so that runs and answers are comparable; only the urgency is
 * the lab's alone. How Gemini gets the answer within the urgency (keys, retries, its quota) is
 * Gemini's (src/ai/gemini/). Why each: docs/lab-meal-prompt.md, The model.
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
   * The lab's: someone waits at the phone, less hurried than at the app's form: by 30 s, Key 2
   * spent if Key can't make it (busy a few times, out of its quota); given up after 90 s. The
   * tool and the bench have their own (scripts/meal-tool.ts).
   */
  urgency: { targetMs: 30_000, limitMs: 90_000 },
} as const;
