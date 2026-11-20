import { describe, expect, it } from 'vitest';
import { isReservedProductUnitName, perOneFrom } from './units';

describe('product units', () => {
  it('may not be called g or ml, ignoring case', () => {
    expect(isReservedProductUnitName('G')).toBe(true);
    expect(isReservedProductUnitName('ML')).toBe(true);
    expect(isReservedProductUnitName('cup')).toBe(false);
  });
});

describe('perOneFrom', () => {
  it('converts a per-100 g or per-100 ml column exactly', () => {
    expect(perOneFrom({ kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7 }, 100)).toEqual({
      carbs: 0.007,
      fat: 0.095,
      kcal: 1.43,
      protein: 0.126,
    });
  });

  it('converts a per-serving column, rounded to 3 decimals', () => {
    // "per bar (45 g): 190 kcal, 9 g protein"
    expect(perOneFrom({ kcal: 190, protein: 9 }, 45)).toEqual({ kcal: 4.222, protein: 0.2 });
  });

  it('keeps every given value, 0 included; values not given stay out', () => {
    expect(perOneFrom({ fat: 0, kcal: 2, water: 99 }, 100)).toEqual({
      fat: 0,
      kcal: 0.02,
      water: 0.99,
    });
    // 0.02 g of fat per 100 g rounds to 0: stored as 0, not dropped
    expect(perOneFrom({ fat: 0.02 }, 100)).toEqual({ fat: 0 });
    expect(Object.is(perOneFrom({ fat: 0 }, 100).fat, -0)).toBe(false);
  });
});
