import { NUTRIENTS } from '../config';
import { localDate, localDateOf } from './time';
import type { GoalSet, NutrientValues } from './types';

/**
 * The goal set that applies to a local date: the latest set saved on or before that day. A set
 * applies from the start of the local day containing its `setAt`. Undefined before the first.
 */
export function goalSetOn(goals: readonly GoalSet[], date: string): GoalSet | undefined {
  let applies: GoalSet | undefined;
  for (const set of goals) {
    if (localDateOf(set.setAt) > date) break;
    applies = set;
  }
  return applies;
}

/** The daily targets on a local date; null when there are none. */
export function goalsOn(goals: readonly GoalSet[], date: string): NutrientValues | null {
  const perDay = goalSetOn(goals, date)?.perDay;
  return perDay && Object.keys(perDay).length > 0 ? perDay : null;
}

/**
 * Saves new daily targets now, effective from the start of today. A set saved earlier today is
 * replaced (at most one per local day); unchanged targets change nothing.
 */
export function saveGoals(goals: readonly GoalSet[], perDay: NutrientValues, now: Date): GoalSet[] {
  const today = localDate(now);
  if (sameTargets(goalsOn(goals, today) ?? {}, perDay)) return [...goals];
  const last = goals.at(-1);
  const kept = last && localDateOf(last.setAt) === today ? goals.slice(0, -1) : goals;
  const set: GoalSet = { setAt: now.toISOString() };
  if (Object.keys(perDay).length > 0) set.perDay = { ...perDay };
  return [...kept, set];
}

function sameTargets(a: NutrientValues, b: NutrientValues): boolean {
  return NUTRIENTS.every((n) => a[n] === b[n]);
}
