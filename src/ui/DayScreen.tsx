import { NUTRIENTS, type Nutrient } from '../config';
import { formatNumber, formatNutrient } from '../core/format';
import { charCount } from '../core/text';
import { goalSetOn, goalsOn } from '../core/goals';
import { dayNutrients, ingredientsNutrients, mealsOn, type Nutrients } from '../core/nutrition';
import { addDays, localDateOf, localMinuteOf } from '../core/time';
import type { NutrientValues, QuickButton } from '../core/types';
import type { FoodTable } from '../core/nutrition';
import type { Store } from '../state/store';
import { DayChart } from './DayChart';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { navigate, replaceRoute, today } from './router';

export function dayPath(date: string): string {
  return date === today.value ? '/' : `/day/${date}`;
}

/** A date in goals (when they apply from): with the year, no weekday, e.g. `Nov 1, 2026`. */
export function goalDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** A day's title: `Today`, or the date with its weekday, no year, e.g. `Wed, Nov 18`. */
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
        <ChevronLeftIcon />
      </button>
      <h1>{dayTitle(date)}</h1>
      <button
        type="button"
        class="icon-button"
        aria-label="Next day"
        onClick={() => replaceRoute(dayPath(addDays(date, 1)))}
      >
        <ChevronRightIcon />
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

  // Each quick button is 56 px high with 12 px between: the list leaves that much room.
  const stack = data.settings.quickButtons.length * 68;
  return (
    <div class="day" style={{ '--quick-stack': `${stack}px` }}>
      <DayChart goals={goals} taken={dayNutrients(foods, data.meals, date)} />
      {set && set !== current && (
        <p class="hint">
          Goals of {goalDate(localDateOf(set.setAt))}: {describeTargets(set.perDay) || 'none'}
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
            </button>
          </li>
        ))}
      </ul>

      <QuickButtons buttons={data.settings.quickButtons} foods={foods} date={date} />
    </div>
  );
}

/** What a quick button does, for screen readers: `water · 250 ml`, or `New meal`. */
export function quickButtonName(button: QuickButton, foods: FoodTable): string {
  if (button.food === undefined) return 'New meal';
  const food = foods.get(button.food);
  const unit = food?.units.find((u) => u.id === button.unit);
  return `${food?.name ?? '?'} · ${formatNumber(button.amount, 3)} ${unit?.name ?? ''}`.trim();
}

/**
 * The quick buttons, round and stacked in the bottom-right corner (from the settings): each
 * opens a new meal for the day on screen, empty or with its food.
 */
function QuickButtons({
  buttons,
  foods,
  date,
}: {
  buttons: readonly QuickButton[];
  foods: FoodTable;
  date: string;
}) {
  if (buttons.length === 0) return null;
  return (
    <nav class="quick-buttons" aria-label="Quick buttons">
      {buttons.map((button, i) => {
        const params = new URLSearchParams({ date });
        if (button.food !== undefined) {
          params.set('food', button.food);
          params.set('amount', String(button.amount));
          params.set('unit', button.unit);
        }
        return (
          <button
            key={i}
            type="button"
            class={`quick-button ${charCount(button.label) === 1 ? 'round' : 'pill'}`}
            aria-label={`${button.label}: ${quickButtonName(button, foods)}`}
            onClick={() => navigate(`/meal/new?${params.toString()}`)}
          >
            {button.label}
          </button>
        );
      })}
    </nav>
  );
}
