import { MILLILITRES } from '../config';
import type { NutrientValues } from './types';
import { nameKey } from './text';

/** A food defined in the code: never stored, read-only, referred to by a fixed id. */
export interface BuiltinFood {
  id: string;
  name: string;
  perGram: NutrientValues;
  /** Units besides grams, which every built-in food has. */
  units: { id: string; name: string; grams: number }[];
}

export const BUILTIN_FOODS: readonly BuiltinFood[] = [
  {
    id: 'water',
    name: 'water',
    perGram: { water: 1 },
    units: [{ id: MILLILITRES, name: MILLILITRES, grams: 1 }],
  },
  { id: 'protein', name: 'protein', perGram: { kcal: 4, protein: 1 }, units: [] },
  { id: 'fat', name: 'fat', perGram: { fat: 1, kcal: 9 }, units: [] },
  { id: 'carbs', name: 'carbs', perGram: { carbs: 1, kcal: 4 }, units: [] },
];

export const WATER_ID = 'water';

const ids = new Set(BUILTIN_FOODS.map((f) => f.id));
const names = new Set(BUILTIN_FOODS.map((f) => nameKey(f.name)));

export function isBuiltinId(id: string): boolean {
  return ids.has(id);
}

/** Built-in foods' names are reserved for products and recipes, ignoring case. */
export function isBuiltinName(name: string): boolean {
  return names.has(nameKey(name));
}
