import { useState } from 'preact/hooks';
import { foodsByRecency, newId, pickIngredient, productWithBarcode } from '../core/foods';
import { formatNumber, formatNutrientValue, parseNumber } from '../core/format';
import { ingredientPortion, type FoodEntry, type FoodTable } from '../core/nutrition';
import { cleanText, nameKey } from '../core/text';
import type { AppData, Ingredient, ProductUnit, RecipeUnit } from '../core/types';
import { roundStored } from '../core/decimal';
import { isReservedProductUnitName } from '../core/units';
import { GRAMS, type Base } from '../config';
import { BaseSelect } from './UnitsEditor';
import { FoodPicker } from './FoodPicker';
import { CloseIcon } from './icons';

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
  /** The data and foods as the draft sees them: stored, with its pending foods. */
  data: AppData;
  foods: FoodTable;
  /** Foods and units the draft created, not saved yet: marked new. */
  news: { foods: ReadonlySet<string>; units: ReadonlySet<string> };
  rows: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
  /** Foods that may not be added (recipes that contain the recipe being edited). */
  exclude?: ReadonlySet<string>;
  /** Starts creating a product with this name, to be added here once saved. */
  onCreateFood: (name: string) => void;
  /** Starts creating a product for a scanned barcode that no food has, looked up first. */
  onCreateFromBarcode: (code: string) => void;
  /** Opens a new (pending) product to edit it. */
  onOpenNew: (id: string) => void;
  /** Adds a unit to a food: pending, saved with the meal or recipe. */
  onAddUnit: (foodId: string, unit: ProductUnit | RecipeUnit) => void;
  showErrors: boolean;
}

const NEW_UNIT = '__new__';

/** The ingredient list of a meal or a recipe: rows edited inline, and a picker to add more. */
export function IngredientsEditor({
  data,
  foods,
  news,
  rows,
  onChange,
  exclude,
  onCreateFood,
  onCreateFromBarcode,
  onOpenNew,
  onAddUnit,
  showErrors,
}: Props) {
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
            : formatNutrientValue(ingredientPortion(foods, { ...row, amount }).kcal, 'kcal');
        return (
          <div class="ingredient" key={row.key}>
            <div class="ingredient-main">
              <div class="ingredient-text">
                <span class="ingredient-title">
                  <span class="ingredient-name">{food.name}</span>
                  {news.foods.has(food.id) && (
                    <button
                      type="button"
                      class="new-badge"
                      aria-label={`Edit new product ${food.name}`}
                      onClick={() => onOpenNew(food.id)}
                    >
                      new
                    </button>
                  )}
                </span>
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
                    {news.units.has(u.id) ? `${u.name} (new)` : u.name}
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
                <CloseIcon />
              </button>
            </div>
            {showErrors && amount === null && <p class="error">Add an amount</p>}
            {newUnitFor === row.key && (
              <NewUnitForm
                food={food}
                onAdd={(unit) => {
                  setNewUnitFor(null);
                  onAddUnit(food.id, unit);
                  change(row.key, { unit: unit.id, amountText: '1' });
                }}
                onCancel={() => setNewUnitFor(null)}
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
        onScan={(code) => {
          // A product of mine (or a new one of this draft) with this barcode: add it.
          const known = productWithBarcode(data, code);
          const food = known && foods.get(known.id);
          if (food) onChange([...rows, ingredientRow(pickIngredient(data, food))]);
          else onCreateFromBarcode(code);
        }}
      />
    </div>
  );
}

/**
 * A new unit for a food, right from an ingredient row: for a product, how many g or ml one is
 * (in a base the product has); for a recipe, how many of it the whole recipe makes. It is
 * pending: saved with the meal or recipe.
 */
function NewUnitForm({
  food,
  onAdd,
  onCancel,
}: {
  food: FoodEntry;
  onAdd: (unit: ProductUnit | RecipeUnit) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [valueText, setValueText] = useState('');
  const [base, setBase] = useState<Base>(food.bases[0] ?? GRAMS);
  const [error, setError] = useState('');
  const isProduct = food.kind === 'product';

  function add() {
    const unitName = cleanText(name);
    const parsed = parseNumber(valueText);
    const value = parsed === null ? null : roundStored(parsed);
    if (!unitName) return setError('Add a name');
    if (isProduct && isReservedProductUnitName(unitName)) {
      return setError(`“${unitName}” is reserved: g and ml are the product’s bases`);
    }
    if (food.units.some((u) => nameKey(u.name) === nameKey(unitName))) {
      return setError(`“${unitName}” already exists`);
    }
    if (value === null || value <= 0) {
      return setError(isProduct ? `Add how many ${base} it is` : 'Add how many the recipe makes');
    }
    const id = newId();
    onAdd(
      isProduct
        ? base === GRAMS
          ? { g: value, id, name: unitName }
          : { id, ml: value, name: unitName }
        : { id, makes: value, name: unitName },
    );
  }

  const nameInput = (
    <input
      class="input"
      aria-label="New unit name"
      placeholder={isProduct ? 'cup' : 'servings'}
      value={name}
      onInput={(e) => setName(e.currentTarget.value)}
    />
  );
  const valueInput = (
    <input
      class="input number"
      aria-label={isProduct ? 'New unit size' : 'New unit makes'}
      inputMode="decimal"
      placeholder={isProduct ? '250' : '6'}
      value={valueText}
      onInput={(e) => setValueText(e.currentTarget.value)}
    />
  );

  return (
    <div class="new-unit">
      <div class="new-unit-head">
        <span class="label">New unit of {food.name}</span>
        <button
          type="button"
          class="icon-button"
          aria-label={`Close new unit of ${food.name}`}
          onClick={onCancel}
        >
          <CloseIcon />
        </button>
      </div>
      <div class={`unit-fields ${isProduct ? 'product' : 'recipe'} new`}>
        {isProduct ? (
          <>
            <span class="unit-one">1</span>
            {nameInput}
            <span>=</span>
            {valueInput}
            <BaseSelect bases={food.bases} value={base} onChange={setBase} label="New unit base" />
          </>
        ) : (
          <>
            <span class="unit-one">makes</span>
            {valueInput}
            {nameInput}
          </>
        )}
      </div>
      {error && <p class="error">{error}</p>}
      <div class="actions">
        <button type="button" class="button primary" onClick={add}>
          Add unit
        </button>
      </div>
    </div>
  );
}
