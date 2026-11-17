import { NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { formatNumber, formatNutrientValue } from '../core/format';
import { macroSplit } from '../core/meals';
import { addNutrition, type NutrientAmount, type Nutrition } from '../core/nutrition';
import type { NutrientValues } from '../core/types';

interface Props {
  /** Targets valid on the day; null before the first goals. */
  goals: NutrientValues | null;
  /** Eaten that day, apart from the meal being composed. */
  taken: Nutrition;
  /** The meal being composed, if any. */
  meal?: Nutrition;
}

const LABEL: Record<Nutrient, string> = {
  kcal: 'kcal',
  protein: 'Protein',
  fat: 'Fat',
  carbs: 'Carbs',
};

/**
 * The day, one bar per nutrient, filled from the bottom with what was taken (faded), then the
 * meal being composed (bright). With a goal, the rest up to the goal line is what remains.
 * Without a goal the bar is the day's own total: it shows only how the total splits between
 * taken and this meal. The macro split is listed below.
 */
export function DayChart({ goals, taken, meal }: Props) {
  const split = macroSplit(meal ? addNutrition(taken, meal) : taken);

  return (
    <section class="chart" aria-label="Day chart">
      <div class="bars">
        {NUTRIENTS.map((n) => (
          <Bar key={n} nutrient={n} goal={goals?.[n]} taken={taken[n]} meal={meal?.[n]} />
        ))}
      </div>
      {split && (
        <p class="chart-line">
          P {formatNumber(split.protein, 0)}% · F {formatNumber(split.fat, 0)}% · C{' '}
          {formatNumber(split.carbs, 0)}% of energy
        </p>
      )}
    </section>
  );
}

function Bar({
  nutrient,
  goal,
  taken,
  meal,
}: {
  nutrient: Nutrient;
  goal: number | undefined;
  taken: NutrientAmount;
  meal: NutrientAmount | undefined;
}) {
  const mealValue = meal?.value ?? 0;
  const sum = taken.value + mealValue;
  // The bar's scale: the goal, or the total when it goes over; without a goal, the total.
  const scale = Math.max(goal ?? 0, sum);
  const pct = (v: number) => (scale > 0 ? `${(100 * v) / scale}%` : '0%');
  const missing = taken.missing + (meal?.missing ?? 0);
  const unit = nutrient === 'kcal' ? '' : ` ${NUTRIENT_UNIT[nutrient]}`;
  const value = (v: number) => formatNutrientValue(v, nutrient);
  const lowerBound = missing > 0 ? '≥ ' : '';
  const numbers = meal
    ? `${lowerBound}${value(taken.value)} + ${value(mealValue)}`
    : `${lowerBound}${value(taken.value)}`;
  const label =
    `${LABEL[nutrient]}: ${value(taken.value)}${unit} taken` +
    (meal ? `, ${value(mealValue)}${unit} this meal` : '') +
    (goal === undefined ? ', no goal' : `, goal ${value(goal)}${unit}`) +
    (missing > 0 ? ', some values unknown' : '');
  const classes = [
    'bar-column',
    `nutrient-${nutrient}`,
    goal === undefined ? 'no-goal' : '',
    goal !== undefined && sum > goal ? 'over' : '',
  ];

  return (
    <div class={classes.join(' ')}>
      <span class="bar-label">{LABEL[nutrient]}</span>
      <div class="bar-track" role="img" aria-label={label}>
        <div class="bar-taken" style={{ height: pct(taken.value) }} />
        <div class="bar-meal" style={{ bottom: pct(taken.value), height: pct(mealValue) }} />
        {goal !== undefined && <div class="bar-goal" style={{ bottom: pct(goal) }} />}
      </div>
      <span class="bar-numbers">{numbers}</span>
      <span class="bar-goal-text">
        {goal === undefined ? `${unit.trim() || 'kcal'} · no goal` : `/ ${value(goal)}${unit}`}
      </span>
    </div>
  );
}
