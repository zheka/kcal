import { describe, expect, it } from 'vitest';
import {
  foodsByRecency,
  matchFoods,
  pickIngredient,
  recipesContaining,
  unitUsages,
  usages,
} from './foods';
import { buildFoodTable } from './nutrition';
import {
  appData,
  coffee,
  egg,
  honey,
  ing,
  makes,
  meal,
  oatFlakes,
  recipe,
  water,
} from './testData';

const oats = recipe('oats', [ing(oatFlakes, 60)], [makes(1, 'bowl')]);
const data = appData({
  products: [egg, oatFlakes, honey, water, coffee],
  recipes: [
    oats,
    recipe('oats with honey', [ing(oats, 1, 'u:bowl'), ing(honey, 1, 'u:tsp')], [makes(1)]),
  ],
  meals: [
    meal('2026-11-17T07:00:00.000Z', [ing(egg, 3, 'u:piece'), ing(water, 330, 'ml')]),
    meal('2026-11-16T07:00:00.000Z', [ing(egg, 2, 'u:piece'), ing(honey, 2, 'u:tsp')]),
  ],
  settings: {
    ai: {},
    quickButtons: [{ amount: 250, food: water.id, label: '💧', unit: 'ml' }, { label: '🍽️' }],
  },
});
const table = buildFoodTable(data.products, data.recipes);
const food = (id: string) => table.get(id)!;

describe('usages', () => {
  it('counts the meals, recipes and quick buttons that use a food, and uses of a unit', () => {
    expect(usages(data, egg.id)).toEqual({ meals: 2, recipes: 0, quickButtons: 0 });
    expect(usages(data, oats.id)).toEqual({ meals: 0, recipes: 1, quickButtons: 0 });
    expect(usages(data, water.id)).toEqual({ meals: 1, recipes: 0, quickButtons: 1 });
    expect(unitUsages(data, egg.id, 'u:piece')).toBe(2);
    expect(unitUsages(data, honey.id, 'u:tsp')).toBe(2);
    expect(unitUsages(data, water.id, 'ml')).toBe(2);
    expect(unitUsages(data, water.id, 'g')).toBe(0);
  });
});

describe('picking a food', () => {
  it('repeats the most recent use', () => {
    expect(pickIngredient(data, food(egg.id))).toEqual(ing(egg, 3, 'u:piece'));
    expect(pickIngredient(data, food(water.id))).toEqual(ing(water, 330, 'ml'));
    expect(pickIngredient(data, food(oatFlakes.id))).toEqual(ing(oatFlakes, 60));
  });

  it('defaults to 1 of the first own unit, else 100 of the first base', () => {
    const fresh = appData({ products: data.products, recipes: data.recipes });
    expect(pickIngredient(fresh, food(egg.id))).toEqual(ing(egg, 1, 'u:piece'));
    expect(pickIngredient(fresh, food(oats.id))).toEqual(ing(oats, 1, 'u:bowl'));
    expect(pickIngredient(appData(), food(oatFlakes.id))).toEqual(ing(oatFlakes, 100));
    expect(pickIngredient(fresh, food(water.id))).toEqual(ing(water, 100));
    expect(pickIngredient(fresh, food(coffee.id))).toEqual(ing(coffee, 1, 'u:mug'));
  });

  it('offers recent foods first, then the rest by name', () => {
    expect(foodsByRecency(data, table).map((f) => f.name)).toEqual([
      'egg',
      'water',
      'honey',
      'coffee',
      'oat flakes',
      'oats',
      'oats with honey',
    ]);
  });

  it('matches typed text: starting with it first, then containing it', () => {
    const foods = foodsByRecency(data, table);
    expect(matchFoods(foods, 'OAT').map((f) => f.name)).toEqual([
      'oat flakes',
      'oats',
      'oats with honey',
    ]);
    expect(matchFoods(foods, 'ney').map((f) => f.name)).toEqual(['honey', 'oats with honey']);
  });
});

describe('recipesContaining', () => {
  it('finds the recipes that contain a recipe, directly or not', () => {
    const sweet = recipe('sweet', [ing(oats, 1, 'u:bowl')], [makes(1)]);
    const sweeter = recipe('sweeter', [ing(sweet, 1, 'u:serving')], [makes(1)]);
    expect(recipesContaining([sweeter, sweet, oats], oats.id)).toEqual(
      new Set([oats.id, sweet.id, sweeter.id]),
    );
  });
});
