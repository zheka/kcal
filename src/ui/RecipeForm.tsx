import { useEffect, useState } from 'preact/hooks';
import { NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { newId, pickIngredient, recipesContaining, unitUsages, usages } from '../core/foods';
import { formatAmount, formatNumber, parseNumber } from '../core/format';
import { ingredientGrams, ingredientsNutrition, type Nutrition } from '../core/nutrition';
import { cleanText, nameKey } from '../core/text';
import type { Recipe } from '../core/types';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { dropDraft, keepDraft, loadDraft, takeCreatedFood } from './drafts';
import {
  ingredientRow,
  IngredientsEditor,
  readIngredients,
  type IngredientRow,
} from './IngredientsEditor';
import { plural } from './ProductForm';
import { goBack, navigate } from './router';
import { readUnits, unitRowsFrom, UnitsEditor, type UnitRow } from './UnitsEditor';

interface Props {
  store: Store;
  /** null for a new recipe. */
  id: string | null;
  /** Where the unsaved recipe is kept while the user creates a product for it. */
  draftKey: string;
}

interface Draft {
  name: string;
  rows: IngredientRow[];
  servingsText: string;
  cookedText: string;
  unitRows: UnitRow[];
}

export function RecipeForm({ store, id, draftKey }: Props) {
  const data = store.data.value;
  const foods = store.foods.value;
  const existing = id === null ? undefined : data.recipes.find((r) => r.id === id);

  const [draft, setDraft] = useState<Draft>(() => {
    const loaded = loadDraft<Draft>(draftKey) ?? fromRecipe(existing);
    // Foods deleted meanwhile drop out of an unsaved draft.
    const kept = { ...loaded, rows: loaded.rows.filter((r) => foods.has(r.food)) };
    // A product just created from this recipe's picker joins the ingredients.
    const created = takeCreatedFood();
    const food = created ? foods.get(created) : undefined;
    return food
      ? { ...kept, rows: [...kept.rows, ingredientRow(pickIngredient(data, food))] }
      : kept;
  });
  useEffect(() => keepDraft(draftKey, draft), [draftKey, draft]);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (id !== null && !existing) return <p class="empty">This recipe does not exist.</p>;

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const { ingredients, invalid } = readIngredients(draft.rows);
  const { units, errors: unitErrors } = readUnits(draft.unitRows, 'recipe');
  const servings = optionalPositive(draft.servingsText);
  const cooked = optionalPositive(draft.cookedText);

  const ingredientsWeight = ingredients.reduce((sum, i) => sum + ingredientGrams(foods, i), 0);
  const weight = cooked.value ?? ingredientsWeight;
  const total = ingredientsNutrition(foods, ingredients);

  const cleanName = cleanText(draft.name);
  const taken = [...foods.values()].find(
    (f) => f.id !== id && nameKey(f.name) === nameKey(cleanName),
  );
  const errors = {
    name: !cleanName ? 'Add a name' : taken ? `“${taken.name}” already exists` : '',
    ingredients:
      draft.rows.length === 0 ? 'Add ingredients' : invalid.size > 0 ? 'Check the amounts' : '',
    servings: servings.error,
    cooked: cooked.error,
    weight: draft.rows.length > 0 && weight <= 0 ? 'The recipe weighs nothing' : '',
  };
  const valid = Object.values(errors).every((e) => !e) && unitErrors.size === 0;

  const used = id === null ? { meals: 0, recipes: 0 } : usages(data, id);
  const inUse = used.meals + used.recipes > 0;

  function leave() {
    dropDraft(draftKey);
    goBack('/library');
  }

  function save() {
    setSubmitted(true);
    if (!valid) return;
    const recipe: Recipe = {
      id: existing?.id ?? newId(),
      name: cleanName,
      ingredients,
      cookedGrams: cooked.value,
      servings: servings.value,
      units,
      archived: existing?.archived ?? false,
    };
    try {
      store.saveRecipe(recipe);
    } catch (err) {
      setSaveError((err as Error).message);
      return;
    }
    leave();
  }

  const show = (error: string | undefined) => submitted && error && <p class="error">{error}</p>;

  return (
    <form
      class="form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label class="field">
        <span class="label">Name</span>
        <input
          class="input"
          value={draft.name}
          placeholder="e.g. Oats with honey"
          onInput={(e) => set({ name: e.currentTarget.value })}
        />
        {show(errors.name)}
      </label>

      <fieldset class="section">
        <legend class="label">Ingredients</legend>
        <IngredientsEditor
          store={store}
          rows={draft.rows}
          onChange={(rows) => set({ rows })}
          exclude={id ? recipesContaining(data.recipes, id) : new Set()}
          onCreateFood={(name) =>
            navigate(`/product/new?${new URLSearchParams({ name, add: '1' }).toString()}`)
          }
          showErrors={submitted}
        />
        {show(errors.ingredients)}
      </fieldset>

      <fieldset class="section">
        <legend class="label">Makes</legend>
        <div class="yield">
          <label class="field">
            <span class="label">Servings</span>
            <input
              class="input number"
              inputMode="decimal"
              placeholder="optional"
              value={draft.servingsText}
              onInput={(e) => set({ servingsText: e.currentTarget.value })}
            />
            {show(errors.servings)}
          </label>
          <label class="field">
            <span class="label">Weighed when ready (g)</span>
            <input
              class="input number"
              inputMode="decimal"
              placeholder={formatNumber(ingredientsWeight, 0)}
              value={draft.cookedText}
              onInput={(e) => set({ cookedText: e.currentTarget.value })}
            />
            {show(errors.cooked)}
          </label>
        </div>
        <p class="hint">
          {cooked.value === null
            ? `Weighs ${formatNumber(ingredientsWeight, 0)} g: the sum of its ingredients.`
            : `Ingredients weigh ${formatNumber(ingredientsWeight, 0)} g; the dish ${formatNumber(cooked.value, 0)} g.`}
        </p>
        {show(errors.weight)}
      </fieldset>

      <Totals total={total} weight={weight} servings={servings.value} />

      <fieldset class="section">
        <legend class="label">Units</legend>
        <UnitsEditor
          rows={draft.unitRows}
          onChange={(unitRows) => set({ unitRows })}
          usesOf={(unitId) => (id ? unitUsages(data, id, unitId) : 0)}
          errors={submitted ? unitErrors : new Map()}
        />
      </fieldset>

      {inUse && (
        <p class="notice">
          Used in {plural(used.meals, 'meal')} and {plural(used.recipes, 'recipe')}: saving changes
          them too.
        </p>
      )}
      {saveError && <p class="error">Could not save: {saveError}</p>}

      <div class="actions action-bar">
        <button type="submit" class="button primary">
          Save
        </button>
        <button type="button" class="button" onClick={leave}>
          Cancel
        </button>
        {existing && !inUse && (
          <ConfirmButton
            class="push-right"
            label="Delete"
            confirmLabel="Tap again to delete"
            onConfirm={() => {
              store.deleteFood(existing.id);
              leave();
            }}
          />
        )}
      </div>
    </form>
  );
}

function fromRecipe(recipe: Recipe | undefined): Draft {
  return {
    name: recipe?.name ?? '',
    rows: (recipe?.ingredients ?? []).map(ingredientRow),
    servingsText: recipe?.servings ? formatNumber(recipe.servings, 3) : '',
    cookedText: recipe?.cookedGrams ? formatNumber(recipe.cookedGrams, 3) : '',
    unitRows: unitRowsFrom(recipe?.units ?? []),
  };
}

/** An optional positive number field: empty is null. */
function optionalPositive(text: string): { value: number | null; error: string } {
  if (text.trim() === '') return { value: null, error: '' };
  const n = parseNumber(text);
  return n !== null && n > 0 ? { value: n, error: '' } : { value: null, error: 'Not a number' };
}

/** The recipe's nutrients: the whole dish, per serving and per 100 g. */
function Totals({
  total,
  weight,
  servings,
}: {
  total: Nutrition;
  weight: number;
  servings: number | null;
}) {
  const columns: [string, number][] = [['Whole', 1]];
  if (servings) columns.push(['Serving', 1 / servings]);
  if (weight > 0) columns.push(['100 g', 100 / weight]);
  const cell = (n: Nutrient, factor: number) =>
    formatAmount({ value: total[n].value * factor, missing: total[n].missing }, n);

  return (
    <table class="totals">
      <thead>
        <tr>
          <th />
          {columns.map(([label]) => (
            <th key={label}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {NUTRIENTS.map((n) => (
          <tr key={n}>
            <th>
              {n}
              {n !== 'kcal' && ` (${NUTRIENT_UNIT[n]})`}
            </th>
            {columns.map(([label, factor]) => (
              <td key={label}>{cell(n, factor)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
