import { byTime } from './nutrition';
import type { AppData } from './types';

/**
 * The data in canonical order, so the same data always gives the same file: goals by `setAt`,
 * meals by time (then id), products and recipes by id. Units and ingredients keep their order,
 * which the user chose. Strings compare by code unit, never by locale.
 */
export function canonical(data: AppData): AppData {
  const byId = <T extends { id: string }>(a: T, b: T) => compare(a.id, b.id);
  return {
    goals: sorted(data.goals, (a, b) => compare(a.setAt, b.setAt)),
    meals: sorted(data.meals, byTime),
    products: sorted(data.products, byId),
    recipes: sorted(data.recipes, byId),
  };
}

/**
 * The list in order. A list already in order is returned as it is, so unchanged lists keep
 * their identity and what is derived from them isn't recomputed.
 */
function sorted<T>(list: T[], order: (a: T, b: T) => number): T[] {
  const inOrder = list.every((x, i) => i === 0 || order(list[i - 1]!, x) <= 0);
  return inOrder ? list : [...list].sort(order);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * JSON with the fields of every object in alphabetical order, 2-space indentation and a final
 * newline: the one way the stored data is written down. -0 is written as 0.
 */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'number') return value === 0 ? 0 : value;
  if (typeof value !== 'object' || value === null) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(compare)) {
    sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}
