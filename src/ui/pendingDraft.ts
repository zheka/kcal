import { useMemo } from 'preact/hooks';
import { pickIngredient } from '../core/foods';
import { buildFoodTable, type FoodTable } from '../core/nutrition';
import { hasPending, putProduct, whatsNew, withPending, type Pending } from '../core/pending';
import type { Change } from '../core/change';
import type { AppData } from '../core/types';
import type { Store } from '../state/store';
import { takeHandOver } from './drafts';
import { ingredientRow, type IngredientRow } from './IngredientsEditor';

/** A meal's or recipe's draft: its ingredient rows and the foods it created or changed. */
export interface PendingDraft {
  rows: IngredientRow[];
  pending: Pending;
}

/** The data and food table as a draft sees them: stored, with its pending foods. */
export function usePendingView(
  store: Store,
  pending: Pending,
): { data: AppData; foods: FoodTable } {
  const stored = store.data.value;
  const storedFoods = store.foods.value;
  return useMemo(() => {
    if (!hasPending(pending)) return { data: stored, foods: storedFoods };
    const data = withPending(stored, pending);
    return { data, foods: buildFoodTable(data.products, data.recipes) };
  }, [stored, storedFoods, pending]);
}

/**
 * A draft as it is (re)opened: with what a product form opened from it handed back (a new or
 * edited pending product, or a food to add), without rows of foods deleted meanwhile, and with
 * rows whose unit is gone (a pending product's, edited) back on a unit the food has.
 */
export function reopen<T extends PendingDraft>(draft: T, stored: AppData): T {
  const handed = takeHandOver();
  const pending =
    handed && 'product' in handed ? putProduct(draft.pending, handed.product) : draft.pending;
  const data = withPending(stored, pending);
  const foods = buildFoodTable(data.products, data.recipes);
  let rows = draft.rows.flatMap((row) => {
    const food = foods.get(row.food);
    if (!food) return [];
    return food.units.some((u) => u.id === row.unit)
      ? [row]
      : [ingredientRow(pickIngredient(data, food))];
  });
  const added = handed && ('product' in handed ? handed.product.id : handed.food);
  const food = added ? foods.get(added) : undefined;
  const already = handed && 'product' in handed && rows.some((r) => r.food === added);
  if (food && !already) rows = [...rows, ingredientRow(pickIngredient(data, food))];
  return { ...draft, pending, rows };
}

/** "Save", or what saving also saves: "Save + 1 new food, 2 new units". */
export function saveLabel(change: Change, stored: AppData): string {
  const { foods, units } = whatsNew(change, stored);
  const parts = [
    foods.size > 0 && `${foods.size} new food${foods.size === 1 ? '' : 's'}`,
    units.size > 0 && `${units.size} new unit${units.size === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.length > 0 ? `Save + ${parts.join(', ')}` : 'Save';
}
