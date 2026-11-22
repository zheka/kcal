import type { Item, Per100 } from './types';

/** What an item amounts to with its current answers: grams (or ml) and nutrients. */
export interface Amounts {
  grams: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  water_ml: number;
}

/**
 * An item's effective values per 100 g and grams per unit: its own, overridden by the chosen
 * variant of each parameter that changes them (in parameter order).
 */
export function effective(item: Item): { per_100g: Per100; grams_per_unit: number } {
  let per_100g = item.per_100g;
  let grams_per_unit = item.grams_per_unit;
  for (const p of item.parameters) {
    const chosen = p.variants.find((v) => v.label === p.default);
    if (chosen?.per_100g) per_100g = chosen.per_100g;
    if (chosen?.grams_per_unit) grams_per_unit = chosen.grams_per_unit;
  }
  return { per_100g, grams_per_unit };
}

/** count × grams per unit × values per 100 g: local arithmetic, no model call. */
export function amounts(item: Item): Amounts {
  const { per_100g, grams_per_unit } = effective(item);
  const grams = item.count * grams_per_unit;
  const f = grams / 100;
  return {
    grams,
    kcal: per_100g.kcal * f,
    protein: per_100g.protein * f,
    fat: per_100g.fat * f,
    carbs: per_100g.carbs * f,
    water_ml: (per_100g.water_ml ?? 0) * f,
  };
}

export function total(items: readonly Item[]): Amounts {
  const sum: Amounts = { grams: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, water_ml: 0 };
  for (const item of items) {
    const a = amounts(item);
    for (const k of Object.keys(sum) as (keyof Amounts)[]) sum[k] += a[k];
  }
  return sum;
}

/** The item with one parameter answered: a local change. */
export function choose(item: Item, parameter: string, label: string): Item {
  return {
    ...item,
    parameters: item.parameters.map((p) => (p.name === parameter ? { ...p, default: label } : p)),
  };
}

/** The item with a new amount in its unit: a local change. */
export function setCount(item: Item, count: number): Item {
  return { ...item, count };
}
