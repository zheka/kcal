import type { Nutrition } from './nutrition';
import { mealsOn } from './nutrition';
import { localDate, localDateTime } from './time';
import type { Meal } from './types';

/**
 * When a new meal on `date` is eaten, by default: now when `date` is today; otherwise just
 * after that day's last meal, or 12:00 on a day without meals.
 */
export function defaultMealTime(meals: readonly Meal[], date: string, now: Date): string {
  if (date === localDate(now)) return localDateTime(now);
  const last = mealsOn(meals, date).at(-1);
  if (!last) return `${date}T12:00`;
  const [h, m] = last.eatenAt.slice(11).split(':').map(Number) as [number, number];
  const minutes = Math.min(h * 60 + m + 1, 23 * 60 + 59);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * Shares of protein, fat and carbs in the energy they give (4, 9, 4 kcal per gram), in
 * percent; null when there are none.
 */
export function macroSplit(n: Nutrition): { protein: number; fat: number; carbs: number } | null {
  const protein = 4 * n.protein.value;
  const fat = 9 * n.fat.value;
  const carbs = 4 * n.carbs.value;
  const total = protein + fat + carbs;
  if (total <= 0) return null;
  return {
    protein: (100 * protein) / total,
    fat: (100 * fat) / total,
    carbs: (100 * carbs) / total,
  };
}
