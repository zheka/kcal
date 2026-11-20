import { describe, expect, it } from 'vitest';
import { canonical, canonicalJson } from './canonical';
import { appData, egg, ing, makes, meal, oatFlakes, recipe } from './testData';

describe('canonical order', () => {
  it('sorts goals, meals, products and recipes; keeps units and ingredients as they are', () => {
    const a = recipe(
      'b',
      [ing(egg, 1, 'u:piece'), ing(oatFlakes, 10)],
      [makes(2, 'z'), makes(1, 'a')],
    );
    const b = { ...recipe('a', [ing(egg, 1)], [makes(1)]), id: 'r:0' };
    const late = meal('2026-11-17T12:00:00.000Z', [ing(egg, 1)], 'm:1');
    const early = meal('2026-11-17T08:00:00.000Z', [ing(egg, 1)], 'm:2');
    const sameTime = meal('2026-11-17T08:00:00.000Z', [ing(egg, 1)], 'm:0');
    const data = canonical(
      appData({
        goals: [{ setAt: '2026-11-02T00:00:00.000Z' }, { setAt: '2026-11-01T00:00:00.000Z' }],
        meals: [late, early, sameTime],
        products: [oatFlakes, egg],
        recipes: [a, b],
      }),
    );
    expect(data.goals.map((g) => g.setAt)).toEqual([
      '2026-11-01T00:00:00.000Z',
      '2026-11-02T00:00:00.000Z',
    ]);
    expect(data.meals.map((m) => m.id)).toEqual(['m:0', 'm:2', 'm:1']);
    expect(data.products.map((p) => p.id)).toEqual(['p:egg', 'p:oat flakes']);
    expect(data.recipes.map((r) => r.id)).toEqual(['r:0', 'r:b']);
    expect(data.recipes[1]!.units.map((u) => u.name)).toEqual(['z', 'a']);
    expect(data.recipes[1]!.ingredients.map((i) => i.food)).toEqual(['p:egg', 'p:oat flakes']);
  });
});

describe('canonical JSON', () => {
  it('writes fields alphabetically at every level, with -0 as 0', () => {
    expect(canonicalJson({ b: 1, a: { z: -0, y: [{ d: 1, c: 2 }] } })).toBe(
      '{\n  "a": {\n    "y": [\n      {\n        "c": 2,\n        "d": 1\n      }\n    ],\n    "z": 0\n  },\n  "b": 1\n}\n',
    );
  });

  it('gives the same text for the same data in any order', () => {
    const one = appData({ products: [egg, oatFlakes] });
    const other = appData({
      products: [oatFlakes, { units: egg.units, perG: egg.perG!, name: egg.name, id: egg.id }],
    });
    expect(canonicalJson(canonical(one))).toBe(canonicalJson(canonical(other)));
  });
});
