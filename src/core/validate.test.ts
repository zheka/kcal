import { describe, expect, it } from 'vitest';
import { appData, coffee, egg, ing, makes, meal, milk, oatFlakes, recipe, water } from './testData';
import type { AppData } from './types';
import { validateAppData } from './validate';

const oats = recipe('oats', [ing(oatFlakes, 60), ing(milk, 1, 'u:cup')], [makes(1, 'bowl')]);
const valid = (): AppData =>
  appData({
    goals: [
      { perDay: { kcal: 2000, protein: 150, water: 2000 }, setAt: '2026-11-01T18:20:05.114Z' },
    ],
    products: [egg, oatFlakes, milk, coffee],
    recipes: [oats],
    meals: [
      meal('2026-11-17T07:30:41.512Z', [ing(oats, 1, 'u:bowl'), ing(egg, 2, 'u:piece')]),
      meal('2026-11-17T09:00:00.000Z', [ing(water, 330, 'ml'), ing(coffee, 1, 'u:mug')]),
    ],
  });

/** Problems of valid data after `change` (on a deep copy). */
function problemsAfter(change: (data: Record<string, unknown> & AppData) => void): string[] {
  const data = structuredClone(valid()) as Record<string, unknown> & AppData;
  change(data);
  return validateAppData(data);
}
const raw = (x: object) => x as Record<string, unknown>;

