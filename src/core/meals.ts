import { mealsOn, type Nutrients } from './nutrition';
import { atLocalMinute, localDate, localMinute, localMinuteOf } from './time';
import type { Meal } from './types';

/**
 * When a new meal on `date` is consumed, by default, as a local minute: now when `date` is
 * today; otherwise one minute after that day's last meal, or 12:00 on a day without meals.
 */
export function defaultMealMinute(meals: readonly Meal[], date: string, now: Date): string {
  if (date === localDate(now)) return localMinute(now);
  const last = mealsOn(meals, date).at(-1);
  if (!last) return `${date}T12:00`;
  const [h, m] = localMinuteOf(last.consumedAt).slice(11).split(':').map(Number) as [
    number,
    number,
  ];
  const minutes = Math.min(h * 60 + m + 1, 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * The stored time of a meal set to a local minute. An edited meal keeps its seconds and
 * milliseconds; a new one takes them from now, so meals of the same minute keep the order they
 * were logged in. A new meal at the current minute gets the exact moment.
 */
export function consumedAtFor(local: string, existing: Meal | undefined, now: Date): string {
  return atLocalMinute(local, existing ? new Date(existing.consumedAt) : now);
}

/**
 * Shares of protein, fat and carbs in the energy they give (4, 9, 4 kcal per gram), in
 * percent; null when there are none.
 */
export function macroSplit(n: Nutrients): { protein: number; fat: number; carbs: number } | null {
  const protein = 4 * n.protein;
  const fat = 9 * n.fat;
  const carbs = 4 * n.carbs;
  const total = protein + fat + carbs;
  if (total <= 0) return null;
  return {
    protein: (100 * protein) / total,
    fat: (100 * fat) / total,
    carbs: (100 * carbs) / total,
  };
}
