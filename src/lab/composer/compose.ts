import type { AppData } from '../../core/types';
import type { ModelRequest, ModelResponse, Options } from '../ai/model';
import { ANSWER_SCHEMA, readAnswer } from './answer';
import { candidates, contextBlock, fillPrompt, pickMatches } from './context';
import type { Attached, ComposedMeal } from './types';

/**
 * Updating a meal: one request with its whole context, as attached, and the meal so far; the
 * answer replaces the items. (Next: what of the meal so far to send when context was removed,
 * see docs/lab.md.)
 */

/**
 * The request for the meal: prompt v3 (the meal so far and the history matches filled in), then
 * each attached thing as a part of its own, in order: a text, a photo by id, a scanned product
 * as JSON.
 */
export function updateRequest(
  meal: ComposedMeal,
  app: AppData | null,
  history: readonly ComposedMeal[],
  now: Date,
  model: string,
  options: Options,
): ModelRequest {
  const texts = meal.context.flatMap((a) => (a.kind === 'text' ? [a.text] : []));
  const others = history.filter((m) => m.id !== meal.id);
  const matches = pickMatches(candidates(app, others), texts.join('\n'), meal.items);
  return {
    model,
    instructions: '',
    content: [
      { text: fillPrompt(contextBlock(meal.items, matches, now)) },
      ...meal.context.map((a) =>
        a.kind === 'text'
          ? { text: a.text }
          : a.kind === 'photo'
            ? { image: a.file }
            : { text: JSON.stringify(a.product) },
      ),
    ],
    config: { schema: ANSWER_SCHEMA, ...options },
  };
}

/** What doesn't fit the answer's shape (strict: any problem and the answer isn't used). */
export function checkAnswer(answer: unknown): string[] {
  return readAnswer(answer).problems;
}

/**
 * The meal after an update sent with `sent` as its context: the answer's items and label, or
 * the meal as it was with why it failed (no response: nothing was sent). Context attached or
 * removed meanwhile still needs an update.
 */
export function applyUpdate(
  meal: ComposedMeal,
  sent: readonly Attached[],
  response: ModelResponse | null,
  notSent?: string,
): ComposedMeal {
  const error = response ? response.error : notSent;
  const same = sameContext(meal.context, sent);
  if (error !== undefined || !response) {
    return same ? { ...meal, failed: error ?? 'not sent' } : meal;
  }
  const { answer } = readAnswer(response.answer);
  const rest = { ...meal };
  delete rest.failed;
  return { ...rest, items: answer.items, title: answer.meal_label || meal.title, changed: !same };
}

/** The meal with a thing attached or removed: it needs an update, any failure is past. */
export function withContext(meal: ComposedMeal, context: Attached[]): ComposedMeal {
  const rest = { ...meal };
  delete rest.failed;
  return { ...rest, context, changed: true };
}

function sameContext(a: readonly Attached[], b: readonly Attached[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i]!.id);
}
