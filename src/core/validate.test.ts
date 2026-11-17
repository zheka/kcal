import { describe, expect, it } from 'vitest';
import { appData, egg, honey, ing, meal, milk, oatFlakes, recipe } from './testData';
import type { AppData } from './types';
import { validateAppData } from './validate';

const oats = recipe('oats', [ing(oatFlakes, 60), ing(milk, 200, 'u1')], { servings: 1 });
const valid = (): AppData =>
  appData({
    goals: [{ from: '2026-11-01', targets: { kcal: 2000, protein: 150 } }],
    products: [egg, oatFlakes, milk, honey],
    recipes: [oats],
    meals: [meal('2026-11-17T08:30', [ing(oats, 1, 'serving'), ing(egg, 2, 'u1')])],
  });

/** Problems of valid data after `change` (on a deep copy). */
function problemsAfter(change: (data: Record<string, unknown> & AppData) => void): string[] {
  const data = structuredClone(valid()) as Record<string, unknown> & AppData;
  change(data);
  return validateAppData(data);
}

describe('validateAppData', () => {
  it('accepts valid data', () => {
    expect(validateAppData(valid() as never)).toEqual([]);
    expect(validateAppData(appData() as never)).toEqual([]);
  });

  it('requires the four lists', () => {
    expect(validateAppData({ products: {} })).toEqual([
      'goals: missing',
      'products: must be a list',
      'recipes: missing',
      'meals: missing',
    ]);
  });

  describe('products', () => {
    it('requires kcal; other nutrients may be unknown', () => {
      expect(problemsAfter((d) => delete d.products[0]!.per100g.kcal)).toEqual([
        'product #1 "egg", per100g: missing kcal',
      ]);
      expect(problemsAfter((d) => (d.products[0]!.per100g = { kcal: 143 }))).toEqual([]);
    });

    it('refuses negative, non-number and unknown nutrients', () => {
      expect(
        problemsAfter((d) => {
          d.products[0]!.per100g.fat = -1;
          (d.products[0]!.per100g as Record<string, unknown>).protein = '12';
          (d.products[0]!.per100g as Record<string, unknown>).sugar = 1;
        }),
      ).toEqual([
        'product #1 "egg", per100g: protein must be a non-negative number',
        'product #1 "egg", per100g: fat must be a non-negative number',
        'product #1 "egg", per100g: unknown nutrient "sugar"',
      ]);
    });

    it('refuses unknown and missing fields', () => {
      expect(
        problemsAfter((d) => {
          (d.products[0] as unknown as Record<string, unknown>).brand = 'x';
          delete (d.products[0] as Partial<typeof egg>).archived;
        }),
      ).toEqual([
        'product #1 "egg": unknown field "brand"',
        'product #1 "egg": missing archived',
        'product #1 "egg": archived must be true or false',
      ]);
    });

    it('requires clean, unique names (ignoring case) across products and recipes', () => {
      expect(problemsAfter((d) => (d.products[1]!.name = 'oat  flakes'))).toEqual([
        'product #2 "oat  flakes": name has extra spaces or is not in Unicode NFC form',
      ]);
      expect(problemsAfter((d) => (d.products[1]!.name = 'Egg'))).toEqual([
        'product #2 "Egg": name is also used by product #1 "egg"',
      ]);
      expect(problemsAfter((d) => (d.recipes[0]!.name = 'milk'))).toEqual([
        'recipe #1 "milk": name is also used by product #3 "milk"',
      ]);
    });

    it('checks units: unique ids and names, not built-in, positive grams', () => {
      expect(
        problemsAfter((d) => {
          d.products[0]!.units = [
            { id: 'u1', name: 'piece', grams: 60 },
            { id: 'u1', name: 'Piece', grams: 0 },
            { id: 'g', name: 'KG', grams: 1 },
          ];
        }),
      ).toEqual([
        'product #1 "egg", unit #2: id "u1" is used twice',
        'product #1 "egg", unit #2: unit "Piece" is defined twice',
        'product #1 "egg", unit #2: grams must be a positive number',
        'product #1 "egg", unit #3: id "g" is a built-in unit',
        'product #1 "egg", unit #3: "KG" is a built-in unit',
      ]);
    });

    it('lets a product have its own serving unit (from its label)', () => {
      expect(
        problemsAfter((d) => d.products[0]!.units.push({ id: 'u2', name: 'serving', grams: 30 })),
      ).toEqual([]);
    });
  });

  describe('recipes', () => {
    it('reserves serving as a unit name of recipes', () => {
      expect(
        problemsAfter((d) => (d.recipes[0]!.units = [{ id: 'u1', name: 'Serving', grams: 300 }])),
      ).toEqual(['recipe #1 "oats", unit #1: "Serving" is a built-in unit']);
    });

    it('needs ingredients, and positive cooked weight and servings when given', () => {
      expect(
        problemsAfter((d) => {
          d.recipes[0]!.ingredients = [];
          d.recipes[0]!.cookedGrams = 0;
          (d.recipes[0] as unknown as Record<string, unknown>).servings = '2';
        }),
      ).toEqual([
        'recipe #1 "oats": ingredients must be a non-empty list',
        'recipe #1 "oats": cookedGrams must be a positive number or null',
        'recipe #1 "oats": servings must be a positive number or null',
      ]);
    });

    it('refuses recipes that contain each other', () => {
      expect(
        problemsAfter((d) =>
          d.recipes.push(recipe('loop', [{ food: 'r:loop', unit: 'g', amount: 1 }])),
        ),
      ).toEqual(['recipes contain each other: "loop" → "loop"']);
    });

    it('refuses a recipe that weighs nothing', () => {
      expect(problemsAfter((d) => d.recipes.push(recipe('nothing', [ing(oatFlakes, 0)])))).toEqual([
        'recipe "nothing" weighs nothing: its total weight is 0 g',
      ]);
    });
  });

  describe('references', () => {
    it('requires every ingredient to refer to an existing food and one of its units', () => {
      expect(
        problemsAfter((d) => {
          d.meals[0]!.ingredients.push({ food: 'p:gone', unit: 'g', amount: 1 });
          d.meals[0]!.ingredients.push({ food: egg.id, unit: 'u7', amount: 1 });
          d.recipes[0]!.ingredients.push({ food: egg.id, unit: 'serving', amount: 1 });
          d.meals[0]!.ingredients.push({ food: egg.id, unit: 'G', amount: 1 });
        }),
      ).toEqual([
        'recipe #1 "oats", ingredient #3: "egg" has no unit "serving"',
        'meal #1 (2026-11-17T08:30), ingredient #3: refers to food p:gone, which does not exist',
        'meal #1 (2026-11-17T08:30), ingredient #4: "egg" has no unit "u7"',
        'meal #1 (2026-11-17T08:30), ingredient #5: "egg" has no unit "G"',
      ]);
    });

    it('offers serving only on recipes that have servings', () => {
      expect(problemsAfter((d) => (d.recipes[0]!.servings = null))).toEqual([
        'meal #1 (2026-11-17T08:30), ingredient #1: "oats" has no unit "serving"',
      ]);
    });

    it('requires unique ids across products, recipes and meals', () => {
      expect(problemsAfter((d) => (d.meals[0]!.id = egg.id))).toEqual([
        'meal #1: id p:egg is also used by product #1 "egg"',
      ]);
    });
  });

  describe('meals', () => {
    it('needs a valid local date-time, ingredients, and non-negative amounts', () => {
      expect(
        problemsAfter((d) => {
          d.meals[0]!.eatenAt = '2026-11-17T08:30:00.000Z';
          d.meals[0]!.ingredients[1]!.amount = -2;
        }),
      ).toEqual([
        'meal #1: eatenAt must be a local date and time: YYYY-MM-DDTHH:mm',
        'meal #1 (2026-11-17T08:30:00.000Z), ingredient #2: amount must be a non-negative number',
      ]);
      expect(problemsAfter((d) => (d.meals[0]!.ingredients = []))).toEqual([
        'meal #1 (2026-11-17T08:30): ingredients must be a non-empty list',
      ]);
    });
  });

  describe('goals', () => {
    it('needs valid, increasing dates and positive targets', () => {
      expect(
        problemsAfter((d) => {
          d.goals.push({ from: '2026-11-01', targets: { kcal: 0 } });
          d.goals.push({ from: '2026-02-30', targets: {} });
        }),
      ).toEqual([
        "goal set #2: from 2026-11-01 must be after the previous goal set's 2026-11-01",
        'goal set #2, targets: kcal must be a positive number',
        'goal set #3: from must be a date: YYYY-MM-DD',
      ]);
    });
  });
});
