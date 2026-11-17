import { useState } from 'preact/hooks';
import { foodsByRecency, pickIngredient } from '../core/foods';
import { formatAmount, formatNumber, parseNumber } from '../core/format';
import { ingredientNutrition, type FoodEntry } from '../core/nutrition';
import { cleanText, nameKey } from '../core/text';
import type { Ingredient } from '../core/types';
import { isReservedUnitName, newUnitId } from '../core/units';
import type { Store } from '../state/store';
import { FoodPicker } from './FoodPicker';

/** An ingredient as edited: the amount stays text while typing ("2," is fine). */
export interface IngredientRow {
  key: string;
  food: string;
  unit: string;
  amountText: string;
}

let nextKey = 1;
export function ingredientRow(ingredient: Ingredient): IngredientRow {
  return {
    key: `row${nextKey++}`,
    food: ingredient.food,
    unit: ingredient.unit,
    amountText: formatNumber(ingredient.amount, 3),
  };
}

/** The rows with a valid amount, as ingredients, and the keys of rows without one. */
export function readIngredients(rows: readonly IngredientRow[]): {
  ingredients: Ingredient[];
  invalid: Set<string>;
} {
  const ingredients: Ingredient[] = [];
  const invalid = new Set<string>();
  for (const row of rows) {
    const amount = parseNumber(row.amountText);
    if (amount === null) invalid.add(row.key);
    else ingredients.push({ food: row.food, unit: row.unit, amount });
  }
  return { ingredients, invalid };
}

interface Props {
  store: Store;
  rows: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
  /** Foods that may not be added (recipes that contain the recipe being edited). */
  exclude?: ReadonlySet<string>;
  /** Starts creating a product with this name, to be added here once saved. */
  onCreateFood: (name: string) => void;
  showErrors: boolean;
}

const NEW_UNIT = '__new__';

/** The ingredient list of a meal or a recipe: rows edited inline, and a picker to add more. */
export function IngredientsEditor({
  store,
  rows,
  onChange,
  exclude,
  onCreateFood,
  showErrors,
}: Props) {
  const foods = store.foods.value;
  const data = store.data.value;
  const [newUnitFor, setNewUnitFor] = useState<string | null>(null);

  const change = (key: string, patch: Partial<IngredientRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const pickable = foodsByRecency(data, foods).filter((f) => !exclude?.has(f.id));

  return (
    <div class="ingredients">
      {rows.length === 0 && <p class="empty">No ingredients yet.</p>}
      {rows.map((row) => {
        const food = foods.get(row.food);
        if (!food) return null;
        const amount = parseNumber(row.amountText);
        const kcal =
          amount === null
            ? '–'
            : formatAmount(ingredientNutrition(foods, { ...row, amount }).kcal, 'kcal');
        return (
          <div class="ingredient" key={row.key}>
            <div class="ingredient-main">
              <div class="ingredient-text">
                <span class="ingredient-name">{food.name}</span>
                <span class="ingredient-kcal">{kcal} kcal</span>
              </div>
              <input
                class={`input number ${showErrors && amount === null ? 'invalid' : ''}`}
                aria-label={`Amount of ${food.name}`}
                inputMode="decimal"
                enterKeyHint="done"
                value={row.amountText}
                onInput={(e) => change(row.key, { amountText: e.currentTarget.value })}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
              />
              <select
                class="input"
                aria-label={`Unit of ${food.name}`}
                value={row.unit}
                onChange={(e) => {
                  const unit = e.currentTarget.value;
                  if (unit === NEW_UNIT) {
                    setNewUnitFor(row.key);
                    e.currentTarget.value = row.unit;
                  } else {
                    change(row.key, { unit });
                  }
                }}
              >
                {food.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                <option value={NEW_UNIT}>＋ new unit…</option>
              </select>
              <button
                type="button"
                class="icon-button"
                aria-label={`Remove ${food.name}`}
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              >
                ×
              </button>
            </div>
            {showErrors && amount === null && <p class="error">Add an amount</p>}
            {newUnitFor === row.key && (
              <NewUnitForm
                store={store}
                food={food}
                onDone={(unitId) => {
                  setNewUnitFor(null);
                  if (unitId) change(row.key, { unit: unitId, amountText: '1' });
                }}
              />
            )}
          </div>
        );
      })}
      <FoodPicker
        foods={pickable}
        onPick={(food) => onChange([...rows, ingredientRow(pickIngredient(data, food))])}
        onCreate={onCreateFood}
        nameTaken={(name) => [...foods.values()].some((f) => nameKey(f.name) === nameKey(name))}
      />
    </div>
  );
}

/** Adds a unit to a food right from an ingredient row, and selects it. */
function NewUnitForm({
  store,
  food,
  onDone,
}: {
  store: Store;
  food: FoodEntry;
  onDone: (unitId: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [gramsText, setGramsText] = useState('');
  const [error, setError] = useState('');

  function add() {
    const unitName = cleanText(name);
    const grams = parseNumber(gramsText);
    if (!unitName) return setError('Add a name');
    if (
      isReservedUnitName(food.kind, unitName) ||
      food.units.some((u) => nameKey(u.name) === nameKey(unitName))
    ) {
      return setError(`“${unitName}” already exists`);
    }
    if (grams === null || grams <= 0) return setError('Add its weight in grams');
    const data = store.data.value;
    try {
      if (food.kind === 'product') {
        const product = data.products.find((p) => p.id === food.id)!;
        const unit = { id: newUnitId(product.units), name: unitName, grams };
        store.saveProduct({ ...product, units: [...product.units, unit] });
        onDone(unit.id);
      } else {
        const recipe = data.recipes.find((r) => r.id === food.id)!;
        const unit = { id: newUnitId(recipe.units), name: unitName, grams };
        store.saveRecipe({ ...recipe, units: [...recipe.units, unit] });
        onDone(unit.id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div class="new-unit">
      <span class="label">New unit of {food.name}</span>
      <div class="unit-fields">
        <span class="unit-one">1</span>
        <input
          class="input"
          aria-label="New unit name"
          placeholder="cup"
          value={name}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <span>=</span>
        <input
          class="input number"
          aria-label="New unit grams"
          inputMode="decimal"
          placeholder="250"
          value={gramsText}
          onInput={(e) => setGramsText(e.currentTarget.value)}
        />
        <span>g</span>
      </div>
      {error && <p class="error">{error}</p>}
      <div class="actions">
        <button type="button" class="button primary" onClick={add}>
          Add unit
        </button>
        <button type="button" class="button" onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
