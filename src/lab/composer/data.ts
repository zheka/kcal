import type { ComposedMeal } from './types';

/**
 * Everything the composer keeps, as its one lab data object (kcal-lab-composer, see
 * src/lab/storage/lab.ts): the meals, and the answer language. How the model is asked (model,
 * thinking, retries) is src/lab/meal/settings.ts, the same as the tool's. Photos are lab files,
 * by id; the Gemini key is a lab secret ('gemini'), never in here.
 */
export interface ComposerData {
  /** Newest first. */
  meals: ComposedMeal[];
  /** The language to answer in (`ru`): names, units, scanned products' names. */
  language: string;
}

export const EMPTY: ComposerData = { meals: [], language: 'ru' };

/**
 * What was kept, with anything missing at its default. A meal of an older shape keeps what it is
 * composed from, without its answer (another format): an update makes it again.
 */
export function fromStored(stored: Partial<ComposerData> | undefined): ComposerData {
  return {
    meals: (stored?.meals ?? [])
      .filter((m) => Array.isArray(m.context)) // before whole-context updates: left out
      .map((m) => {
        if (m.answers) return m;
        const { id, title, at, context } = m;
        return { id, title, at, context, answers: {}, changed: context.length > 0 };
      }),
    language: stored?.language || EMPTY.language,
  };
}

/** A meal saved: replaced by id, or added; newest first. */
export function withMeal(meals: readonly ComposedMeal[], meal: ComposedMeal): ComposedMeal[] {
  const rest = meals.filter((m) => m.id !== meal.id);
  return [meal, ...rest].sort((a, b) => b.at.localeCompare(a.at));
}

export const round = (x: number) => Math.round(x);
export const one = (x: number) => String(Math.round(x * 10) / 10);
export const time = (utc: string) =>
  new Date(utc).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
