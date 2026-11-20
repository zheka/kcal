import type { AppData, GoalSet, Meal, Product, Recipe, Settings } from './types';

/** A record to delete: its id, marked deleted. */
export interface Tombstone {
  deleted: true;
  id: string;
}

/**
 * An edit of the data, shaped like the data itself: every part optional, records whole, a
 * deletion a tombstone in the record's list. The whole data is just the largest change.
 * See docs/design.md, Changes.
 */
export interface Change {
  /** Added: goal sets are append-only. */
  goals?: GoalSet[];
  meals?: (Meal | Tombstone)[];
  products?: (Product | Tombstone)[];
  recipes?: (Recipe | Tombstone)[];
  /** Replaces the settings. */
  settings?: Settings;
}

export function isTombstone(record: object): record is Tombstone {
  return (record as Partial<Tombstone>).deleted === true;
}

/** A tombstone for a record. */
export function tombstone(id: string): Tombstone {
  return { deleted: true, id };
}

/**
 * The data with a change applied: a record replaces the one with its id (in place) or is
 * added; a tombstone removes the record with its id (nothing, if there is none); records the
 * change doesn't mention stay. Pure; the result is not checked (the store checks it).
 */
export function applyChange(data: AppData, change: Change): AppData {
  return {
    goals: change.goals ? [...data.goals, ...change.goals] : data.goals,
    meals: applyTo(data.meals, change.meals),
    products: applyTo(data.products, change.products),
    recipes: applyTo(data.recipes, change.recipes),
    settings: change.settings ?? data.settings,
  };
}

function applyTo<T extends { id: string }>(
  list: readonly T[],
  records: readonly (T | Tombstone)[] | undefined,
): T[] {
  if (!records || records.length === 0) return list as T[];
  const byId = new Map(records.map((r) => [r.id, r]));
  const result: T[] = [];
  for (const item of list) {
    const record = byId.get(item.id);
    if (record === undefined) result.push(item);
    else if (!isTombstone(record)) result.push(record);
    byId.delete(item.id);
  }
  for (const record of byId.values()) if (!isTombstone(record)) result.push(record);
  return result;
}

/** Two changes as one: `later` wins for a record both have. */
export function mergeChanges(earlier: Change, later: Change): Change {
  const merged: Change = {};
  const goals = [...(earlier.goals ?? []), ...(later.goals ?? [])];
  if (goals.length > 0) merged.goals = goals;
  const meals = mergeRecords(earlier.meals, later.meals);
  if (meals) merged.meals = meals;
  const products = mergeRecords(earlier.products, later.products);
  if (products) merged.products = products;
  const recipes = mergeRecords(earlier.recipes, later.recipes);
  if (recipes) merged.recipes = recipes;
  const settings = later.settings ?? earlier.settings;
  if (settings) merged.settings = settings;
  return merged;
}

function mergeRecords<T extends { id: string }>(
  earlier: readonly T[] | undefined,
  later: readonly T[] | undefined,
): T[] | undefined {
  if (!earlier?.length) return later?.length ? [...later] : undefined;
  if (!later?.length) return [...earlier];
  const byId = new Map(earlier.map((r) => [r.id, r]));
  for (const r of later) byId.set(r.id, r);
  return [...byId.values()];
}
