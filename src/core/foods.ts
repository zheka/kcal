import type { AppData } from './types';

/** How many meals and recipes use a food directly (shown before editing a used food). */
export function usages(data: AppData, foodId: string): { meals: number; recipes: number } {
  const uses = (ingredients: { food: string }[]) => ingredients.some((i) => i.food === foodId);
  return {
    meals: data.meals.filter((m) => uses(m.ingredients)).length,
    recipes: data.recipes.filter((r) => uses(r.ingredients)).length,
  };
}

/** Id for a new product, recipe or meal. */
export function newId(): string {
  return crypto.randomUUID();
}
