import { NUTRIENTS, type Nutrient } from '../config';
import type { Ingredient, Meal, Product, Recipe } from './types';
import { toGrams, unitOptions, type UnitOption } from './units';

/**
 * An amount of one nutrient that may include unknowns: `value` is the known part, `missing`
 * counts the contributing foods that lacked the nutrient. With `missing > 0` the true amount
 * is at least `value`.
 */
export interface NutrientAmount {
  readonly value: number;
  readonly missing: number;
}

export type Nutrition = Readonly<Record<Nutrient, NutrientAmount>>;

function nutrition(of: (n: Nutrient) => NutrientAmount): Nutrition {
  return Object.fromEntries(NUTRIENTS.map((n) => [n, of(n)])) as Record<Nutrient, NutrientAmount>;
}

export const ZERO: Nutrition = nutrition(() => ({ value: 0, missing: 0 }));

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return nutrition((n) => ({
    value: a[n].value + b[n].value,
    missing: a[n].missing + b[n].missing,
  }));
}

export function sumNutrition(items: Iterable<Nutrition>): Nutrition {
  let total = ZERO;
  for (const item of items) total = addNutrition(total, item);
  return total;
}

/** A food with everything derived from the library: nutrients per gram and its units. */
export interface FoodEntry {
  id: string;
  kind: 'product' | 'recipe';
  name: string;
  archived: boolean;
  /** Nutrients in one gram; `missing` counts the products (all the way down) without a value. */
  perGram: Nutrition;
  /** Every unit the food can be measured in, built-in ones included. */
  units: readonly UnitOption[];
  /** Recipes: grams the recipe makes (cooked weight, or the sum of its ingredients). */
  totalGrams: number | null;
}

/** All foods by id. Rebuilt from scratch whenever a product or recipe changes. */
export type FoodTable = ReadonlyMap<string, FoodEntry>;

/** Thrown when the foods can't be resolved; the integrity check reports these as problems. */
export class FoodTableError extends Error {}

/**
 * Derives every food's nutrients per gram and units. Recipes are resolved through their
 * ingredients, recipes inside recipes included. Throws `FoodTableError` on a reference to an
 * unknown food or unit, a cycle, or a recipe that weighs nothing.
 */
export function buildFoodTable(
  products: readonly Product[],
  recipes: readonly Recipe[],
): FoodTable {
  const table = new Map<string, FoodEntry>();
  for (const product of products) table.set(product.id, productEntry(product));

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
    const entry = recipeEntry(recipe, resolve);
    resolving.pop();
    table.set(id, entry);
    return entry;
  };
  for (const recipe of recipes) resolve(recipe.id);
  return table;
}

function productEntry(product: Product): FoodEntry {
  return {
    id: product.id,
    kind: 'product',
    name: product.name,
    archived: product.archived,
    perGram: nutrition((n) => {
      const per100g = product.per100g[n];
      return per100g === undefined
        ? { value: 0, missing: 1 }
        : { value: per100g / 100, missing: 0 };
    }),
    units: unitOptions(product.units, null),
    totalGrams: null,
  };
}

function recipeEntry(recipe: Recipe, resolve: (id: string) => FoodEntry): FoodEntry {
  let total = ZERO;
  let ingredientGrams = 0;
  for (const ingredient of recipe.ingredients) {
    const food = resolve(ingredient.food);
    const grams = gramsIn(food, ingredient, `recipe "${recipe.name}"`);
    ingredientGrams += grams;
    total = addNutrition(total, portion(food, grams));
  }
  const totalGrams = recipe.cookedGrams ?? ingredientGrams;
  if (!(totalGrams > 0)) {
    throw new FoodTableError(`recipe "${recipe.name}" weighs nothing: its total weight is 0 g`);
  }
  const servingGrams = recipe.servings ? totalGrams / recipe.servings : null;
  return {
    id: recipe.id,
    kind: 'recipe',
    name: recipe.name,
    archived: recipe.archived,
    perGram: nutrition((n) => ({ value: total[n].value / totalGrams, missing: total[n].missing })),
    units: unitOptions(recipe.units, servingGrams),
    totalGrams,
  };
}

function gramsIn(food: FoodEntry, ingredient: Ingredient, where: string): number {
  const grams = toGrams(food.units, ingredient.unit, ingredient.amount);
  if (grams === undefined) {
    throw new FoodTableError(`${where}: "${food.name}" has no unit ${ingredient.unit}`);
  }
  return grams;
}

/** Nutrients in `grams` of a food. Nothing eaten counts nothing, unknowns included. */
function portion(food: FoodEntry, grams: number): Nutrition {
  if (grams === 0) return ZERO;
  return nutrition((n) => ({
    value: food.perGram[n].value * grams,
    missing: food.perGram[n].missing,
  }));
}

export function foodOf(table: FoodTable, id: string): FoodEntry {
  const food = table.get(id);
  if (!food) throw new FoodTableError(`unknown food ${id}`);
  return food;
}

/** Grams of an ingredient. */
export function ingredientGrams(table: FoodTable, ingredient: Ingredient): number {
  return gramsIn(foodOf(table, ingredient.food), ingredient, 'ingredient');
}

export function ingredientNutrition(table: FoodTable, ingredient: Ingredient): Nutrition {
  const food = foodOf(table, ingredient.food);
  return portion(food, gramsIn(food, ingredient, 'ingredient'));
}

/** Nutrients of a list of ingredients: a meal, or a recipe or meal being composed. */
export function ingredientsNutrition(
  table: FoodTable,
  ingredients: readonly Ingredient[],
): Nutrition {
  return sumNutrition(ingredients.map((i) => ingredientNutrition(table, i)));
}

/** The date a meal counts towards: the date part of `eatenAt`. */
export function mealDate(meal: Meal): string {
  return meal.eatenAt.slice(0, 10);
}

/** The meals of one local date, ordered by time. */
export function mealsOn(meals: readonly Meal[], date: string): Meal[] {
  return meals
    .filter((m) => mealDate(m) === date)
    .sort((a, b) => a.eatenAt.localeCompare(b.eatenAt));
}

export function dayNutrition(table: FoodTable, meals: readonly Meal[], date: string): Nutrition {
  return sumNutrition(mealsOn(meals, date).map((m) => ingredientsNutrition(table, m.ingredients)));
}
