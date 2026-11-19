import { GRAMS, NUTRIENTS, type Nutrient } from '../config';
import { BUILTIN_FOODS } from './builtins';
import { THOUSANDTHS, thousandths } from './decimal';
import { localDateOf } from './time';
import type { Ingredient, Meal, NutrientValues, Product, Recipe } from './types';

/**
 * The in-memory food table: derived from the stored products and recipes plus the built-in
 * foods, never stored, rebuilt whenever a food changes. Amounts are turned into nutrients
 * exactly the same way whatever the unit:
 *
 * - products and built-in foods: amount × unit grams is computed in integer millionths of a
 *   gram, so 100 g and 4 × a 25 g unit give exactly the same result;
 * - recipes: k of a unit is whole × k / makes, divided last, so `makes` of a unit is exactly
 *   the whole recipe.
 */

export type Nutrients = Readonly<Record<Nutrient, number>>;

function nutrients(of: (n: Nutrient) => number): Nutrients {
  return Object.fromEntries(NUTRIENTS.map((n) => [n, of(n)])) as Record<Nutrient, number>;
}

export const ZERO: Nutrients = nutrients(() => 0);

/** Stored values (an omitted nutrient counts as 0) as complete nutrients. */
export function fromValues(values: NutrientValues): Nutrients {
  return nutrients((n) => values[n] ?? 0);
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return nutrients((n) => a[n] + b[n]);
}

export function sumNutrients(items: Iterable<Nutrients>): Nutrients {
  let total = ZERO;
  for (const item of items) total = addNutrients(total, item);
  return total;
}

/** How much of a food an amount in a unit is. */
export interface Portion {
  nutrients: Nutrients;
  /** Weight in grams (for a recipe: of its ingredients). */
  grams: number;
}

/** A unit a food can be measured in. */
export interface UnitOption {
  /** What an ingredient stores: `g`, `ml`, or the id of the food's unit. */
  id: string;
  name: string;
}

export interface FoodEntry {
  id: string;
  kind: 'product' | 'recipe' | 'builtin';
  name: string;
  /** Every unit the food can be measured in, in selector order. */
  units: readonly UnitOption[];
  /** The portion of `amount` of a unit, or undefined when the food has no such unit. */
  portion(unitId: string, amount: number): Portion | undefined;
  /** Nutrients in 1 g (products and built-in foods) or in the whole recipe (recipes). */
  reference: Nutrients;
}

/** All foods by id. */
export type FoodTable = ReadonlyMap<string, FoodEntry>;

/** Thrown when the foods can't be resolved; the integrity check reports these as problems. */
export class FoodTableError extends Error {}

/** A food measured in grams: products and built-in foods. */
function gramFood(
  id: string,
  kind: 'product' | 'builtin',
  name: string,
  perGram: NutrientValues,
  units: readonly { id: string; name: string; grams: number }[],
): FoodEntry {
  const reference = fromValues(perGram);
  const milliGrams = new Map<string, number>([[GRAMS, THOUSANDTHS]]);
  for (const u of units) milliGrams.set(u.id, thousandths(u.grams));
  return {
    id,
    kind,
    name,
    units: [
      { id: GRAMS, name: GRAMS },
      ...units.map(({ id: uid, name: uname }) => ({ id: uid, name: uname })),
    ],
    reference,
    portion(unitId, amount) {
      const unit = milliGrams.get(unitId);
      if (unit === undefined) return undefined;
      // Exact: an integer number of millionths of a gram.
      const microGrams = thousandths(amount) * unit;
      return {
        nutrients: nutrients((n) => (reference[n] * microGrams) / THOUSANDTHS ** 2),
        grams: microGrams / THOUSANDTHS ** 2,
      };
    },
  };
}

