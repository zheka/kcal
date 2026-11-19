import { describe, expect, it } from 'vitest';
import { consumedAtFor, defaultMealMinute, macroSplit } from './meals';
import { buildFoodTable, ingredientsNutrients } from './nutrition';
import { egg, ing, meal } from './testData';

// Europe/Berlin: UTC+1 in November.
const now = new Date('2026-11-17T18:45:12.345Z'); // 19:45 local

describe('default meal time', () => {
  const meals = [meal('2026-11-16T12:10:00.000Z', []), meal('2026-11-16T07:30:00.000Z', [])];

  it('is now on today', () => {
    expect(defaultMealMinute(meals, '2026-11-17', now)).toBe('2026-11-17T19:45');
  });

  it('is a minute after the last meal on another day, or noon', () => {
    expect(defaultMealMinute(meals, '2026-11-16', now)).toBe('2026-11-16T13:11');
    expect(defaultMealMinute(meals, '2026-11-18', now)).toBe('2026-11-18T12:00');
  });
});

describe('consumedAt', () => {
  it('of a new meal takes the seconds of now', () => {
    expect(consumedAtFor('2026-11-17T19:45', undefined, now)).toBe('2026-11-17T18:45:12.345Z');
    expect(consumedAtFor('2026-11-16T08:00', undefined, now)).toBe('2026-11-16T07:00:12.345Z');
  });

  it('of an edited meal keeps its own seconds', () => {
    const edited = meal('2026-11-17T07:30:41.512Z', []);
    expect(consumedAtFor('2026-11-17T09:00', edited, now)).toBe('2026-11-17T08:00:41.512Z');
  });
});

describe('macroSplit', () => {
  it('gives the energy shares of protein, fat and carbs', () => {
    const n = ingredientsNutrients(buildFoodTable([egg], []), [ing(egg, 100)]);
    const split = macroSplit(n)!;
    expect(split.protein).toBeCloseTo(36.34, 1);
    expect(split.protein + split.fat + split.carbs).toBeCloseTo(100);
  });

  it('is null without macros', () => {
    expect(macroSplit(ingredientsNutrients(buildFoodTable([], []), []))).toBeNull();
  });
});
