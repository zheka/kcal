import { useEffect, useState } from 'preact/hooks';
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
  /** New meal: start with this ingredient (a quick button's). */
  start?: Ingredient;
  draftKey: string;
}

interface Draft {
  /** The local minute, as in the datetime-local input. */
  minute: string;
  rows: IngredientRow[];
}

/**
 * Where a meal is put together: foods and amounts, while the day chart shows what was taken
 * (faded), this meal (bright) and what remains. Saving logs the meal.
 */
export function MealComposer({ store, id, date, copyOf, start, draftKey }: Props) {
  const data = store.data.value;
  const foods = store.foods.value;
  const existing = id === null ? undefined : data.meals.find((m) => m.id === id);

  const [draft, setDraft] = useState<Draft>(() => {
    const loaded =
      loadDraft<Draft>(draftKey) ?? initialDraft(data, foods, existing, { date, copyOf, start });
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
      store.saveMeal(saved);
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
          Save
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
    rows,
  };
}
