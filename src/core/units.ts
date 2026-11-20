import { BASES, NUTRIENTS } from '../config';
import { roundStored } from './decimal';
import { nameKey } from './text';
import type { NutrientValues } from './types';

/** `g` and `ml` are a product's bases and can't name its own units (ignoring case). */
export function isReservedProductUnitName(name: string): boolean {
  return (BASES as readonly string[]).includes(nameKey(name));
}

/**
 * Converts values copied from a label's column (per 100 g, per bar of 45 g, per 100 ml, per
 * cup of 250 ml…) to values per 1 g or 1 ml, rounded for storing. `amount` is how many g or
 * ml the column is about. Every given value is kept, 0 included (a value that rounds to 0 is
 * stored as 0); values not given stay omitted.
 */
export function perOneFrom(values: NutrientValues, amount: number): NutrientValues {
  const result: NutrientValues = {};
  for (const n of NUTRIENTS) {
    const v = values[n];
    if (v !== undefined) result[n] = roundStored(v / amount) || 0; // never -0
  }
  return result;
}
