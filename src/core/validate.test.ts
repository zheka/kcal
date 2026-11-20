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
    products: [egg, oatFlakes, milk, coffee, water],
    recipes: [oats],
    meals: [
      meal('2026-11-17T07:30:41.512Z', [ing(oats, 1, 'u:bowl'), ing(egg, 2, 'u:piece')]),
      meal('2026-11-17T09:00:00.000Z', [ing(water, 330, 'ml'), ing(coffee, 1, 'u:mug')]),
    ],
    settings: {
      quickButtons: [{ amount: 250, food: water.id, label: '💧', unit: 'ml' }, { label: '🍽️' }],
    },
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

  it('reads omitted lists and settings as empty', () => {
    expect(validateAppData({})).toEqual([]);
    expect(validateAppData({ products: {}, settings: [] })).toEqual([
      'products: must be a list',
      'settings: must be an object',
    ]);
  });

  describe('products', () => {
    it('need perG, perMl or both, each with known nutrients, non-negative, 3 decimals', () => {
      expect(problemsAfter((d) => (d.products[0]!.perMl = { kcal: 1.5 }))).toEqual([]);
      expect(problemsAfter((d) => (d.products[0]!.perG = { fat: 0 }))).toEqual([]);
      expect(problemsAfter((d) => delete d.products[1]!.perG)).toEqual([
        'product #2 "oat flakes": needs perG, perMl or both: the values per g or per ml',
      ]);
      expect(problemsAfter((d) => (d.products[1]!.perG = {}))).toEqual([
        'product #2 "oat flakes", perG: must have at least one nutrient',
      ]);
      expect(
        problemsAfter((d) => {
          d.products[0]!.perG = { fat: -1, kcal: 1.4321 };
          raw(d.products[0]!.perG).sugar = 1;
        }),
      ).toEqual([
        'product #1 "egg", perG: fat must be a non-negative number',
        'product #1 "egg", perG: kcal has more than 3 decimals',
        'product #1 "egg", perG: unknown nutrient "sugar"',
      ]);
    });

    it('refuse unknown and missing fields', () => {
      expect(
        problemsAfter((d) => {
          raw(d.products[0]!).archived = false;
          delete raw(d.products[0]!).name;
          delete raw(d.products[1]!).units; // omitted: none
        }),
      ).toEqual([
        'product #1: unknown field "archived"',
        'product #1: missing name',
        'product #1: name must be a non-empty text',
      ]);
    });

    it('need clean, unique names', () => {
      expect(problemsAfter((d) => (d.products[1]!.name = 'oat  flakes'))).toEqual([
        'product #2 "oat  flakes": name has extra spaces or is not in Unicode NFC form',
      ]);
      expect(problemsAfter((d) => (d.products[1]!.name = 'Egg'))).toEqual([
        'product #2 "Egg": name is also used by product #1 "egg"',
      ]);
    });

    it('check units: one positive g or ml, unique names, g and ml reserved', () => {
      expect(
        problemsAfter((d) => {
          raw(d.products[0]!).units = [
            { g: 60, id: 'u:a', name: 'piece' },
            { g: 0, id: 'u:b', name: 'Piece' },
            { g: 1, id: 'u:c', name: 'G' },
            { g: 1.0001, id: 'u:d', name: 'Ml' },
            { g: 1, id: 'u:e', ml: 1, name: 'both' },
            { id: 'u:f', name: 'neither' },
          ];
        }),
      ).toEqual([
        'product #1 "egg", unit #2: unit "Piece" is defined twice',
        'product #1 "egg", unit #2: g must be a positive number',
        'product #1 "egg", unit #3: "G" is reserved: g and ml are a product\'s bases',
        'product #1 "egg", unit #4: "Ml" is reserved: g and ml are a product\'s bases',
        'product #1 "egg", unit #4: g has more than 3 decimals',
        'product #1 "egg", unit #5: needs exactly one of g and ml: how many g or ml one of it is',
        'product #1 "egg", unit #6: needs exactly one of g and ml: how many g or ml one of it is',
      ]);
    });

    it('have units only in a base they have values for', () => {
      expect(
        problemsAfter((d) => d.products[0]!.units.push({ id: 'u:glass', ml: 200, name: 'glass' })),
      ).toEqual(['product #1 "egg", unit #2: is in ml, but the product has no perMl']);
    });
  });

  describe('barcodes', () => {
    it('are optional, 8 to 14 digits, and unique among products', () => {
      expect(problemsAfter((d) => (d.products[0]!.barcode = '4006040002093'))).toEqual([]);
      expect(problemsAfter((d) => (d.products[0]!.barcode = '12345'))).toEqual([
        'product #1 "egg": barcode must be 8 to 14 digits',
      ]);
      expect(
        problemsAfter((d) => {
          d.products[0]!.barcode = '4006040002093';
          d.products[1]!.barcode = '4006040002093';
        }),
      ).toEqual([
        'product #2 "oat flakes": barcode 4006040002093 is also used by product #1 "egg"',
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
    it('need an existing food and one of its units; g and ml only in a product’s bases', () => {
      expect(
        problemsAfter((d) => {
          d.meals[0]!.ingredients.push({ amount: 1, food: 'p:gone', unit: 'g' });
          d.meals[0]!.ingredients.push({ amount: 1, food: egg.id, unit: 'u:none' });
          d.meals[0]!.ingredients.push({ amount: 100, food: oats.id, unit: 'g' });
          d.meals[0]!.ingredients.push({ amount: 100, food: egg.id, unit: 'ml' });
          d.meals[0]!.ingredients.push({ amount: 100, food: coffee.id, unit: 'g' });
        }),
      ).toEqual([
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #3: refers to food p:gone, which does not exist',
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #4: "egg" has no unit "u:none"',
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #5: "oats" has no unit "g"',
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #6: "egg" has no unit "ml"',
        'meal #1 (2026-11-17T07:30:41.512Z), ingredient #7: "coffee" has no unit "g"',
      ]);
    });

    it('need ids unique across all records', () => {
      expect(problemsAfter((d) => (d.meals[0]!.id = egg.id))).toEqual([
        'meal #1: id p:egg is also used by product #1 "egg"',
      ]);
      expect(problemsAfter((d) => (d.products[0]!.units[0]!.id = oats.id))).toEqual([
        'recipe #1 "oats": id r:oats is also used by product #1 "egg", unit #1',
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

  describe('quick buttons', () => {
    it('need a clean label of at most 12 characters; an emoji counts as one', () => {
      expect(
        problemsAfter((d) => (d.settings.quickButtons[1]!.label = '👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽')),
      ).toEqual([]);
      expect(
        problemsAfter((d) => {
          d.settings.quickButtons[0]!.label = 'morning coffee';
          d.settings.quickButtons[1]!.label = ' x';
          d.settings.quickButtons.push({ label: '' });
        }),
      ).toEqual([
        'quick button #1: label must be at most 12 characters',
        'quick button #2: label has extra spaces or is not in Unicode NFC form',
        'quick button #3: label must be a non-empty text',
      ]);
    });

    it('have food, amount and unit together or none, referring like an ingredient', () => {
      expect(
        problemsAfter((d) => {
          raw(d.settings.quickButtons[1]!).amount = 1;
          d.settings.quickButtons.push({ amount: 1, food: egg.id, label: 'e', unit: 'ml' });
        }),
      ).toEqual(['quick button #2: needs food, amount and unit together, or none of them']);
      expect(
        problemsAfter((d) =>
          d.settings.quickButtons.push({ amount: 1, food: egg.id, label: 'e', unit: 'ml' }),
        ),
      ).toEqual(['quick button #3: "egg" has no unit "ml"']);
    });

    it('refuse unknown fields', () => {
      expect(problemsAfter((d) => (raw(d.settings).theme = 'dark'))).toEqual([
        'settings: unknown field "theme"',
      ]);
    });
  });
});
