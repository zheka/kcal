/**
 * The model request for a meal, sent as SETTINGS say: the system instruction (prompt.md, passed in: the lab imports it,
 * scripts read it), then the context, then the input, each a part of its own in the order given,
 * then the CHECKLIST (instructions after a large input are heeded best). Only what the user gave:
 * no meal so far is sent back, so every request perceives the whole input afresh.
 */
import type { ModelRequest, Part } from '../ai/model.ts';
import { MEAL_SCHEMA } from './schema.ts';
import { SETTINGS } from './settings.ts';

/** What the user gave: a text, a photo (by its id), a scanned product (its data as is). */
export type Input = { text: string } | { photo: string } | { product: unknown };

export interface MealRequest {
  prompt: string;
  /** The answer language (`ru`). */
  language: string;
  now: Date;
  inputs: Input[];
}

export function mealRequest(r: MealRequest): ModelRequest {
  const parts: Part[] = r.inputs.map((i) =>
    'text' in i
      ? { text: i.text }
      : 'photo' in i
        ? { image: i.photo }
        : { text: JSON.stringify(i.product) },
  );
  return {
    model: SETTINGS.model,
    instructions: r.prompt,
    content: [{ text: contextText(r.language, r.now) }, ...parts, { text: CHECKLIST }],
    config: {
      schema: MEAL_SCHEMA,
      schemaFormat: 'json',
      temperature: SETTINGS.temperature,
      thinking: SETTINGS.thinking,
    },
  };
}

export function contextText(language: string, now: Date): string {
  return [
    `answer language: ${language}`,
    `time: ${now.toTimeString().slice(0, 5)}`,
    '',
    'The input follows as separate parts, in the order given: texts, photos, and scanned ' +
      'products as JSON (Open Food Facts data, with their published values).',
  ].join('\n');
}

/** The last part of every request: what to check before answering. */
export const CHECKLIST = `Before answering, check:
- Only the meal in focus; table condiments left out; all of it eaten by the user alone.
- Dishes named as a menu or a food diary would, the same each time; never a plate, cup or
  board, the meal, an amount or a doubt; bread, a drink, a dessert are dishes of their own.
- Each kind of piece its own product; pieces counted (3 яйца: count 3, unit_amount 50).
- unit_amount is one piece when count is set, else the whole amount: never a total counted again.
- A stated total weight is one product of that weight.
- Alternatives only for real doubt, never for what the input states or the photo shows clearly;
  unsure what a food is: alternatives that are different foods; one change per alternative.`;
