import type { AiTask, Thinking } from '../config.ts';
import type { Settings } from '../core/types.ts';
import type { PhotoSize } from './image.ts';

/**
 * How the app asks a model, per task: built in, and overridden by `settings.ai` (only the model
 * settings: what's sent in a request). Photos, retries and the timeout are the app's, not
 * settings: they are about the phone, not the model. The lab's tasks have their own (e.g.
 * src/lab/meal/settings.ts), longer on retries: a test shouldn't lose a request to a busy minute.
 */

export interface TaskSettings {
  model: string;
  thinking: Thinking;
  /** null: the model's own default. */
  temperature: number | null;
  photo: PhotoSize;
}

const BUILT_IN: Record<AiTask, TaskSettings> = {
  /** What a product is, from a photo or words: its name and values, for the product form. */
  product: {
    model: 'gemini-3.5-flash-lite',
    thinking: 'low',
    temperature: null,
    photo: { maxSide: 1024, quality: 85 },
  },
};

/** A request in a form: shorter than the lab's, and tried again once or twice only. */
export const APP_REQUEST = {
  /** Waits before each new try of a busy model: their number is how many more tries. */
  retryDelaysMs: [3_000, 10_000],
  timeoutMs: 40_000,
} as const;

/** A task's settings: built in, with what the user's settings override. */
export function taskSettings(settings: Settings, task: AiTask): TaskSettings {
  const own = settings.ai[task] ?? {};
  return {
    ...BUILT_IN[task],
    ...(own.model !== undefined && { model: own.model }),
    ...(own.thinking !== undefined && { thinking: own.thinking }),
    ...(own.temperature !== undefined && { temperature: own.temperature }),
  };
}
