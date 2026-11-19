import { GRAMS, MILLILITRES } from '../config';
import { WATER_ID } from './builtins';
import { byTime, type FoodEntry, type FoodTable } from './nutrition';
import { nameKey } from './text';
import type { AppData, Ingredient, Meal, Recipe } from './types';

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

/** Id for a new product, recipe, meal or unit. */
export function newId(): string {
  return crypto.randomUUID();
}

function newestFirst(meals: readonly Meal[]): Meal[] {
  return [...meals].sort((a, b) => byTime(b, a));
}

/**
 * The ingredient to add when a food is picked: the amount and unit of its most recent use (in
 * meals by time, then in recipes), otherwise a default: 250 ml of water, 1 of a recipe's first
 * unit or of a product's own first unit, else 100 g.
 */
export function pickIngredient(data: AppData, food: FoodEntry): Ingredient {
  for (const { ingredients } of [...newestFirst(data.meals), ...[...data.recipes].reverse()]) {
    const last = ingredients.find((i) => i.food === food.id);
    if (last && food.units.some((u) => u.id === last.unit)) return { ...last };
  }
  if (food.id === WATER_ID) return { amount: 250, food: food.id, unit: MILLILITRES };
  const own = food.units.find((u) => u.id !== GRAMS);
  return own
    ? { amount: 1, food: food.id, unit: own.id }
    : { amount: 100, food: food.id, unit: GRAMS };
}

/** Foods for chips: the most recently consumed first, then the rest by name. */
export function foodsByRecency(data: AppData, table: FoodTable): FoodEntry[] {
  const order: string[] = [];
  for (const meal of newestFirst(data.meals)) {
    for (const { food } of meal.ingredients) if (!order.includes(food)) order.push(food);
  }
  const recent = order.flatMap((id) => table.get(id) ?? []);
  const rest = [...table.values()]
    .filter((f) => !order.includes(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...recent, ...rest];
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
