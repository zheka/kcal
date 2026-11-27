import { computed, signal, type ReadonlySignal } from '@preact/signals';
import { canonical } from '../core/canonical';
import { applyChange, tombstone, type Change } from '../core/change';
import { isUsed, usages } from '../core/foods';
import { saveGoals } from '../core/goals';
import { buildFoodTable, type FoodTable } from '../core/nutrition';
import type { AppData, Meal, NutrientValues, Product, Recipe } from '../core/types';
import { validateAppData } from '../core/validate';

/**
 * The app state: the stored data (primary, canonical, always valid) and the in-memory tables
 * derived from it. Every change goes through here (`apply`): the result is checked like an
 * import, put in canonical order and saved before it takes effect, so invalid data is never
 * stored or shown. The other methods are shorthands for common changes.
 *
 * The app may be open in more than one window, all saving the same document. `changes` returns
 * what another window saved since this one last read or wrote (null: nothing); every change is
 * applied on that latest data, so a save never erases another window's.
 */
export interface Store {
  readonly data: ReadonlySignal<AppData>;
  /** Every food (product, recipe) with its units and portions; rebuilt only when foods change. */
  readonly foods: ReadonlySignal<FoodTable>;
  /** Applies a change; throws `InvalidChangeError`, changing nothing, if the result is invalid. */
  apply(change: Change): void;
  /** Adds a product or replaces the one with its id. */
  saveProduct(product: Product): void;
  /** Adds a recipe or replaces the one with its id. */
  saveRecipe(recipe: Recipe): void;
  /** Deletes a food that nothing uses. */
  deleteFood(id: string): void;
  /** Adds a meal or replaces the one with its id. */
  saveMeal(meal: Meal): void;
  deleteMeal(id: string): void;
  /** New daily targets, saved now, effective from the start of today. */
  saveGoals(perDay: NutrientValues, now: Date): void;
  /**
   * Replaces all data (import), over whatever another window saved. Throws what `refresh`
   * throws, saving nothing: data another window saved that this one can't read (e.g. a newer
   * version of the app) is never saved over, not even by an import.
   */
  replaceAll(data: AppData): void;
  /**
   * Takes in what another window saved, without saving anything. Throws what `changes`
   * throws (e.g. when the other window's data can't be read).
   */
  refresh(): void;
}

export class InvalidChangeError extends Error {}

export function createStore(
  initial: AppData,
  persist: (data: AppData) => void,
  changes: () => AppData | null = () => null,
): Store {
  const data = signal(canonical(initial));
  // Separate computeds keep the same list when only meals or goals change, so the food
  // table is not rebuilt for them.
  const products = computed(() => data.value.products);
  const recipes = computed(() => data.value.recipes);
  const foods = computed(() => buildFoodTable(products.value, recipes.value));

  /** Shows what another window saved; throws, changing nothing, if it can't be read. */
  function refresh(): void {
    const saved = changes();
    if (saved !== null) data.value = canonical(saved);
  }

  function commit(change: AppData): void {
    const problems = validateAppData(change);
    if (problems.length > 0) throw new InvalidChangeError(problems.join('\n'));
    const next = canonical(change);
    persist(next); // first: if saving fails, nothing changes
    data.value = next;
  }

  function apply(change: Change): void {
    refresh(); // on the latest data: the change's records and tombstones go on top of it
    commit(applyChange(data.value, change));
  }

  return {
    data,
    foods,
    apply,
    saveProduct(product) {
      apply({ products: [product] });
    },
    saveRecipe(recipe) {
      apply({ recipes: [recipe] });
    },
    deleteFood(id) {
      refresh();
      // The friendly check; validation would refuse it too, in less friendly words.
      if (isUsed(usages(data.value, id))) throw new InvalidChangeError('the food is in use');
      apply({ products: [tombstone(id)], recipes: [tombstone(id)] });
    },
    saveMeal(meal) {
      apply({ meals: [meal] });
    },
    deleteMeal(id) {
      apply({ meals: [tombstone(id)] });
    },
    saveGoals(perDay, now) {
      refresh();
      const goals = data.value.goals;
      const added = saveGoals(goals, perDay, now).slice(goals.length);
      if (added.length > 0) apply({ goals: added });
    },
    replaceAll(next) {
      refresh();
      commit(next);
    },
    refresh,
  };
}
