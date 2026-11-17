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
import { appData, egg, honey, ing, meal, oatFlakes, product, recipe } from './testData';

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

describe('picking a food', () => {
  const oats = recipe('oats', [ing(oatFlakes, 60)], { servings: 1 });
  const data = appData({
    products: [egg, oatFlakes, honey],
    recipes: [oats],
    meals: [
      meal('2026-11-17T08:00', [ing(egg, 3, 'u1')]),
      meal('2026-11-16T08:00', [ing(egg, 2, 'u1'), ing(honey, 2, 'u1')]),
    ],
  });
  const table = buildFoodTable(data.products, data.recipes);
  const food = (id: string) => table.get(id)!;

  it('repeats the most recent use', () => {
    expect(pickIngredient(data, food(egg.id))).toEqual({ food: egg.id, unit: 'u1', amount: 3 });
    expect(pickIngredient(data, food(oatFlakes.id))).toEqual(ing(oatFlakes, 60));
  });

  it('defaults to a serving, then the food’s own unit, then 100 g', () => {
    expect(pickIngredient(data, food(oats.id))).toEqual(ing(oats, 1, 'serving'));
    const fresh = appData({ products: data.products });
    expect(pickIngredient(fresh, food(egg.id))).toEqual(ing(egg, 1, 'u1'));
    expect(pickIngredient(fresh, food(oatFlakes.id))).toEqual(ing(oatFlakes, 100, 'g'));
  });

  it('orders chips by recency, then by name, without archived foods', () => {
    const archived = { ...product('aaa', { kcal: 1 }), archived: true };
    const withArchived = { ...data, products: [...data.products, archived] };
    const t = buildFoodTable(withArchived.products, withArchived.recipes);
    expect(foodsByRecency(withArchived, t).map((f) => f.name)).toEqual([
      'egg',
      'honey',
      'oat flakes',
      'oats',
    ]);
  });

  it('matches typed text: starting with it first, then containing it', () => {
    const foods = foodsByRecency(data, table);
    expect(matchFoods(foods, 'OAT').map((f) => f.name)).toEqual(['oat flakes', 'oats']);
    expect(matchFoods(foods, 'ats').map((f) => f.name)).toEqual(['oats']);
    expect(matchFoods(foods, ' ')).toHaveLength(4);
  });

  it('counts uses of a unit', () => {
    expect(unitUsages(data, egg.id, 'u1')).toBe(2);
    expect(unitUsages(data, egg.id, 'g')).toBe(0);
  });
});

describe('recipesContaining', () => {
  it('finds the recipes that contain a recipe, directly or not', () => {
    const plain = recipe('plain', [ing(oatFlakes, 60)]);
    const sweet = recipe('sweet', [ing(plain, 100)]);
    const sweeter = recipe('sweeter', [ing(sweet, 100)]);
    const other = recipe('other', [ing(egg, 1, 'u1')]);
    const all = [sweeter, other, sweet, plain];
    expect(recipesContaining(all, plain.id)).toEqual(new Set([plain.id, sweet.id, sweeter.id]));
    expect(recipesContaining(all, sweeter.id)).toEqual(new Set([sweeter.id]));
  });
});
