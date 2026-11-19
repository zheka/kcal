import { NUTRIENTS, type Nutrient } from '../config';
import { WATER_ID } from '../core/builtins';
import { formatNutrient } from '../core/format';
import { goalSetOn, goalsOn } from '../core/goals';
import { dayNutrients, ingredientsNutrients, mealsOn, type Nutrients } from '../core/nutrition';
import { addDays, localDateOf, localMinuteOf } from '../core/time';
import type { NutrientValues } from '../core/types';
import type { Store } from '../state/store';
import { DayChart } from './DayChart';
import { navigate, replaceRoute, today } from './router';

export function dayPath(date: string): string {
  return date === today.value ? '/' : `/day/${date}`;
}

/** `Today`, or the date: `Tue, 18 Nov`. */
export function dayTitle(date: string): string {
  if (date === today.value) return 'Today';
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** The header of a day: ‹ date ›. Moving between days replaces the screen. */
export function DayNav({ date }: { date: string }) {
  return (
    <div class="day-nav">
      <button
        type="button"
        class="icon-button"
        aria-label="Previous day"
        onClick={() => replaceRoute(dayPath(addDays(date, -1)))}
      >
        ‹
      </button>
      <h1>{dayTitle(date)}</h1>
      <button
        type="button"
        class="icon-button"
        aria-label="Next day"
        onClick={() => replaceRoute(dayPath(addDays(date, 1)))}
      >
        ›
      </button>
    </div>
  );
}

/** `2000 kcal · 150 g protein · 2000 ml water`. */
export function describeTargets(perDay: NutrientValues | undefined): string {
  return NUTRIENTS.filter((n) => perDay?.[n] !== undefined)
    .map((n) => formatNutrient(perDay![n]!, n))
    .join(' · ');
}

/**
 * What a meal row shows: the nutrients that have goals that day, so every meal (a glass of
 * water too) shows how it moves each goal; kcal before the first goals.
 */
export function mealSummary(n: Nutrients, goals: NutrientValues | null): string {
  const shown: Nutrient[] = goals ? NUTRIENTS.filter((x) => goals[x] !== undefined) : ['kcal'];
  return shown.map((x) => formatNutrient(n[x], x)).join(' · ');
}

export function DayScreen({ store, date }: { store: Store; date: string }) {
  const data = store.data.value;
  const foods = store.foods.value;
  const set = goalSetOn(data.goals, date);
  const current = goalSetOn(data.goals, today.value);
  const goals = goalsOn(data.goals, date);
  // Newest first: the meal just logged is right under the chart.
  const meals = mealsOn(data.meals, date).reverse();

  return (
    <div class="day">
      <DayChart goals={goals} taken={dayNutrients(foods, data.meals, date)} />
      {set && set !== current && (
        <p class="hint">
          Goals of {localDateOf(set.setAt)}: {describeTargets(set.perDay) || 'none'}
        </p>
      )}
      {data.goals.length === 0 && (
        <button type="button" class="button link" onClick={() => navigate('/goals')}>
          Set daily goals
        </button>
      )}

      <ul class="meal-list">
        {meals.length === 0 && <li class="empty">No meals.</li>}
        {meals.map((meal) => (
          <li key={meal.id}>
            <button type="button" class="meal-row" onClick={() => navigate(`/meal/${meal.id}`)}>
              <span class="meal-time">{localMinuteOf(meal.consumedAt).slice(11)}</span>
              <span class="meal-totals">
                {mealSummary(ingredientsNutrients(foods, meal.ingredients), goals)}
              </span>
              <span class="meal-edit" aria-hidden="true">
                ✎
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div class="action-bar actions">
        <button
          type="button"
          class="button primary grow"
          onClick={() => navigate(`/meal/new?date=${date}`)}
        >
          ＋ Eat
        </button>
        <button
          type="button"
          class="button water grow"
          onClick={() => navigate(`/meal/new?date=${date}&start=${WATER_ID}`)}
        >
          ＋ Water
        </button>
      </div>
    </div>
  );
}
