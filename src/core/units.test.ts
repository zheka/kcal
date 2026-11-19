import { describe, expect, it } from 'vitest';
import { isReservedProductUnitName, perGramFrom } from './units';

describe('product units', () => {
  it('may not be called g, ignoring case; ml is fine', () => {
    expect(isReservedProductUnitName('G')).toBe(true);
    expect(isReservedProductUnitName('ml')).toBe(false);
  });
});

describe('perGramFrom', () => {
  it('converts a per-100 g column exactly', () => {
    expect(perGramFrom({ kcal: 143, protein: 12.6, fat: 9.5, carbs: 0.7 }, 100)).toEqual({
      carbs: 0.007,
      fat: 0.095,
      kcal: 1.43,
      protein: 0.126,
    });
  });

  it('converts a per-serving column, rounded to 3 decimals', () => {
    // "per bar (45 g): 190 kcal, 9 g protein"
    expect(perGramFrom({ kcal: 190, protein: 9 }, 45)).toEqual({ kcal: 4.222, protein: 0.2 });
  });

  it('leaves zero values out: an omitted nutrient counts as 0', () => {
    expect(perGramFrom({ fat: 0, kcal: 2, water: 99 }, 100)).toEqual({ kcal: 0.02, water: 0.99 });
  });
});
