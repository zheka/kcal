import type { Meal } from './meal';

/**
 * What a meal update sends besides the prompt (prompt-v4.md, the system instruction): the
 * context as the first part of the user's content, then the input itself (texts, photos,
 * scanned products), each a part of its own, in the order attached, and last the CHECKLIST (the
 * rules most often broken, restated after the input, where Gemini heeds them best). Shared by
 * the lab and the bench script (scripts/meal-bench.ts), so it imports nothing at run time.
 */

export interface MealContext {
  /** The answer language (`ru`). */
  language: string;
  now: Date;
  /** The meal as last answered, with the user's choices; null for a new meal. */
  meal: Meal | null;
  /** Names of rows the user removed (×), so they don't come back. */
  removed: readonly string[];
}

export function contextText({ language, now, meal, removed }: MealContext): string {
  return [
    `answer language: ${language}`,
    `time: ${now.toTimeString().slice(0, 5)}`,
    `meal so far: ${meal && meal.items.length > 0 ? JSON.stringify(meal) : 'none (a new meal)'}`,
    `removed by the user: ${removed.length > 0 ? removed.map((r) => `"${r}"`).join(', ') : 'none'}`,
    '',
    'The input follows as separate parts, in the order given: texts, photos, and scanned ' +
      'products as JSON (Open Food Facts data, with their published values).',
  ].join('\n');
}

/** The last part of every request: what to check before answering. */
export const CHECKLIST = `Before answering, check your answer against the rules:
- Only the meal in focus; table condiments (bottles, dispensers) left out.
- Each kind of piece its own row; a plate or tray of separate foods is not a dish.
- A kind question where a look-alike (meat, fish, filling) changes 80+ kcal or 10+ g protein; no
  question under that, and none about what the input states.
- Amount = count × size: a weight in one place only; a dish's parts per serving.
- Every question with options has a short why; chosen is one of its labels.`;
