import { DEFAULT_OPTIONS, type Options } from '../ai/model';
import type { ComposedMeal } from './types';

/**
 * Everything the composer keeps, as its one lab data object (kcal-lab-composer, see
 * src/lab/storage/lab.ts): the meals, and the settings. Photos are lab
 * files, by id; the Gemini key is a lab secret ('gemini'), never in here.
 */
export interface ComposerData {
  /** Newest first. */
  meals: ComposedMeal[];
  /** The Gemini model; empty until the key's models are listed (then the newest Flash). */
  model: string;
  options: Options;
}

export const EMPTY: ComposerData = { meals: [], model: '', options: DEFAULT_OPTIONS };

/** What was kept, with anything missing (from an older shape) at its default. */
export function fromStored(stored: Partial<ComposerData> | undefined): ComposerData {
  return {
    // meals of an older shape (before whole-context updates) are left out
    meals: (stored?.meals ?? []).filter((m) => Array.isArray(m.context)),
    model: stored?.model ?? '',
    options: { ...DEFAULT_OPTIONS, ...stored?.options },
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
