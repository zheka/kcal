import { MASS_UNITS, SERVING_UNIT } from '../config';
import type { NutrientValues, Unit } from './types';
import { nameKey } from './text';

/** A unit a food can be measured in, built-in or its own. */
export interface UnitOption {
  /** What an ingredient stores: the built-in unit's name or the food's unit id. */
  id: string;
  name: string;
  grams: number;
}

/**
 * The units a food can be measured in, in selector order: the mass units, then the recipe's
 * `serving` (when it has servings), then the food's own units.
 */
export function unitOptions(own: readonly Unit[], servingGrams: number | null): UnitOption[] {
  const options: UnitOption[] = Object.entries(MASS_UNITS).map(([name, grams]) => ({
    id: name,
    name,
    grams,
  }));
  if (servingGrams !== null) {
    options.push({ id: SERVING_UNIT, name: SERVING_UNIT, grams: servingGrams });
  }
  return [...options, ...own.map(({ id, name, grams }) => ({ id, name, grams }))];
}

/** Grams of `amount` in the unit `unitId`, or undefined when the food has no such unit. */
export function toGrams(
  options: readonly UnitOption[],
  unitId: string,
  amount: number,
): number | undefined {
  const unit = options.find((u) => u.id === unitId);
  return unit ? unit.grams * amount : undefined;
}

/** Unit ids and names a food's own units may not use (compared ignoring case). */
export function reservedUnitNames(kind: 'product' | 'recipe'): string[] {
  const names = Object.keys(MASS_UNITS);
  return kind === 'recipe' ? [...names, SERVING_UNIT] : names;
}

export function isReservedUnitName(kind: 'product' | 'recipe', name: string): boolean {
  return reservedUnitNames(kind).includes(nameKey(name));
}

/** Id for a new unit of a food: `u1`, `u2`, … never reusing an id the food has. */
export function newUnitId(units: readonly Unit[]): string {
  let n = units.length + 1;
  while (units.some((u) => u.id === `u${n}`)) n++;
  return `u${n}`;
}

/**
 * Converts values given per `grams` of a product (a label's "per bar (45 g)" or
 * "per 100 ml" column, with the unit's grams) to values per 100 g.
 */
export function per100gFrom(values: NutrientValues, grams: number): NutrientValues {
  const result: NutrientValues = {};
  for (const [nutrient, value] of Object.entries(values) as [keyof NutrientValues, number][]) {
    result[nutrient] = (value * 100) / grams;
  }
  return result;
}
