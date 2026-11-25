import type { Config } from './model.ts';
import type { PhotoSize } from './image.ts';
import type { Urgency } from './provider.ts';

/**
 * How the app asks a model, per task: built in, like the task's prompt and schema, because the
 * prompt is tuned to exactly this model, thinking and temperature (a change goes through the
 * bench, then into a build), and how soon the answer is needed (the provider decides how to get
 * it then: keys, retries; docs/ai.md). Nothing here is a user setting; the user only gives each
 * known provider its keys (src/ai/keys.ts). The lab's tasks have their own
 * (src/lab/meal/settings.ts).
 */

/** The providers the app knows how to ask (src/ai/gemini/). */
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
  urgency: Urgency;
}

export const TASKS = {
  /** What a product is, from a photo or words: its name and values, for the product form. */
  product: {
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    thinking: 'low',
    temperature: null,
    photo: { maxSide: 1024, quality: 85 },
    /**
     * Someone is waiting at the form, and can type the values instead: worth spending Key 2 to
     * answer within 15 s (Key gets a second try first; a median about 6 s); given up after 30 s.
     */
    urgency: { targetMs: 15_000, limitMs: 30_000 },
  },
} as const satisfies Record<string, TaskSettings>;
