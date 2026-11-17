import type { AppData, Ingredient, Meal, NutrientValues, Product, Recipe, Unit } from './types';

/** Test builders: readable ids derived from names (`egg` → `p:egg`). */

export function product(name: string, per100g: NutrientValues, units: Unit[] = []): Product {
  return { id: `p:${name}`, name, per100g, units, archived: false };
}

export function recipe(
  name: string,
  ingredients: Ingredient[],
  options: Partial<Pick<Recipe, 'cookedGrams' | 'servings' | 'units'>> = {},
): Recipe {
  return {
    id: `r:${name}`,
    name,
    ingredients,
    cookedGrams: options.cookedGrams ?? null,
    servings: options.servings ?? null,
    units: options.units ?? [],
    archived: false,
  };
}

export function ing(food: Product | Recipe, amount: number, unit = 'g'): Ingredient {
  return { food: food.id, unit, amount };
}

export function meal(eatenAt: string, ingredients: Ingredient[], id = `m:${eatenAt}`): Meal {
  return { id, eatenAt, ingredients };
}

export function appData(data: Partial<AppData> = {}): AppData {
  return { goals: [], products: [], recipes: [], meals: [], ...data };
}

/** A small library used across tests. */
export const egg = product('egg', { kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7 }, [
  { id: 'u1', name: 'piece', grams: 60 },
]);
export const oatFlakes = product('oat flakes', { kcal: 370, protein: 13, fat: 7, carbs: 59 });
export const milk = product('milk', { kcal: 64, protein: 3.3, fat: 3.5, carbs: 4.8 }, [
  { id: 'u1', name: 'ml', grams: 1.03 },
]);
/** Honey with no protein value on its label: protein is unknown. */
export const honey = product('honey', { kcal: 304, fat: 0, carbs: 82 }, [
  { id: 'u1', name: 'tsp', grams: 7 },
]);
export const water = product('water', { kcal: 0, protein: 0, fat: 0, carbs: 0 });
