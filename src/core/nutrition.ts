import { BASES, NUTRIENTS, type Base, type Nutrient } from '../config';
import { THOUSANDTHS, thousandths } from './decimal';
import { localDateOf } from './time';
import {
  unitSize,
  valuesPer,
  type Ingredient,
  type Meal,
  type NutrientValues,
  type Product,
  type Recipe,
} from './types';

/**
 * The in-memory food table: derived from the stored products and recipes, never stored,
 * rebuilt whenever a food changes. Amounts are turned into nutrients exactly the same way
 * whatever the unit:
 *
 * - products: amount × the unit's g or ml is computed in integer millionths, so 100 g and
 *   4 × a 25 g unit give exactly the same result; g uses the values per g, ml those per ml;
 * - recipes: k of a unit is whole × k / makes, divided last, so `makes` of a unit is exactly
 *   the whole recipe.
 */

export type Nutrients = Readonly<Record<Nutrient, number>>;

function nutrients(of: (n: Nutrient) => number): Nutrients {
  return Object.fromEntries(NUTRIENTS.map((n) => [n, of(n)])) as Record<Nutrient, number>;
}

export const ZERO: Nutrients = nutrients(() => 0);

/** Stored values (a nutrient not given counts as 0, for now) as complete nutrients. */
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

/** A unit a food can be measured in. */
export interface UnitOption {
  /** What an ingredient stores: `g`, `ml`, or the id of the food's unit. */
  id: string;
  name: string;
}

export interface FoodEntry {
  id: string;
  kind: 'product' | 'recipe';
  name: string;
  /** The bases a product can be measured in (`g`, `ml`); none for a recipe. */
  bases: readonly Base[];
  /** Every unit the food can be measured in, in selector order: bases first. */
  units: readonly UnitOption[];
  /** The nutrients in `amount` of a unit, or undefined when the food has no such unit. */
  portion(unitId: string, amount: number): Nutrients | undefined;
}

/** All foods by id. */
export type FoodTable = ReadonlyMap<string, FoodEntry>;

/** Thrown when the foods can't be resolved; the integrity check reports these as problems. */
export class FoodTableError extends Error {}

function productFood(product: Product): FoodEntry {
  const bases = BASES.filter((b) => valuesPer(product, b) !== undefined);
  const per = new Map(bases.map((b) => [b, fromValues(valuesPer(product, b)!)]));
  // Each unit: its base and its size in thousandths of a g or ml.
  const sizes = new Map<string, { base: Base; milli: number }>(
    bases.map((b) => [b, { base: b, milli: THOUSANDTHS }]),
  );
  for (const u of product.units) {
    const { base, size } = unitSize(u);
    sizes.set(u.id, { base, milli: thousandths(size) });
  }
  return {
    id: product.id,
    kind: 'product',
    name: product.name,
    bases,
    units: [
      ...bases.map((b) => ({ id: b, name: b })),
      ...product.units.map(({ id, name }) => ({ id, name })),
    ],
    portion(unitId, amount) {
      const unit = sizes.get(unitId);
      const values = unit && per.get(unit.base);
      if (!unit || !values) return undefined;
      // Exact: an integer number of millionths of a g or ml.
      const micro = thousandths(amount) * unit.milli;
      return nutrients((n) => (values[n] * micro) / THOUSANDTHS ** 2);
    },
  };
}

function recipeFood(recipe: Recipe, resolve: (id: string) => FoodEntry): FoodEntry {
  let whole = ZERO;
  for (const ingredient of recipe.ingredients) {
    whole = addNutrients(
      whole,
      portionOf(resolve(ingredient.food), ingredient, `recipe "${recipe.name}"`),
    );
  }
  const makes = new Map(recipe.units.map((u) => [u.id, u.makes]));
  return {
    id: recipe.id,
    kind: 'recipe',
    name: recipe.name,
    bases: [],
    units: recipe.units.map(({ id, name }) => ({ id, name })),
    portion(unitId, amount) {
      const count = makes.get(unitId);
      if (count === undefined) return undefined;
      // Divided last: `makes` of a unit is exactly the whole recipe.
      return nutrients((n) => (whole[n] * amount) / count);
    },
  };
}

/**
 * Derives every food: products, and recipes resolved through their ingredients, recipes
 * inside recipes included. Throws `FoodTableError` on a reference to an unknown food or unit,
 * or recipes that contain each other.
 */
export function buildFoodTable(
  products: readonly Product[],
  recipes: readonly Recipe[],
): FoodTable {
  const table = new Map<string, FoodEntry>();
  for (const p of products) table.set(p.id, productFood(p));

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

function portionOf(food: FoodEntry, ingredient: Ingredient, where: string): Nutrients {
  const portion = food.portion(ingredient.unit, ingredient.amount);
  if (!portion) throw new FoodTableError(`${where}: "${food.name}" has no unit ${ingredient.unit}`);
  return portion;
}

export function foodOf(table: FoodTable, id: string): FoodEntry {
  const food = table.get(id);
  if (!food) throw new FoodTableError(`unknown food ${id}`);
  return food;
}

/** The nutrients of one ingredient. */
export function ingredientPortion(table: FoodTable, ingredient: Ingredient): Nutrients {
  return portionOf(foodOf(table, ingredient.food), ingredient, 'ingredient');
}

/** Nutrients of a list of ingredients: a meal, or a recipe or meal being composed. */
export function ingredientsNutrients(
  table: FoodTable,
  ingredients: readonly Ingredient[],
): Nutrients {
  return sumNutrients(ingredients.map((i) => ingredientPortion(table, i)));
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
