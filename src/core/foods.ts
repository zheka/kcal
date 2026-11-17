import type { FoodEntry, FoodTable } from './nutrition';
import { nameKey } from './text';
import type { AppData, Ingredient, Recipe } from './types';

/** How many meals and recipes use a food directly (shown before editing a used food). */
export function usages(data: AppData, foodId: string): { meals: number; recipes: number } {
  const uses = (ingredients: Ingredient[]) => ingredients.some((i) => i.food === foodId);
  return {
    meals: data.meals.filter((m) => uses(m.ingredients)).length,
    recipes: data.recipes.filter((r) => uses(r.ingredients)).length,
  };
}

/** How many ingredients, in meals and recipes, measure a food in one of its units. */
export function unitUsages(data: AppData, foodId: string, unitId: string): number {
  const all = [...data.meals, ...data.recipes].flatMap((x) => x.ingredients);
  return all.filter((i) => i.food === foodId && i.unit === unitId).length;
}

/** Id for a new product, recipe or meal. */
export function newId(): string {
  return crypto.randomUUID();
}

/**
 * The ingredient to add when a food is picked: the amount and unit of its most recent use
 * (in meals by time, then in recipes), otherwise a sensible default for the food.
 */
export function pickIngredient(data: AppData, food: FoodEntry): Ingredient {
  const meals = [...data.meals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt));
  const recipes = [...data.recipes].reverse();
  for (const { ingredients } of [...meals, ...recipes]) {
    const last = ingredients.find((i) => i.food === food.id);
    if (last && food.units.some((u) => u.id === last.unit)) return { ...last };
  }
  return { food: food.id, ...defaultAmount(food) };
}

/** One serving, else one of the food's own units, else 100 g. */
function defaultAmount(food: FoodEntry): { unit: string; amount: number } {
  const own = food.units.find((u) => u.id !== 'g' && u.id !== 'kg');
  return own ? { unit: own.id, amount: 1 } : { unit: 'g', amount: 100 };
}

/** Foods for chips: the most recently eaten first, then the rest by name. Archived ones are left out. */
export function foodsByRecency(data: AppData, table: FoodTable): FoodEntry[] {
  const order: string[] = [];
  const meals = [...data.meals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt));
  for (const meal of meals) {
    for (const { food } of meal.ingredients) if (!order.includes(food)) order.push(food);
  }
  const recent = order.flatMap((id) => table.get(id) ?? []);
  const rest = [...table.values()]
    .filter((f) => !order.includes(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...recent, ...rest].filter((f) => !f.archived);
}

/**
 * Foods whose name matches typed text, ignoring case: names starting with it first, then
 * names containing it; the given order is kept within each group.
 */
export function matchFoods(foods: readonly FoodEntry[], text: string): FoodEntry[] {
  const typed = nameKey(text);
  if (!typed) return [...foods];
  const starts = foods.filter((f) => nameKey(f.name).startsWith(typed));
  const contains = foods.filter(
    (f) => !nameKey(f.name).startsWith(typed) && nameKey(f.name).includes(typed),
  );
  return [...starts, ...contains];
}

/**
 * Ids of the recipes that can't be ingredients of `recipeId` because they contain it,
 * directly or through other recipes; the recipe itself included.
 */
export function recipesContaining(recipes: readonly Recipe[], recipeId: string): Set<string> {
  const containing = new Set([recipeId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const recipe of recipes) {
      if (containing.has(recipe.id)) continue;
      if (recipe.ingredients.some((i) => containing.has(i.food))) {
        containing.add(recipe.id);
        grew = true;
      }
    }
  }
  return containing;
}
