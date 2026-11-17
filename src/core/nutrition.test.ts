import { describe, expect, it } from 'vitest';
import {
  buildFoodTable,
  dayNutrition,
  FoodTableError,
  ingredientGrams,
  ingredientNutrition,
  ingredientsNutrition,
  mealsOn,
} from './nutrition';
import { egg, honey, ing, meal, milk, oatFlakes, product, recipe, water } from './testData';

const products = [egg, oatFlakes, milk, honey, water];

describe('products', () => {
  const table = buildFoodTable(products, []);

  it('gives nutrients for any amount in any of the product’s units', () => {
    const twoEggs = ingredientNutrition(table, ing(egg, 2, 'u1'));
    expect(twoEggs.kcal.value).toBeCloseTo(171.6);
    expect(twoEggs.protein.value).toBeCloseTo(15.12);
    expect(ingredientNutrition(table, ing(oatFlakes, 0.06, 'kg')).kcal.value).toBeCloseTo(222);
  });

  it('marks an unknown nutrient as missing, never as 0 silently', () => {
    const tsp = ingredientNutrition(table, ing(honey, 1, 'u1'));
    expect(tsp.protein).toEqual({ value: 0, missing: 1 });
    expect(tsp.kcal.missing).toBe(0);
  });

  it('counts nothing for an amount of 0, unknowns included', () => {
    expect(ingredientNutrition(table, ing(honey, 0)).protein).toEqual({ value: 0, missing: 0 });
  });
});

describe('recipes', () => {
  // 60 g oat flakes + 200 ml milk + 1 tsp honey
  const oats = recipe('oats', [ing(oatFlakes, 60), ing(milk, 200, 'u1'), ing(honey, 1, 'u1')], {
    servings: 1,
  });
  const oatsGrams = 60 + 206 + 7;
  const oatsKcal = 222 + 206 * 0.64 + 7 * 3.04;

  it('weighs the sum of its ingredients and gets its nutrients from them', () => {
    const table = buildFoodTable(products, [oats]);
    const entry = table.get(oats.id)!;
    expect(entry.totalGrams).toBeCloseTo(oatsGrams);
    expect(ingredientNutrition(table, ing(oats, oatsGrams)).kcal.value).toBeCloseTo(oatsKcal);
  });

  it('has a serving unit when it says how many servings it makes', () => {
    const table = buildFoodTable(products, [oats]);
    expect(ingredientGrams(table, ing(oats, 1, 'serving'))).toBeCloseTo(oatsGrams);
    const fourServings = recipe('soup', [ing(water, 1000)], { servings: 4 });
    const soup = buildFoodTable(products, [fourServings]);
    expect(ingredientGrams(soup, ing(fourServings, 1, 'serving'))).toBe(250);
  });

  it('uses the weighed cooked weight when it is given', () => {
    // A pot of 1 kg oat flakes + 2 kg water that weighs 2.5 kg once cooked.
    const pot = recipe('porridge', [ing(oatFlakes, 1, 'kg'), ing(water, 2000)], {
      cookedGrams: 2500,
    });
    const table = buildFoodTable(products, [pot]);
    expect(ingredientNutrition(table, ing(pot, 250)).kcal.value).toBeCloseTo(370);
    expect(ingredientNutrition(table, ing(pot, 2500)).kcal.value).toBeCloseTo(3700);
  });

  it('can contain recipes, all the way down, in any order', () => {
    const plain = recipe('plain oats', [ing(oatFlakes, 60), ing(water, 240)]);
    const withHoney = recipe('oats with honey', [ing(plain, 300), ing(honey, 2, 'u1')]);
    const table = buildFoodTable(products, [withHoney, plain]);
    const bowl = ingredientNutrition(table, ing(withHoney, 314));
    expect(bowl.kcal.value).toBeCloseTo(222 + 14 * 3.04);
    // Honey has no protein value: the bowl's protein is known only as "at least".
    expect(bowl.protein.value).toBeCloseTo(7.8);
    expect(bowl.protein.missing).toBe(1);
  });

  it('follows edits of its ingredients: everything is live', () => {
    const plain = recipe('plain oats', [ing(oatFlakes, 60), ing(water, 240)]);
    const fixed = { ...oatFlakes, per100g: { ...oatFlakes.per100g, kcal: 380 } };
    const table = buildFoodTable([fixed, water], [plain]);
    expect(ingredientNutrition(table, ing(plain, 300)).kcal.value).toBeCloseTo(228);
  });

  it('refuses recipes that contain each other', () => {
    const a = recipe('a', [{ food: 'r:b', unit: 'g', amount: 10 }]);
    const b = recipe('b', [ing(a, 10)]);
    expect(() => buildFoodTable(products, [a, b])).toThrow(FoodTableError);
    expect(() => buildFoodTable(products, [a, b])).toThrow('"a" → "b" → "a"');
    const self = recipe('self', [{ food: 'r:self', unit: 'g', amount: 1 }]);
    expect(() => buildFoodTable(products, [self])).toThrow('"self" → "self"');
  });

  it('refuses a recipe that weighs nothing', () => {
    const empty = recipe('nothing', [ing(water, 0)]);
    expect(() => buildFoodTable(products, [empty])).toThrow('weighs nothing');
  });

  it('refuses unknown foods and units', () => {
    const unknownFood = recipe('x', [{ food: 'p:none', unit: 'g', amount: 1 }]);
    expect(() => buildFoodTable(products, [unknownFood])).toThrow('unknown food p:none');
    const unknownUnit = recipe('y', [ing(egg, 1, 'u9')]);
    expect(() => buildFoodTable(products, [unknownUnit])).toThrow('"egg" has no unit u9');
  });
});

describe('meals and days', () => {
  const table = buildFoodTable(products, []);
  const breakfast = meal('2026-11-17T08:30', [ing(egg, 2, 'u1'), ing(honey, 1, 'u1')]);
  const lunch = meal('2026-11-17T13:00', [ing(oatFlakes, 100)]);
  const late = meal('2026-11-17T23:59', [ing(egg, 1, 'u1')]);
  const nextDay = meal('2026-11-18T00:00', [ing(egg, 1, 'u1')]);
  const meals = [late, nextDay, lunch, breakfast];

  it('sums a meal’s ingredients', () => {
    const n = ingredientsNutrition(table, breakfast.ingredients);
    expect(n.kcal.value).toBeCloseTo(171.6 + 21.28);
    expect(n.protein).toEqual({ value: expect.closeTo(15.12), missing: 1 });
  });

  it('lists a day’s meals by time; the date of eatenAt decides the day', () => {
    expect(mealsOn(meals, '2026-11-17')).toEqual([breakfast, lunch, late]);
    expect(mealsOn(meals, '2026-11-18')).toEqual([nextDay]);
    expect(mealsOn(meals, '2026-11-19')).toEqual([]);
  });

  it('sums a day’s meals', () => {
    const day = dayNutrition(table, meals, '2026-11-17');
    expect(day.kcal.value).toBeCloseTo(171.6 + 21.28 + 370 + 85.8);
    expect(day.protein.missing).toBe(1);
    expect(dayNutrition(table, meals, '2026-11-19').kcal).toEqual({ value: 0, missing: 0 });
  });

  it('handles a product with only kcal known', () => {
    const guess = product('restaurant pasta', { kcal: 150 });
    const n = ingredientsNutrition(buildFoodTable([guess], []), [ing(guess, 400)]);
    expect(n.kcal).toEqual({ value: 600, missing: 0 });
    expect(n.fat).toEqual({ value: 0, missing: 1 });
  });
});
