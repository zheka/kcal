import { computed, signal, type ReadonlySignal } from '@preact/signals';
import { buildFoodTable, type FoodTable } from '../core/nutrition';
import { usages } from '../core/foods';
import { saveGoals } from '../core/goals';
import type { AppData, Meal, NutrientValues, Product, Recipe } from '../core/types';
import { validateAppData } from '../core/validate';

/**
 * The app state and the only functions that change it. Every change is checked like an
 * import and saved before it takes effect, so invalid data is never stored or shown.
 */
export interface Store {
  readonly data: ReadonlySignal<AppData>;
  /** Every food with its derived nutrients and units; rebuilt only when foods change. */
  readonly foods: ReadonlySignal<FoodTable>;
  /** Adds a product or replaces the one with its id. */
  saveProduct(product: Product): void;
  /** Adds a recipe or replaces the one with its id. */
  saveRecipe(recipe: Recipe): void;
  /** Deletes a food that nothing uses. */
  deleteFood(id: string): void;
  /** Adds a meal or replaces the one with its id. */
  saveMeal(meal: Meal): void;
  deleteMeal(id: string): void;
  /** New daily targets, effective from `today`; the days before keep their goals. */
  saveGoals(targets: NutrientValues, today: string): void;
  /** Replaces all data (import). */
  replaceAll(data: AppData): void;
}

export class InvalidChangeError extends Error {}

export function createStore(initial: AppData, persist: (data: AppData) => void): Store {
  const data = signal(initial);
  // Separate computeds keep the same list when only meals or goals change, so the food
  // table is not rebuilt for them.
  const products = computed(() => data.value.products);
  const recipes = computed(() => data.value.recipes);
  const foods = computed(() => buildFoodTable(products.value, recipes.value));

  function commit(next: AppData): void {
    const problems = validateAppData(next);
    if (problems.length > 0) throw new InvalidChangeError(problems.join('\n'));
    persist(next); // first: if saving fails, nothing changes
    data.value = next;
  }

  function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
    return list.some((x) => x.id === item.id)
      ? list.map((x) => (x.id === item.id ? item : x))
      : [...list, item];
  }

  return {
    data,
    foods,
    saveProduct(product) {
      commit({ ...data.value, products: upsert(data.value.products, product) });
    },
    saveRecipe(recipe) {
      commit({ ...data.value, recipes: upsert(data.value.recipes, recipe) });
    },
    deleteFood(id) {
      const used = usages(data.value, id);
      if (used.meals + used.recipes > 0) throw new InvalidChangeError('the food is in use');
      commit({
        ...data.value,
        products: data.value.products.filter((p) => p.id !== id),
        recipes: data.value.recipes.filter((r) => r.id !== id),
      });
    },
    saveMeal(meal) {
      commit({ ...data.value, meals: upsert(data.value.meals, meal) });
    },
    deleteMeal(id) {
      commit({ ...data.value, meals: data.value.meals.filter((m) => m.id !== id) });
    },
    saveGoals(targets, today) {
      commit({ ...data.value, goals: saveGoals(data.value.goals, targets, today) });
    },
    replaceAll(next) {
      commit(next);
    },
  };
}
