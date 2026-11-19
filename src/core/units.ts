import { GRAMS, NUTRIENTS } from '../config';
import { roundStored } from './decimal';
import { nameKey } from './text';
import type { NutrientValues } from './types';

/** `g` means grams and can't name a product's own unit (ignoring case). */
export function isReservedProductUnitName(name: string): boolean {
  return nameKey(name) === GRAMS;
}

/**
 * Converts values copied from a label's column (per 100 g, per bar of 45 g, per 100 ml with
 * the product's ml unit…) to values per gram, rounded for storing. `grams` is how much the
 * column is about. Zero values are left out: an omitted nutrient counts as 0.
 */
export function perGramFrom(values: NutrientValues, grams: number): NutrientValues {
  const result: NutrientValues = {};
  for (const n of NUTRIENTS) {
    const v = values[n];
    if (v === undefined) continue;
    const perGram = roundStored(v / grams);
    if (perGram !== 0) result[n] = perGram;
  }
  return result;
}