function recipeFood(recipe: Recipe, resolve: (id: string) => FoodEntry): FoodEntry {
  let whole = ZERO;
  let grams = 0;
  for (const ingredient of recipe.ingredients) {
    const portion = portionOf(resolve(ingredient.food), ingredient, `recipe "${recipe.name}"`);
    whole = addNutrients(whole, portion.nutrients);
    grams += portion.grams;
  }
  const makes = new Map(recipe.units.map((u) => [u.id, u.makes]));
  return {
    id: recipe.id,
    kind: 'recipe',
    name: recipe.name,
    units: recipe.units.map(({ id, name }) => ({ id, name })),
    reference: whole,
    portion(unitId, amount) {
      const count = makes.get(unitId);
      if (count === undefined) return undefined;
      // Divided last: `makes` of a unit is exactly the whole recipe.
      return {
        nutrients: nutrients((n) => (whole[n] * amount) / count),
        grams: (grams * amount) / count,
      };
    },
  };
}

/**
 * Derives every food: built-in foods, products, and recipes resolved through their
 * ingredients, recipes inside recipes included. Throws `FoodTableError` on a reference to an
 * unknown food or unit, or recipes that contain each other.
 */
export function buildFoodTable(
  products: readonly Product[],
  recipes: readonly Recipe[],
): FoodTable {
  const table = new Map<string, FoodEntry>();
  for (const b of BUILTIN_FOODS)
    table.set(b.id, gramFood(b.id, 'builtin', b.name, b.perGram, b.units));
  for (const p of products) table.set(p.id, gramFood(p.id, 'product', p.name, p.perGram, p.units));

  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const resolving: string[] = [];
  const resolve = (id: string): FoodEntry => {
    const done = table.get(id);
    if (done) return done;
    const recipe = recipesById.get(id);
    if (!recipe) throw new FoodTableError(`unknown food ${id}`);
    const at = resolving.indexOf(id);
    if (at >= 0) {
      const names = [...resolving.slice(at), id].map((r) => `"${recipesById.get(r)?.name}"`);
      throw new FoodTableError(`recipes contain each other: ${names.join(' → ')}`);
    }
    resolving.push(id);
    const entry = recipeFood(recipe, resolve);
    resolving.pop();
    table.set(id, entry);
    return entry;
  };
  for (const recipe of recipes) resolve(recipe.id);
  return table;
}

function portionOf(food: FoodEntry, ingredient: Ingredient, where: string): Portion {
  const portion = food.portion(ingredient.unit, ingredient.amount);
  if (!portion) throw new FoodTableError(`${where}: "${food.name}" has no unit ${ingredient.unit}`);
  return portion;
}

export function foodOf(table: FoodTable, id: string): FoodEntry {
  const food = table.get(id);
  if (!food) throw new FoodTableError(`unknown food ${id}`);
  return food;
}

export function ingredientPortion(table: FoodTable, ingredient: Ingredient): Portion {
  return portionOf(foodOf(table, ingredient.food), ingredient, 'ingredient');
}

/** Nutrients of a list of ingredients: a meal, or a recipe or meal being composed. */
export function ingredientsNutrients(
  table: FoodTable,
  ingredients: readonly Ingredient[],
): Nutrients {
  return sumNutrients(ingredients.map((i) => ingredientPortion(table, i).nutrients));
}

/** The day a meal counts towards: its local date. */
export function mealDate(meal: Meal): string {
  return localDateOf(meal.consumedAt);
}

/** Meals in time order (then by id, if ever equal). Timestamps in UTC compare as text. */
export function byTime(a: Meal, b: Meal): number {
  return compare(a.consumedAt, b.consumedAt) || compare(a.id, b.id);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The meals of one local date, in time order. */
export function mealsOn(meals: readonly Meal[], date: string): Meal[] {
  return meals.filter((m) => mealDate(m) === date).sort(byTime);
}

export function dayNutrients(table: FoodTable, meals: readonly Meal[], date: string): Nutrients {
  return sumNutrients(mealsOn(meals, date).map((m) => ingredientsNutrients(table, m.ingredients)));
}
