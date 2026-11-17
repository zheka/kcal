import { describe, expect, it } from 'vitest';
import { isReservedUnitName, newUnitId, per100gFrom, toGrams, unitOptions } from './units';

describe('unitOptions', () => {
  it('offers g and kg first, then the food’s own units', () => {
    const options = unitOptions([{ id: 'u1', name: 'piece', grams: 60 }], null);
    expect(options.map((u) => u.name)).toEqual(['g', 'kg', 'piece']);
  });

  it('offers serving for a recipe with servings', () => {
    const options = unitOptions([{ id: 'u1', name: 'bowl', grams: 350 }], 400);
    expect(options.map((u) => [u.id, u.grams])).toEqual([
      ['g', 1],
      ['kg', 1000],
      ['serving', 400],
      ['u1', 350],
    ]);
  });
});

describe('toGrams', () => {
  const options = unitOptions([{ id: 'u1', name: 'piece', grams: 60 }], null);

  it('converts built-in and own units', () => {
    expect(toGrams(options, 'g', 150)).toBe(150);
    expect(toGrams(options, 'kg', 0.5)).toBe(500);
    expect(toGrams(options, 'u1', 2)).toBe(120);
  });

  it('is undefined for a unit the food does not have', () => {
    expect(toGrams(options, 'u2', 1)).toBeUndefined();
    expect(toGrams(options, 'serving', 1)).toBeUndefined();
  });
});

describe('reserved unit names', () => {
  it('reserves the mass units, and serving for recipes, ignoring case', () => {
    expect(isReservedUnitName('product', 'G')).toBe(true);
    expect(isReservedUnitName('product', 'kg')).toBe(true);
    expect(isReservedUnitName('product', 'serving')).toBe(false);
    expect(isReservedUnitName('recipe', 'Serving')).toBe(true);
    expect(isReservedUnitName('recipe', 'bowl')).toBe(false);
  });
});

describe('newUnitId', () => {
  it('never reuses an id the food has', () => {
    expect(newUnitId([])).toBe('u1');
    expect(newUnitId([{ id: 'u2', name: 'cup', grams: 250 }])).toBe('u3');
  });
});

describe('per100gFrom', () => {
  it('converts a label’s per-serving column to per 100 g', () => {
    // "per bar (45 g): 190 kcal, 9 g protein"
    const values = per100gFrom({ kcal: 190, protein: 9 }, 45);
    expect(values.kcal).toBeCloseTo(422.22, 2);
    expect(values.protein).toBe(20);
    expect('fat' in values).toBe(false);
  });

  it('converts per 100 ml using the product’s ml unit', () => {
    // milk: per 100 ml = 103 g
    expect(per100gFrom({ kcal: 66 }, 103).kcal).toBeCloseTo(64.08, 2);
  });
});
