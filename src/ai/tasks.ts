import type { Config } from './model.ts';
import type { PhotoSize } from './image.ts';

/**
 * How the app asks a model, per task: built in, like the task's prompt and schema, because the
 * prompt is tuned to exactly this model, thinking and temperature (a change goes through the
 * bench, then into a build). Nothing here is a user setting; the user only gives each known
 * provider its key (src/state/keys.ts). The lab's tasks have their own (src/lab/meal/settings.ts).
 */

/** The providers the app knows how to ask (src/ai/gemini.ts). */
export type Provider = 'gemini';

export interface TaskSettings {
  provider: Provider;
  /** An id or an alias, as the provider names it. */
  model: string;
  thinking: Config['thinking'];
  /** null: the model's own default. */
  temperature: Config['temperature'];
  /** How photos are sent. */
  photo: PhotoSize;
}

export const TASKS = {
  /** What a product is, from a photo or words: its name and values, for the product form. */
  product: {
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    thinking: 'low',
    temperature: null,
    photo: { maxSide: 1024, quality: 85 },
  },
} as const satisfies Record<string, TaskSettings>;

/**
 * A request from a form: shorter than the lab's, which may wait minutes for a busy model; here
 * someone is waiting, and can type the values instead.
 */
export const APP_REQUEST = {
  /** Waits before each new try of a busy model: their number is how many more tries. */
  retryDelaysMs: [3_000, 10_000],
  timeoutMs: 40_000,
} as const;
