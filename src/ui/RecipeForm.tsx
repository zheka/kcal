import { useEffect, useState } from 'preact/hooks';
import { NUTRIENT_LABEL, NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { isUsed, newId, recipesContaining, unitUsages, usages } from '../core/foods';
import { formatNutrientValue } from '../core/format';
import { ingredientsNutrients, type Nutrients } from '../core/nutrition';
import { cleanText, nameKey } from '../core/text';
import type { Recipe, RecipeUnit } from '../core/types';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { addUnit, noPending, pendingFor, saveWith, whatsNew } from '../core/pending';
import { dropDraft, keepDraft, loadDraft, requestProduct } from './drafts';
import { ingredientRow, IngredientsEditor, readIngredients } from './IngredientsEditor';
import { reopen, saveLabel, usePendingView, type PendingDraft } from './pendingDraft';
import { usedNotice } from './ProductForm';
import { goBack, navigate } from './router';
import {
  emptyUnitRow,
  readRecipeUnits,
  recipeUnitRows,
  UnitsEditor,
  type UnitRow,
} from './UnitsEditor';

interface Props {
  store: Store;
  /** null for a new recipe. */
  id: string | null;
  /** Where the unsaved recipe is kept while the user creates a product for it. */
  draftKey: string;
}

interface Draft extends PendingDraft {
  name: string;
  unitRows: UnitRow[];
}

/**
 * A recipe is composed like a meal, then says what it makes ("makes 6 servings", "makes
 * 1600 g" for a weighed pot): it is eaten only in those units.
 */
export function RecipeForm({ store, id, draftKey }: Props) {
  const data = store.data.value;
  const existing = id === null ? undefined : data.recipes.find((r) => r.id === id);

  // Foods deleted meanwhile drop out; a product created from the picker joins the ingredients.
  const [draft, setDraft] = useState<Draft>(() =>
    reopen(loadDraft<Draft>(draftKey) ?? fromRecipe(existing), data),
  );
  // The foods as this recipe sees them: with the ones it created or changed, not saved yet.
  const { data: view, foods } = usePendingView(store, draft.pending);
  useEffect(() => keepDraft(draftKey, draft), [draftKey, draft]);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (id !== null && !existing) return <p class="empty">This recipe does not exist.</p>;

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const { ingredients, invalid } = readIngredients(draft.rows);
  const { units, errors: unitErrors } = readRecipeUnits(draft.unitRows);
  const whole = ingredientsNutrients(foods, ingredients);
  const pendingChange = pendingFor(draft.pending, data, draft.rows);

  const cleanName = cleanText(draft.name);
  const taken = [...foods.values()].find(
    (f) => f.id !== id && nameKey(f.name) === nameKey(cleanName),
  );
  const errors = {
    name: !cleanName ? 'Add a name' : taken ? `“${taken.name}” already exists` : '',
    ingredients:
      draft.rows.length === 0 ? 'Add ingredients' : invalid.size > 0 ? 'Check the amounts' : '',
    units: units.length === 0 && unitErrors.size === 0 ? 'Say what it makes, e.g. 6 servings' : '',
  };
  const valid = Object.values(errors).every((e) => !e) && unitErrors.size === 0;

  const used = id === null ? undefined : usages(data, id);
  const inUse = used !== undefined && isUsed(used);

  function leave() {
    dropDraft(draftKey);
    goBack('/library');
  }

  function save() {
    setSubmitted(true);
    if (!valid) return;
    const recipe: Recipe = { id: existing?.id ?? newId(), ingredients, name: cleanName, units };
    try {
      // The recipe and the foods it created or changed, all or nothing.
      store.apply(saveWith(draft.pending, data, ingredients, { recipes: [recipe] }));
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
          data={view}
          foods={foods}
          news={whatsNew(pendingChange, data)}
          rows={draft.rows}
          onChange={(rows) => set({ rows })}
          exclude={id ? recipesContaining(data.recipes, id) : new Set()}
          onCreateFood={(name) => {
            requestProduct({ data: view });
            navigate(`/product/new?${new URLSearchParams({ name, add: '1' }).toString()}`);
          }}
          onCreateFromBarcode={(barcode) => {
            requestProduct({ data: view, barcode });
            navigate('/product/new?add=1');
          }}
          onOpenNew={(foodId) => {
            const product = view.products.find((p) => p.id === foodId);
            requestProduct({ data: view, ...(product && { product }) });
            navigate('/product/new?add=1&edit=1');
          }}
          onAddUnit={(foodId, unit) =>
            setDraft((d) => ({ ...d, pending: addUnit(d.pending, data, foodId, unit) }))
          }
          showErrors={submitted}
        />
        {show(errors.ingredients)}
      </fieldset>

      <fieldset class="section">
        <legend class="label">What it makes</legend>
        <UnitsEditor
          kind="recipe"
          rows={draft.unitRows}
          onChange={(unitRows) => set({ unitRows })}
          usesOf={(unitId) => (id ? unitUsages(data, id, unitId) : 0)}
          errors={submitted ? unitErrors : new Map()}
        />
        <p class="hint">
          The recipe is eaten in these units. Weighed the finished pot? Add its grams as a unit
          named “g”, e.g. makes 1600 g.
        </p>
        {show(errors.units)}
      </fieldset>

      <Totals whole={whole} units={units} />

      {inUse && <p class="notice">{usedNotice(used)}</p>}
      {saveError && <p class="error">Could not save: {saveError}</p>}

      <div class="actions action-bar">
        <button type="submit" class="button primary">
          {saveLabel(pendingChange, data)}
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
    pending: noPending,
    rows: (recipe?.ingredients ?? []).map(ingredientRow),
    unitRows: recipe ? recipeUnitRows(recipe.units) : [emptyUnitRow()],
  };
}

/** The recipe's nutrients: the whole recipe, and one of each of its first two units. */
function Totals({ whole, units }: { whole: Nutrients; units: RecipeUnit[] }) {
  const columns: [string, number][] = [
    ['Whole', 1],
    ...units.slice(0, 2).map((u): [string, number] => [`1 ${u.name}`, 1 / u.makes]),
  ];
  const cell = (n: Nutrient, factor: number) => formatNutrientValue(whole[n] * factor, n);

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
              {NUTRIENT_LABEL[n]}
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
