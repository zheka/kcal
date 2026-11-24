import type { ModelRequest, ModelResponse } from '../../ai/model';
import { process, type Processed } from '../meal/process';
import PROMPT from '../meal/prompt.md?raw';
import { readMeal } from '../meal/read';
import { mealRequest } from '../meal/request';
import type { Attached, ComposedMeal } from './types';

/**
 * Updating a meal: one request with its whole context, as attached (the same request as the
 * command-line tool's: src/lab/meal/request.ts); the answer, read forgivingly, replaces
 * the meal and the user's answers.
 */

/** The request for the meal: each attached thing as an input, in order. */
export function updateRequest(meal: ComposedMeal, now: Date, language: string): ModelRequest {
  return mealRequest({
    prompt: PROMPT,
    language,
    now,
    inputs: meal.context.map((a) =>
      a.kind === 'text'
        ? { text: a.text }
        : a.kind === 'photo'
          ? { photo: a.file }
          : { product: a.product },
    ),
  });
}

/** Any JSON is read (read.ts repairs and flags what it must), as the tool reads it. */
export const checkAnswer = (): string[] => [];

/**
 * The meal after an update sent with `sent` as its context: the answer as read, with no answers
 * yet, or the meal as it was with why it failed (no response: nothing was sent). Context
 * attached or removed meanwhile still needs an update.
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
  const read = readMeal(response.answer).meal;
  const rest = { ...meal };
  delete rest.failed;
  return { ...rest, meal: read, answers: {}, title: read.title || meal.title, changed: !same };
}

/** The meal as shown: the answer processed, with the user's answers; null before any. */
export function shown(meal: ComposedMeal, language: string): Processed | null {
  return meal.meal ? process(meal.meal, language, meal.answers) : null;
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
