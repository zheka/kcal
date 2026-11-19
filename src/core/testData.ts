import type {
  AppData,
  Ingredient,
  Meal,
  NutrientValues,
  Product,
  ProductUnit,
  Recipe,
  RecipeUnit,
} from './types';

/**
 * Test builders: readable ids derived from names (`egg` → `p:egg`). Ids must be unique across
 * the whole file, units included.
 */

export function product(name: string, perGram: NutrientValues, units: ProductUnit[] = []): Product {
  return { id: `p:${name}`, name, perGram, units };
}

export function recipe(name: string, ingredients: Ingredient[], units: RecipeUnit[]): Recipe {
  return { id: `r:${name}`, ingredients, name, units };
}

/** A recipe unit: the whole recipe makes `makes` of it. */
export function makes(makesCount: number, name = 'serving', id = `u:${name}`): RecipeUnit {
  return { id, makes: makesCount, name };
}

export function ing(food: { id: string }, amount: number, unit = 'g'): Ingredient {
  return { amount, food: food.id, unit };
}

/** A meal at a UTC timestamp (tests run in Europe/Berlin: UTC+1 in winter). */
export function meal(consumedAt: string, ingredients: Ingredient[], id = `m:${consumedAt}`): Meal {
  return { consumedAt, id, ingredients };
}

export function appData(data: Partial<AppData> = {}): AppData {
  return { goals: [], meals: [], products: [], recipes: [], ...data };
}

export const water = { id: 'water' };

/** A small library used across tests, per gram. */
export const egg = product('egg', { carbs: 0.007, fat: 0.095, kcal: 1.43, protein: 0.126 }, [
  { grams: 60, id: 'u:piece', name: 'piece' },
]);
export const oatFlakes = product('oat flakes', {
  carbs: 0.59,
  fat: 0.07,
  kcal: 3.7,
  protein: 0.13,
});
export const milk = product(
  'milk',
  { carbs: 0.048, fat: 0.035, kcal: 0.64, protein: 0.033, water: 0.88 },
  [
    { grams: 1.03, id: 'u:ml', name: 'ml' },
    { grams: 250, id: 'u:cup', name: 'cup' },
  ],
);
export const honey = product('honey', { carbs: 0.82, kcal: 3.04 }, [
  { grams: 7, id: 'u:tsp', name: 'tsp' },
]);
export const coffee = product('coffee', { kcal: 0.02, protein: 0.001, water: 0.99 }, [
  { grams: 1, id: 'u:coffee-ml', name: 'ml' },
  { grams: 300, id: 'u:mug', name: 'mug' },
]);
