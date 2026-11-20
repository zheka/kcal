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
 * Saves new daily targets now, effective from the start of today. Goals are only ever added: a
 * set saved earlier today stays, and simply no longer applies (the latest of a day wins), so
 * the newest decision wins even across time zones. Unchanged targets change nothing.
 */
export function saveGoals(goals: readonly GoalSet[], perDay: NutrientValues, now: Date): GoalSet[] {
  if (sameTargets(goalsOn(goals, localDate(now)) ?? {}, perDay)) return [...goals];
  const set: GoalSet = { setAt: now.toISOString() };
  if (Object.keys(perDay).length > 0) set.perDay = { ...perDay };
  return [...goals, set];
}

/** The goal sets that apply to some day, newest first: the last set of each local day. */
export function goalHistory(goals: readonly GoalSet[]): { from: string; set: GoalSet }[] {
  const byDay = new Map<string, GoalSet>();
  for (const set of goals) byDay.set(localDateOf(set.setAt), set);
  return [...byDay].map(([from, set]) => ({ from, set })).reverse();
}

function sameTargets(a: NutrientValues, b: NutrientValues): boolean {
  return NUTRIENTS.every((n) => a[n] === b[n]);
}
