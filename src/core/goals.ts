import type { GoalSet, NutrientValues } from './types';

/** The targets valid on `date`, or null before the first goals. Goals are ordered by `from`. */
export function goalsOn(goals: readonly GoalSet[], date: string): NutrientValues | null {
  let valid: NutrientValues | null = null;
  for (const set of goals) {
    if (set.from > date) break;
    valid = set.targets;
  }
  return valid;
}

/**
 * Saves new targets, effective from `today`. Earlier goals stay valid for the days before;
 * saving again on the same day replaces that day's goals. Unchanged targets change nothing.
 */
export function saveGoals(
  goals: readonly GoalSet[],
  targets: NutrientValues,
  today: string,
): GoalSet[] {
  const last = goals.at(-1);
  if (sameTargets(last?.targets ?? {}, targets)) return [...goals];
  const kept = last?.from === today ? goals.slice(0, -1) : goals;
  return [...kept, { from: today, targets: { ...targets } }];
}

function sameTargets(a: NutrientValues, b: NutrientValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof NutrientValues>;
  return [...keys].every((k) => a[k] === b[k]);
}
