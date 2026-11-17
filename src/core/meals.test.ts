import { describe, expect, it } from 'vitest';
import { defaultMealTime, macroSplit } from './meals';
import { buildFoodTable, ingredientsNutrition } from './nutrition';
import { egg, ing, meal } from './testData';

describe('defaultMealTime', () => {
  const now = new Date(2026, 10, 17, 19, 45);
  const meals = [meal('2026-11-16T13:10', []), meal('2026-11-16T08:30', [])];

  it('is now on today', () => {
    expect(defaultMealTime(meals, '2026-11-17', now)).toBe('2026-11-17T19:45');
  });

  it('is just after the last meal on another day', () => {
    expect(defaultMealTime(meals, '2026-11-16', now)).toBe('2026-11-16T13:11');
    expect(defaultMealTime([meal('2026-11-16T23:59', [])], '2026-11-16', now)).toBe(
      '2026-11-16T23:59',
    );
  });

  it('is noon on another day without meals', () => {
    expect(defaultMealTime(meals, '2026-11-18', now)).toBe('2026-11-18T12:00');
  });
});

describe('macroSplit', () => {
  it('gives the energy shares of protein, fat and carbs', () => {
    const n = ingredientsNutrition(buildFoodTable([egg], []), [ing(egg, 100)]);
    // 12.6 g protein (50.4), 9.5 g fat (85.5), 0.7 g carbs (2.8) = 138.7
    const split = macroSplit(n)!;
    expect(split.protein).toBeCloseTo(36.34, 1);
    expect(split.fat).toBeCloseTo(61.64, 1);
    expect(split.protein + split.fat + split.carbs).toBeCloseTo(100);
  });

  it('is null without macros', () => {
    expect(macroSplit(ingredientsNutrition(buildFoodTable([], []), []))).toBeNull();
  });
});
