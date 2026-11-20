import { applyChange, mergeChanges, type Change } from './change';
import type { AppData, Ingredient, Product, ProductUnit, Recipe, RecipeUnit } from './types';

/**
 * Foods a meal or recipe draft created or changed, saved only together with it (see
 * docs/design.md, Changes): new products, and units added to foods. `bases` holds the stored
 * version each changed existing food started from, so the change can be rebuilt on whatever is
 * stored when it is saved and never undoes an edit made elsewhere meanwhile.
 */
export interface Pending {
  products: Product[];
  recipes: Recipe[];
  bases: Record<string, Product | Recipe>;
}

export const noPending: Pending = { products: [], recipes: [], bases: {} };

export function hasPending(pending: Pending): boolean {
  return pending.products.length > 0 || pending.recipes.length > 0;
}

/**
 * The pending foods as a change on the stored data: a new food as it is; a changed existing
 * food as stored now plus the units the draft added; one deleted meanwhile drops out.
 */
export function pendingChange(pending: Pending, data: AppData): Change {
  const change: Change = {};
  const products = rebase(pending.products, data.products, pending.bases);
  if (products.length > 0) change.products = products;
  const recipes = rebase(pending.recipes, data.recipes, pending.bases);
  if (recipes.length > 0) change.recipes = recipes;
  return change;
}

function rebase<T extends Product | Recipe>(
  records: readonly T[],
  stored: readonly T[],
  bases: Pending['bases'],
): T[] {
  const result: T[] = [];
  for (const record of records) {
    const base = bases[record.id];
    if (!base) {
      result.push(record);
      continue;
    }
    const current = stored.find((s) => s.id === record.id);
    if (!current) continue;
    const added = record.units.filter((u) => !base.units.some((b) => b.id === u.id));
    result.push({ ...current, units: [...current.units, ...added] } as T);
  }
  return result;
}

/** The data as the draft sees it: stored, with its pending foods. */
export function withPending(data: AppData, pending: Pending): AppData {
  return hasPending(pending) ? applyChange(data, pendingChange(pending, data)) : data;
}

/** A new product, or a new version of a pending one. */
export function putProduct(pending: Pending, product: Product): Pending {
  return { ...pending, products: upsert(pending.products, product) };
}

/** Adds a unit to a food: a pending one, or a stored one (remembering what it started from). */
export function addUnit(
  pending: Pending,
  data: AppData,
  foodId: string,
  unit: ProductUnit | RecipeUnit,
): Pending {
  const view = withPending(data, pending);
  const product = view.products.find((p) => p.id === foodId);
  const recipe = view.recipes.find((r) => r.id === foodId);
  const stored =
    data.products.find((p) => p.id === foodId) ?? data.recipes.find((r) => r.id === foodId);
  const bases =
    stored && !pending.bases[foodId] ? { ...pending.bases, [foodId]: stored } : pending.bases;
  if (product) {
    const units = [...product.units, unit as ProductUnit];
    return { ...pending, bases, products: upsert(pending.products, { ...product, units }) };
  }
  if (recipe) {
    const units = [...recipe.units, unit as RecipeUnit];
    return { ...pending, bases, recipes: upsert(pending.recipes, { ...recipe, units }) };
  }
  return pending;
}

/** The pending foods that `ingredients` use, as a change to save with them. */
export function pendingFor(
  pending: Pending,
  data: AppData,
  ingredients: readonly Pick<Ingredient, 'food'>[],
): Change {
  const used = new Set(ingredients.map((i) => i.food));
  const change = pendingChange(pending, data);
  const kept: Change = {};
  const products = change.products?.filter((p) => used.has(p.id));
  if (products?.length) kept.products = products;
  const recipes = change.recipes?.filter((r) => used.has(r.id));
  if (recipes?.length) kept.recipes = recipes;
  return kept;
}

/** Ids of foods in a change that aren't stored yet, and of units added to stored foods. */
export function whatsNew(
  change: Change,
  data: AppData,
): { foods: Set<string>; units: Set<string> } {
  const foods = new Set<string>();
  const units = new Set<string>();
  const records = [...(change.products ?? []), ...(change.recipes ?? [])] as (Product | Recipe)[];
  for (const record of records) {
    const stored =
      data.products.find((p) => p.id === record.id) ?? data.recipes.find((r) => r.id === record.id);
    if (!stored) foods.add(record.id);
    else
      for (const u of record.units) if (!stored.units.some((s) => s.id === u.id)) units.add(u.id);
  }
  return { foods, units };
}

/** A change to save: the pending foods `ingredients` use, plus the record itself. */
export function saveWith(
  pending: Pending,
  data: AppData,
  ingredients: readonly Ingredient[],
  change: Change,
): Change {
  return mergeChanges(pendingFor(pending, data, ingredients), change);
}

function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? item : x))
    : [...list, item];
}
