import { NUTRIENT_UNIT, NUTRIENTS } from '../config';
import { formatAmount, formatNutrientValue } from '../core/format';
import { dayNutrition, ingredientsNutrition, mealsOn } from '../core/nutrition';
import { addDays } from '../core/time';
import type { GoalSet, NutrientValues } from '../core/types';
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

/** The goal set valid on `date`, or undefined before the first goals. */
export function goalSetOn(goals: readonly GoalSet[], date: string): GoalSet | undefined {
  return goals.filter((g) => g.from <= date).at(-1);
}

export function describeTargets(targets: NutrientValues): string {
  return NUTRIENTS.filter((n) => targets[n] !== undefined)
    .map(
      (n) =>
        `${formatNutrientValue(targets[n]!, n)} ${n === 'kcal' ? 'kcal' : `${NUTRIENT_UNIT[n]} ${n}`}`,
    )
    .join(' · ');
}

export function DayScreen({ store, date }: { store: Store; date: string }) {
  const data = store.data.value;
  const foods = store.foods.value;
  const set = goalSetOn(data.goals, date);
  const current = goalSetOn(data.goals, today.value);
  // Newest first: the meal just logged is right under the chart.
  const meals = mealsOn(data.meals, date).reverse();

  return (
    <div class="day">
      <DayChart goals={set?.targets ?? null} taken={dayNutrition(foods, data.meals, date)} />
      {set && set !== current && (
        <p class="hint">
          Goals of {set.from}: {describeTargets(set.targets)}
        </p>
      )}
      {data.goals.length === 0 && (
        <button type="button" class="button link" onClick={() => navigate('/goals')}>
          Set daily goals
        </button>
      )}

      <ul class="meal-list">
        {meals.length === 0 && <li class="empty">No meals.</li>}
        {meals.map((meal) => {
          const n = ingredientsNutrition(foods, meal.ingredients);
          return (
            <li key={meal.id}>
              <button type="button" class="meal-row" onClick={() => navigate(`/meal/${meal.id}`)}>
                <span class="meal-time">{meal.eatenAt.slice(11)}</span>
                <span class="meal-totals">
                  {formatAmount(n.kcal, 'kcal')} kcal · {formatAmount(n.protein, 'protein')} g
                  protein
                </span>
                <span class="meal-edit" aria-hidden="true">
                  ✎
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div class="action-bar">
        <button
          type="button"
          class="button primary wide"
          onClick={() => navigate(`/meal/new?date=${date}`)}
        >
          ＋ Eat
        </button>
      </div>
    </div>
  );
}
