import { describe, expect, it } from 'vitest';
import { usages } from './foods';
import { appData, egg, honey, ing, meal, oatFlakes, recipe } from './testData';

describe('usages', () => {
  it('counts the meals and recipes that use a food directly', () => {
    const oats = recipe('oats', [ing(oatFlakes, 60)]);
    const data = appData({
      products: [egg, oatFlakes, honey],
      recipes: [oats, recipe('oats with honey', [ing(oats, 200), ing(honey, 1, 'u1')])],
      meals: [
        meal('2026-11-17T08:00', [ing(oats, 200), ing(egg, 2, 'u1')]),
        meal('2026-11-17T13:00', [ing(egg, 1, 'u1')]),
      ],
    });
    expect(usages(data, egg.id)).toEqual({ meals: 2, recipes: 0 });
    expect(usages(data, oats.id)).toEqual({ meals: 1, recipes: 1 });
    expect(usages(data, oatFlakes.id)).toEqual({ meals: 0, recipes: 1 });
  });
});