describe('validateAppData', () => {
  it('accepts valid data', () => {
    expect(validateAppData(valid())).toEqual([]);
    expect(validateAppData(appData())).toEqual([]);
  });

  it('requires the four lists', () => {
    expect(validateAppData({ products: {} })).toEqual([
      'goals: missing',
      'meals: missing',
      'products: must be a list',
      'recipes: missing',
    ]);
  });

  describe('products', () => {
    it('require nothing in perGram, but only known nutrients, non-negative, 3 decimals', () => {
      expect(problemsAfter((d) => (d.products[0]!.perGram = {}))).toEqual([]);
      expect(
        problemsAfter((d) => {
          d.products[0]!.perGram = { fat: -1, kcal: 1.4321 };
          raw(d.products[0]!.perGram).sugar = 1;
        }),
      ).toEqual([
        'product #1 "egg", perGram: fat must be a non-negative number',
        'product #1 "egg", perGram: kcal has more than 3 decimals',
        'product #1 "egg", perGram: unknown nutrient "sugar"',
      ]);
    });

    it('refuse unknown and missing fields', () => {
      expect(
        problemsAfter((d) => {
          raw(d.products[0]!).archived = false;
          delete raw(d.products[0]!).units;
        }),
      ).toEqual([
        'product #1 "egg": unknown field "archived"',
        'product #1 "egg": missing units',
        'product #1 "egg": units must be a list',
      ]);
    });

    it('need clean, unique names that are not a built-in food', () => {
      expect(problemsAfter((d) => (d.products[1]!.name = 'oat  flakes'))).toEqual([
        'product #2 "oat  flakes": name has extra spaces or is not in Unicode NFC form',
      ]);
      expect(problemsAfter((d) => (d.products[1]!.name = 'Egg'))).toEqual([
        'product #2 "Egg": name is also used by product #1 "egg"',
      ]);
      expect(problemsAfter((d) => (d.products[1]!.name = 'Water'))).toEqual([
        'product #2 "Water": "Water" is the name of a built-in food',
      ]);
    });

    it('check units: positive grams, unique names, g reserved, ml allowed', () => {
      expect(
        problemsAfter((d) => {
          d.products[0]!.units = [
            { grams: 60, id: 'u:a', name: 'piece' },
            { grams: 0, id: 'u:b', name: 'Piece' },
            { grams: 1, id: 'u:c', name: 'G' },
            { grams: 1.0001, id: 'u:d', name: 'ml' },
          ];
        }),
      ).toEqual([
        'product #1 "egg", unit #2: unit "Piece" is defined twice',
        'product #1 "egg", unit #2: grams must be a positive number',
        'product #1 "egg", unit #3: "G" is reserved: every product has grams',
        'product #1 "egg", unit #4: grams has more than 3 decimals',
      ]);
    });
  });

  describe('recipes', () => {
    it('need at least one ingredient and one unit, with positive makes', () => {
      expect(
        problemsAfter((d) => {
          d.recipes[0]!.ingredients = [];
          d.recipes[0]!.units = [];
        }),
      ).toEqual([
        'recipe #1 "oats": needs at least one unit: recipes are eaten only in their own units',
        'recipe #1 "oats": ingredients must be a non-empty list',
      ]);
      expect(problemsAfter((d) => (d.recipes[0]!.units[0]!.makes = 0))).toEqual([
        'recipe #1 "oats", unit #1: makes must be a positive number',
      ]);
    });

    it('may have a unit named g: grams of the finished dish', () => {
      expect(problemsAfter((d) => d.recipes[0]!.units.push(makes(410, 'g')))).toEqual([]);
    });

    it('refuse recipes that contain each other', () => {
      expect(
        problemsAfter((d) =>
          d.recipes.push(
            recipe('loop', [{ amount: 1, food: 'r:loop', unit: 'u:x' }], [makes(1, 'x')]),
          ),
        ),
      ).toEqual(['recipes contain each other: "loop" → "loop"']);
    });
  });

  describe('references', () => {
    it('need an existing food and one of its units; g only for products and built-ins', () => {
      expect(
        problemsAfter((d) => {
          d.meals[0]!.ingredients.push({ amount: 1, food: 'p:gone', unit: 'g' });
          d.meals[0]!.ingredients.push({ amount: 1, food: egg.id, unit: 'u:none' });
          d.meals[0]!.ingredients.push({ amount: 100, food: oats.id, unit: 'g' });
        }),
      ).toEqual([
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #3: refers to food p:gone, which does not exist',
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #4: "egg" has no unit "u:none"',
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #5: "oats" has no unit "g"',
      ]);
    });

    it('check the units of built-in foods', () => {
      expect(
        problemsAfter((d) => d.meals[1]!.ingredients.push(ing({ id: 'protein' }, 1, 'ml'))),
      ).toEqual(['meal #2 (2026-11-17T09:00:00.000Z), ingredient #3: "protein" has no unit "ml"']);
    });

    it('need ids unique across all records, and not a built-in id', () => {
      expect(problemsAfter((d) => (d.meals[0]!.id = egg.id))).toEqual([
        'meal #1: id p:egg is also used by product #1 "egg"',
      ]);
      expect(problemsAfter((d) => (d.products[0]!.units[0]!.id = oats.id))).toEqual([
        'recipe #1 "oats": id r:oats is also used by product #1 "egg", unit #1',
      ]);
      expect(problemsAfter((d) => (d.products[0]!.id = 'water'))).toEqual([
        'product #1 "egg": id "water" is a built-in food\'s',
      ]);
    });
  });

  describe('meals', () => {
    it('need a UTC timestamp, ingredients and positive amounts', () => {
      expect(
        problemsAfter((d) => {
          d.meals[0]!.consumedAt = '2026-11-17T08:30';
          d.meals[0]!.ingredients[1]!.amount = 0;
        }),
      ).toEqual([
        'meal #1: consumedAt must be a UTC timestamp like 2026-11-17T07:30:41.512Z',
        'meal #1, ingredient #2: amount must be a positive number',
      ]);
    });
  });

  describe('goals', () => {
    it('need increasing UTC timestamps and positive targets; perDay is optional', () => {
      expect(problemsAfter((d) => d.goals.push({ setAt: '2026-12-01T00:00:00.000Z' }))).toEqual([]);
      expect(
        problemsAfter((d) => {
          d.goals.push({ perDay: { kcal: 0 }, setAt: '2026-11-01T18:20:05.114Z' });
          d.goals.push({ setAt: '2026-12-01' });
        }),
      ).toEqual([
        "goal set #2: setAt 2026-11-01T18:20:05.114Z must be after the previous goal set's 2026-11-01T18:20:05.114Z",
        'goal set #2, perDay: kcal must be a positive number',
        'goal set #3: setAt must be a UTC timestamp like 2026-11-17T07:30:41.512Z',
      ]);
    });
  });
});
