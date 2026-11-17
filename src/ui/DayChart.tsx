import { NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { formatAmount, formatNumber, formatNutrientValue } from '../core/format';
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
 * The day against its goals: one bar per nutrient with a goal, filled from the bottom with what
 * was taken (faded), then the meal being composed (bright); the rest up to the goal line is
 * what remains. Nutrients without a goal are listed as amounts, with the macro split.
 */
export function DayChart({ goals, taken, meal }: Props) {
  const withGoal = NUTRIENTS.filter((n) => goals?.[n] !== undefined);
  const without = NUTRIENTS.filter((n) => goals?.[n] === undefined);
  const total = meal ? addNutrition(taken, meal) : taken;
  const split = macroSplit(total);

  return (
    <section class="chart" aria-label="Day chart">
      {withGoal.length > 0 && (
        <div class="bars">
          {withGoal.map((n) => (
            <Bar key={n} nutrient={n} goal={goals![n]!} taken={taken[n]} meal={meal?.[n]} />
          ))}
        </div>
      )}
      <p class="chart-line">
        {without.map((n) => (
          <span key={n}>
            {LABEL[n]} {formatAmount(total[n], n)}
            {n !== 'kcal' && ` ${NUTRIENT_UNIT[n]}`}
          </span>
        ))}
        {split && (
          <span>
            P {formatNumber(split.protein, 0)}% · F {formatNumber(split.fat, 0)}% · C{' '}
            {formatNumber(split.carbs, 0)}%
          </span>
        )}
      </p>
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
  goal: number;
  taken: NutrientAmount;
  meal: NutrientAmount | undefined;
}) {
  const mealValue = meal?.value ?? 0;
  const sum = taken.value + mealValue;
  // The bar's scale: the goal, or the total when it goes over.
  const scale = Math.max(goal, sum);
  const pct = (v: number) => `${(100 * v) / scale}%`;
  const missing = taken.missing + (meal?.missing ?? 0);
  const unit = nutrient === 'kcal' ? '' : ` ${NUTRIENT_UNIT[nutrient]}`;
  const value = (v: number) => formatNutrientValue(v, nutrient);
  const numbers = meal
    ? `${value(taken.value)} + ${value(mealValue)}`
    : `${missing > 0 ? '≥ ' : ''}${value(taken.value)}`;
  const label =
    `${LABEL[nutrient]}: ${value(taken.value)}${unit} taken` +
    (meal ? `, ${value(mealValue)}${unit} this meal` : '') +
    `, goal ${value(goal)}${unit}` +
    (missing > 0 ? ', some values unknown' : '');

  return (
    <div class={`bar-column nutrient-${nutrient} ${sum > goal ? 'over' : ''}`}>
      <span class="bar-label">{LABEL[nutrient]}</span>
      <div class="bar" role="img" aria-label={label}>
        <div class="bar-taken" style={{ height: pct(taken.value) }} />
        <div class="bar-meal" style={{ bottom: pct(taken.value), height: pct(mealValue) }} />
        <div class="bar-goal" style={{ bottom: pct(goal) }} />
      </div>
      <span class="bar-numbers">
        {meal && missing > 0 ? '≥ ' : ''}
        {numbers}
      </span>
      <span class="bar-goal-text">
        / {value(goal)}
        {unit}
      </span>
    </div>
  );
}
