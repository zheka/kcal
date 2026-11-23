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
}

export function contextText({ language, now, meal }: MealContext): string {
  return [
    `answer language: ${language}`,
    `time: ${now.toTimeString().slice(0, 5)}`,
    `meal so far: ${meal && meal.items.length > 0 ? JSON.stringify(meal) : 'none (a new meal)'}`,
    '',
    'The input follows as separate parts, in the order given: texts, photos, and scanned ' +
      'products as JSON (Open Food Facts data, with their published values).',
  ].join('\n');
}

/** The last part of every request: what to check before answering. */
export const CHECKLIST = `Before answering, check your answer against the rules:
- Only the meal in focus; table condiments (bottles, dispensers) left out; all of it eaten by the
  user alone, no questions about leftovers or sharing.
- Each kind of piece its own row; a plate or tray of separate foods is not a dish.
- Unsure what a food is: a kind question whose options are different foods (cod / chicken / pork).
- No question under 80 kcal or 10 g protein, and none about what the input states: a stated
  kind or amount has one option.
- Pieces counted (3 яйца = 3 шт., also in a dish); loose food portions named (маленькая /
  обычная / большая), never grams the user can't know; a size labelled "г" is 1 g.
- Amount = count × size: a weight in one place only; a dish's parts per serving.
- Every question with options has a short why; chosen is one of its labels.`;
