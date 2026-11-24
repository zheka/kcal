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

/** A product weighed in grams. */
export function product(name: string, perG: NutrientValues, units: ProductUnit[] = []): Product {
  return { id: `p:${name}`, name, perG, units };
}

/** A product measured in ml (a drink). */
export function drink(name: string, perMl: NutrientValues, units: ProductUnit[] = []): Product {
  return { id: `p:${name}`, name, perMl, units };
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
  return {
    goals: [],
    meals: [],
    products: [],
    recipes: [],
    settings: { ai: {}, quickButtons: [] },
    ...data,
  };
}

/** Water, as a fresh start makes it: per g and per ml. */
export const water: Product = {
  id: 'p:water',
  name: 'water',
  perG: { water: 1 },
  perMl: { water: 1 },
  units: [],
};

/** A small library used across tests: foods per g, drinks per ml. */
export const egg = product('egg', { carbs: 0.007, fat: 0.095, kcal: 1.43, protein: 0.126 }, [
  { g: 60, id: 'u:piece', name: 'piece' },
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
  [{ g: 250, id: 'u:cup', name: 'cup' }],
);
export const honey = product('honey', { carbs: 0.82, kcal: 3.04 }, [
  { g: 7, id: 'u:tsp', name: 'tsp' },
]);
export const coffee = drink('coffee', { kcal: 0.02, protein: 0.001, water: 0.99 }, [
  { id: 'u:mug', ml: 300, name: 'mug' },
]);
