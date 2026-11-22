import type { Answer, Item, Parameter, Per100, Source, Variant } from './types';

/**
 * The model's answer: its shape as a Gemini response schema (an OpenAPI subset), following the
 * output format in prompt-v3.txt, and strict reading of what comes back. Nothing in the answer is
 * trusted: an item that isn't of the expected shape is left out and reported.
 */

const NUMBER = { type: 'NUMBER' };
const STRING = { type: 'STRING' };

const PER_100G = {
  type: 'OBJECT',
  properties: {
    kcal: NUMBER,
    protein: NUMBER,
    fat: NUMBER,
    carbs: NUMBER,
    water_ml: { type: 'NUMBER', nullable: true },
  },
  required: ['kcal', 'protein', 'fat', 'carbs', 'water_ml'],
};

export const ANSWER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    meal_label: STRING,
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: STRING,
          count: NUMBER,
          unit: STRING,
          grams_per_unit: NUMBER,
          per_100g: PER_100G,
          source: { type: 'STRING', enum: ['visual', 'published', 'history'] },
          amount_flag: { type: 'BOOLEAN' },
          likely_counts: { type: 'ARRAY', items: NUMBER },
          parameters: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: STRING,
                variants: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      label: STRING,
                      per_100g: { ...PER_100G, nullable: true },
                      grams_per_unit: { type: 'NUMBER', nullable: true },
                    },
                    required: ['label', 'per_100g', 'grams_per_unit'],
                  },
                },
                default: STRING,
                surfaced: { type: 'BOOLEAN' },
                why: STRING,
              },
              required: ['name', 'variants', 'default', 'surfaced', 'why'],
            },
          },
        },
        required: [
          'name',
          'count',
          'unit',
          'grams_per_unit',
          'per_100g',
          'source',
          'amount_flag',
          'likely_counts',
          'parameters',
        ],
      },
    },
    dropped: { type: 'ARRAY', items: STRING },
    out_of_focus: { type: 'ARRAY', items: STRING },
  },
  required: ['meal_label', 'items', 'dropped', 'out_of_focus'],
} as const;

/** Reads the model's JSON text (see readAnswer). */
export function parseAnswer(text: string): { answer: Answer; problems: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { answer: empty(), problems: ['the answer is not JSON'] };
  }
  return readAnswer(raw);
}

/**
 * Reads the model's answer, decoded: the usable items, and a problem for each thing left out.
 * The composer takes an answer only when there are no problems.
 */
export function readAnswer(raw: unknown): { answer: Answer; problems: string[] } {
  const problems: string[] = [];
  if (!isObject(raw) || !Array.isArray(raw.items)) {
    return { answer: empty(), problems: ['the answer has no list of items'] };
  }
  const items: Item[] = [];
  raw.items.forEach((x: unknown, i) => {
    const item = readItem(x, `item #${i + 1}`, problems);
    if (item) items.push(item);
  });
  return {
    answer: {
      meal_label: typeof raw.meal_label === 'string' ? raw.meal_label.trim() : '',
      items,
      dropped: strings(raw.dropped),
      out_of_focus: strings(raw.out_of_focus),
    },
    problems,
  };
}

function readItem(x: unknown, where: string, problems: string[]): Item | null {
  if (!isObject(x)) return (problems.push(`${where}: not an object`), null);
  const name = typeof x.name === 'string' ? x.name.trim() : '';
  if (!name) return (problems.push(`${where}: no name`), null);
  const at = `${where} "${name}"`;
  if (!positive(x.count)) return (problems.push(`${at}: no positive count`), null);
  if (!positive(x.grams_per_unit))
    return (problems.push(`${at}: no positive grams_per_unit`), null);
  const per_100g = readPer100(x.per_100g);
  if (!per_100g) return (problems.push(`${at}: per_100g is missing or not numbers`), null);
  const parameters: Parameter[] = [];
  for (const p of Array.isArray(x.parameters) ? x.parameters : []) {
    const parameter = readParameter(p, at, problems);
    if (parameter) parameters.push(parameter);
  }
  const flag = x.amount_flag === true;
  return {
    name,
    count: x.count,
    unit: typeof x.unit === 'string' && x.unit.trim() ? x.unit.trim() : 'g',
    grams_per_unit: x.grams_per_unit,
    per_100g,
    source: (['visual', 'published', 'history'] as const).includes(x.source as Source)
      ? (x.source as Source)
      : 'visual',
    amount_flag: flag,
    // likely values only for a flagged amount (prompt v2), positive and distinct
    likely_counts: flag
      ? [...new Set(Array.isArray(x.likely_counts) ? x.likely_counts.filter(positive) : [])]
      : [],
    parameters,
  };
}

function readParameter(x: unknown, at: string, problems: string[]): Parameter | null {
  if (!isObject(x) || typeof x.name !== 'string' || !Array.isArray(x.variants)) {
    return (problems.push(`${at}: a parameter without a name or variants`), null);
  }
  const variants: Variant[] = [];
  for (const v of x.variants) {
    if (!isObject(v) || typeof v.label !== 'string' || !v.label.trim()) continue;
    variants.push({
      label: v.label.trim(),
      per_100g: readPer100(v.per_100g),
      grams_per_unit: positive(v.grams_per_unit) ? v.grams_per_unit : null,
    });
  }
  if (variants.length === 0) {
    return (problems.push(`${at}, "${x.name}": no usable variants`), null);
  }
  const chosen = typeof x.default === 'string' ? x.default.trim() : '';
  const known = variants.some((v) => v.label === chosen);
  if (!known) problems.push(`${at}, "${x.name}": default "${chosen}" isn't a variant`);
  return {
    name: x.name.trim(),
    variants,
    default: known ? chosen : variants[0]!.label,
    surfaced: x.surfaced === true,
    why: typeof x.why === 'string' ? x.why : '',
  };
}

function readPer100(x: unknown): Per100 | null {
  if (!isObject(x)) return null;
  const { kcal, protein, fat, carbs } = x;
  if (![kcal, protein, fat, carbs].every(nonNegative)) return null;
  return {
    kcal: kcal as number,
    protein: protein as number,
    fat: fat as number,
    carbs: carbs as number,
    water_ml: nonNegative(x.water_ml) ? x.water_ml : null,
  };
}

const empty = (): Answer => ({ meal_label: '', items: [], dropped: [], out_of_focus: [] });
const positive = (x: unknown): x is number => typeof x === 'number' && x > 0 && isFinite(x);
const nonNegative = (x: unknown): x is number => typeof x === 'number' && x >= 0 && isFinite(x);
const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
