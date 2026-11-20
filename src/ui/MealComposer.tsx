import { useEffect, useState } from 'preact/hooks';
import { addUnit, noPending, pendingFor, saveWith, whatsNew } from '../core/pending';
import { NUTRIENTS } from '../config';
import { newId, pickIngredient } from '../core/foods';
import { formatNutrient } from '../core/format';
import { goalsOn } from '../core/goals';
import { consumedAtFor, defaultMealMinute } from '../core/meals';
import { dayNutrients, ingredientsNutrients } from '../core/nutrition';
import { isValidLocalMinute, localMinuteOf } from '../core/time';
import type { AppData, Ingredient, Meal } from '../core/types';
import type { FoodTable } from '../core/nutrition';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { DayChart } from './DayChart';
import { dayPath } from './DayScreen';
import { dropDraft, keepDraft, loadDraft, requestProduct } from './drafts';
import { ingredientRow, IngredientsEditor, readIngredients } from './IngredientsEditor';
import { reopen, saveLabel, usePendingView, type PendingDraft } from './pendingDraft';
import { goBack, navigate, replaceRoute, today } from './router';

interface Props {
  store: Store;
  /** null for a new meal. */
  id: string | null;
  /** New meal: the day it is for (default today). */
  date?: string;
  /** New meal: copy the ingredients of this meal (Eat again). */
  copyOf?: string;
  /** New meal: start with this ingredient (a quick button's). */
  start?: Ingredient;
  draftKey: string;
}

interface Draft extends PendingDraft {
  /** The local minute, as in the datetime-local input. */
  minute: string;
}

/**
 * Where a meal is put together: foods and amounts, while the day chart shows what was taken
 * (faded), this meal (bright) and what remains. Saving logs the meal.
 */
export function MealComposer({ store, id, date, copyOf, start, draftKey }: Props) {
  const data = store.data.value;
  const existing = id === null ? undefined : data.meals.find((m) => m.id === id);

  const [draft, setDraft] = useState<Draft>(() =>
    reopen(
      loadDraft<Draft>(draftKey) ??
        initialDraft(data, store.foods.value, existing, { date, copyOf, start }),
      data,
    ),
  );
  // The foods as this meal sees them: with the ones it created or changed, not saved yet.
  const { data: view, foods } = usePendingView(store, draft.pending);
  useEffect(() => keepDraft(draftKey, draft), [draftKey, draft]);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (id !== null && !existing) return <p class="empty">This meal does not exist.</p>;

  const { ingredients, invalid } = readIngredients(draft.rows);
  const pendingChange = pendingFor(draft.pending, data, draft.rows);
  const timeValid = isValidLocalMinute(draft.minute);
  const day = timeValid
    ? draft.minute.slice(0, 10)
    : existing
      ? localMinuteOf(existing.consumedAt).slice(0, 10)
      : (date ?? today.value);
  const others = data.meals.filter((m) => m.id !== id);
  const meal = ingredientsNutrients(foods, ingredients);
  const errors = {
    time: timeValid ? '' : 'Set the date and time',
    ingredients: draft.rows.length === 0 ? 'Add food' : invalid.size > 0 ? 'Check the amounts' : '',
  };
  const valid = !errors.time && !errors.ingredients;

  function leave() {
    dropDraft(draftKey);
    goBack(dayPath(day));
  }

  function save() {
    setSubmitted(true);
    if (!valid) return;
    const saved: Meal = {
      consumedAt: consumedAtFor(draft.minute, existing, new Date()),
      id: existing?.id ?? newId(),
      ingredients,
    };
    try {
      // The meal and the foods it created or changed, all or nothing.
      store.apply(saveWith(draft.pending, data, ingredients, { meals: [saved] }));
    } catch (err) {
      setSaveError((err as Error).message);
      return;
    }
    leave();
  }

  const show = (error: string) => submitted && error && <p class="error">{error}</p>;
  const summary = NUTRIENTS.filter((n) => n !== 'water' || meal.water > 0)
    .map((n) => formatNutrient(meal[n], n))
    .join(' · ');

  return (
    <form
      class="form composer"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div class="composer-chart">
        <DayChart
          goals={goalsOn(data.goals, day)}
          taken={dayNutrients(foods, others, day)}
          meal={meal}
        />
        <p class="meal-summary">This meal: {summary}</p>
      </div>

      <section class="section">
        <IngredientsEditor
          data={view}
          foods={foods}
          news={whatsNew(pendingChange, data)}
          rows={draft.rows}
          onChange={(rows) => setDraft((d) => ({ ...d, rows }))}
          onCreateFood={(name) => {
            requestProduct({ data: view });
            navigate(`/product/new?${new URLSearchParams({ name, add: '1' }).toString()}`);
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
      </section>

      <label class="field">
        <span class="label">Consumed at</span>
        <input
          class="input"
          type="datetime-local"
          aria-label="Consumed at"
          value={draft.minute}
          onInput={(e) => setDraft({ ...draft, minute: e.currentTarget.value })}
        />
        {show(errors.time)}
      </label>

      {saveError && <p class="error">Could not save: {saveError}</p>}

      <div class="actions action-bar">
        <button type="submit" class="button primary">
          {saveLabel(pendingChange, data)}
        </button>
        {existing && (
          <>
            <button
              type="button"
              class="button"
              onClick={() => {
                dropDraft(draftKey);
                replaceRoute(`/meal/new?from=${existing.id}`);
              }}
            >
              Eat again
            </button>
            <ConfirmButton
              class="push-right"
              label="Delete"
              confirmLabel="Tap again to delete"
              onConfirm={() => {
                store.deleteMeal(existing.id);
                leave();
              }}
            />
          </>
        )}
      </div>
    </form>
  );
}

function initialDraft(
  data: AppData,
  foods: FoodTable,
  existing: Meal | undefined,
  {
    date,
    copyOf,
    start,
  }: { date?: string | undefined; copyOf?: string | undefined; start?: Ingredient | undefined },
): Draft {
  if (existing) {
    return {
      minute: localMinuteOf(existing.consumedAt),
      pending: noPending,
      rows: existing.ingredients.map(ingredientRow),
    };
  }
  const now = new Date();
  // Eat again: the same foods, now.
  const source = copyOf ? data.meals.find((m) => m.id === copyOf) : undefined;
  // A quick button's food, as it says; if the food lost that unit meanwhile, as when picked.
  const startFood = start ? foods.get(start.food) : undefined;
  const first =
    start && startFood
      ? startFood.units.some((u) => u.id === start.unit)
        ? start
        : pickIngredient(data, startFood)
      : undefined;
  const rows = source ? source.ingredients.map(ingredientRow) : first ? [ingredientRow(first)] : [];
  return {
    minute: defaultMealMinute(data.meals, source ? today.value : (date ?? today.value), now),
    pending: noPending,
    rows,
  };
}
