import { useEffect, useState } from 'preact/hooks';
import { NUTRIENT_UNIT, NUTRIENTS } from '../config';
import { newId, pickIngredient } from '../core/foods';
import { formatAmount } from '../core/format';
import { goalsOn } from '../core/goals';
import { defaultMealTime } from '../core/meals';
import { dayNutrition, ingredientsNutrition } from '../core/nutrition';
import { isValidDateTime } from '../core/time';
import type { AppData, Meal } from '../core/types';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { DayChart } from './DayChart';
import { dayPath } from './DayScreen';
import { dropDraft, keepDraft, loadDraft, takeCreatedFood } from './drafts';
import {
  ingredientRow,
  IngredientsEditor,
  readIngredients,
  type IngredientRow,
} from './IngredientsEditor';
import { goBack, navigate, replaceRoute, today } from './router';

interface Props {
  store: Store;
  /** null for a new meal. */
  id: string | null;
  /** New meal: the day it is for (default today). */
  date?: string;
  /** New meal: copy the ingredients of this meal (Eat again). */
  copyOf?: string;
  draftKey: string;
}

interface Draft {
  eatenAt: string;
  rows: IngredientRow[];
}

/**
 * Where a meal is put together: foods and amounts, while the day chart shows what was taken
 * (faded), this meal (bright) and what remains. Saving logs the meal.
 */
export function MealComposer({ store, id, date, copyOf, draftKey }: Props) {
  const data = store.data.value;
  const foods = store.foods.value;
  const existing = id === null ? undefined : data.meals.find((m) => m.id === id);

  const [draft, setDraft] = useState<Draft>(() => {
    const loaded = loadDraft<Draft>(draftKey) ?? initialDraft(data, existing, copyOf, date);
    const kept = { ...loaded, rows: loaded.rows.filter((r) => foods.has(r.food)) };
    const created = takeCreatedFood();
    const food = created ? foods.get(created) : undefined;
    return food
      ? { ...kept, rows: [...kept.rows, ingredientRow(pickIngredient(data, food))] }
      : kept;
  });
  useEffect(() => keepDraft(draftKey, draft), [draftKey, draft]);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (id !== null && !existing) return <p class="empty">This meal does not exist.</p>;

  const { ingredients, invalid } = readIngredients(draft.rows);
  const timeValid = isValidDateTime(draft.eatenAt);
  const day = timeValid
    ? draft.eatenAt.slice(0, 10)
    : (existing?.eatenAt ?? draft.eatenAt).slice(0, 10);
  const others = data.meals.filter((m) => m.id !== id);
  const meal = ingredientsNutrition(foods, ingredients);
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
    const saved: Meal = { id: existing?.id ?? newId(), eatenAt: draft.eatenAt, ingredients };
    try {
      store.saveMeal(saved);
    } catch (err) {
      setSaveError((err as Error).message);
      return;
    }
    leave();
  }

  const show = (error: string) => submitted && error && <p class="error">{error}</p>;

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
          taken={dayNutrition(foods, others, day)}
          meal={meal}
        />
        <p class="meal-summary">
          This meal:{' '}
          {NUTRIENTS.map(
            (n) =>
              `${formatAmount(meal[n], n)} ${n === 'kcal' ? 'kcal' : `${NUTRIENT_UNIT[n]} ${n}`}`,
          ).join(' · ')}
        </p>
      </div>

      <section class="section">
        <IngredientsEditor
          store={store}
          rows={draft.rows}
          onChange={(rows) => setDraft({ ...draft, rows })}
          onCreateFood={(name) =>
            navigate(`/product/new?${new URLSearchParams({ name, add: '1' }).toString()}`)
          }
          showErrors={submitted}
        />
        {show(errors.ingredients)}
      </section>

      <label class="field">
        <span class="label">Eaten at</span>
        <input
          class="input"
          type="datetime-local"
          aria-label="Eaten at"
          value={draft.eatenAt}
          onInput={(e) => setDraft({ ...draft, eatenAt: e.currentTarget.value })}
        />
        {show(errors.time)}
      </label>

      {saveError && <p class="error">Could not save: {saveError}</p>}

      <div class="actions">
        <button type="submit" class="button primary">
          Save
        </button>
        <button type="button" class="button" onClick={leave}>
          Cancel
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
  existing: Meal | undefined,
  copyOf: string | undefined,
  date: string | undefined,
): Draft {
  if (existing) return { eatenAt: existing.eatenAt, rows: existing.ingredients.map(ingredientRow) };
  // Eat again: the same foods, now.
  const source = copyOf ? data.meals.find((m) => m.id === copyOf) : undefined;
  return {
    eatenAt: defaultMealTime(data.meals, source ? today.value : (date ?? today.value), new Date()),
    rows: (source?.ingredients ?? []).map(ingredientRow),
  };
}
