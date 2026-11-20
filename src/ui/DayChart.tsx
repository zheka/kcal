import { NUTRIENT_LABEL, NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { formatNumber, formatNutrientValue } from '../core/format';
import { macroSplit } from '../core/meals';
import { addNutrients, type Nutrients } from '../core/nutrition';
import type { NutrientValues } from '../core/types';

interface Props {
  /** Targets valid on the day; null before the first goals. */
  goals: NutrientValues | null;
  /** Eaten that day, apart from the meal being composed. */
  taken: Nutrients;
  /** The meal being composed, if any. */
  meal?: Nutrients;
}

/**
 * The day, one bar per nutrient, filled from the bottom with what was taken (faded), then the
 * meal being composed (bright); with a goal, the rest up to the goal line is what remains.
 * Bars of the same unit share one scale, so equal amounts are equally high: 10 g of protein
 * and 10 g of fat. The macro split is listed below.
 */
export function DayChart({ goals, taken, meal }: Props) {
  const total = meal ? addNutrients(taken, meal) : taken;
  const split = macroSplit(total);
  const scales = chartScales(goals, total);

  return (
    // Taken is faded only next to a meal being composed; on its own, the day is shown bright.
    <section class={meal ? 'chart composing' : 'chart'} aria-label="Day chart">
      <div class="bars">
        {NUTRIENTS.map((n, i) => (
          <Bar
            key={n}
            nutrient={n}
            goal={goals?.[n]}
            taken={taken[n]}
            meal={meal?.[n]}
            scale={scales.get(NUTRIENT_UNIT[n]) ?? 0}
            // A gap where the unit, and so the scale, changes.
            newScale={i > 0 && NUTRIENT_UNIT[n] !== NUTRIENT_UNIT[NUTRIENTS[i - 1]!]}
          />
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

/**
 * The full height of the bars of each unit: the largest goal or total among the nutrients
 * measured in it.
 */
export function chartScales(goals: NutrientValues | null, total: Nutrients): Map<string, number> {
  const scales = new Map<string, number>();
  for (const n of NUTRIENTS) {
    const unit = NUTRIENT_UNIT[n];
    const highest = Math.max(goals?.[n] ?? 0, total[n]);
    scales.set(unit, Math.max(scales.get(unit) ?? 0, highest));
  }
  return scales;
}

function Bar({
  nutrient,
  goal,
  taken,
  meal,
  scale,
  newScale,
}: {
  nutrient: Nutrient;
  goal: number | undefined;
  taken: number;
  meal: number | undefined;
  /** The amount at the full height of the bar. */
  scale: number;
  newScale: boolean;
}) {
  const mealValue = meal ?? 0;
  const sum = taken + mealValue;
  const pct = (v: number) => (scale > 0 ? `${(100 * v) / scale}%` : '0%');
  const unit = nutrient === 'kcal' ? '' : ` ${NUTRIENT_UNIT[nutrient]}`;
  const value = (v: number) => formatNutrientValue(v, nutrient);
  const label =
    `${NUTRIENT_LABEL[nutrient]}: ${value(taken)}${unit} taken` +
    (meal === undefined ? '' : `, ${value(mealValue)}${unit} this meal`) +
    (goal === undefined ? ', no goal' : `, goal ${value(goal)}${unit}`);
  const classes = [
    'bar-column',
    `nutrient-${nutrient}`,
    goal === undefined ? 'no-goal' : '',
    newScale ? 'new-scale' : '',
    goal !== undefined && sum > goal ? 'over' : '',
  ];

  return (
    <div class={classes.join(' ')}>
      <span class="bar-label">{NUTRIENT_LABEL[nutrient]}</span>
      <div class="bar-track" role="img" aria-label={label}>
        <div class="bar-taken" style={{ height: pct(taken) }} />
        <div class="bar-meal" style={{ bottom: pct(taken), height: pct(mealValue) }} />
        {goal !== undefined && <div class="bar-goal" style={{ bottom: pct(goal) }} />}
      </div>
      <span class="bar-numbers">{value(taken)}</span>
      {meal !== undefined && <span class="bar-meal-value">+ {value(mealValue)}</span>}
      <span class="bar-goal-text">
        {goal === undefined ? `${unit.trim() || 'kcal'} · no goal` : `/ ${value(goal)}${unit}`}
      </span>
    </div>
  );
}
