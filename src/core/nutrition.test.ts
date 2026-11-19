import { describe, expect, it } from 'vitest';
import {
  buildFoodTable,
  dayNutrients,
  FoodTableError,
  ingredientPortion,
  ingredientsNutrients,
  mealsOn,
} from './nutrition';
import {
  coffee,
  egg,
  honey,
  ing,
  makes,
  meal,
  milk,
  oatFlakes,
  product,
  recipe,
  water,
} from './testData';

const products = [egg, oatFlakes, milk, honey, coffee];
const table = buildFoodTable(products, []);
const kcal = (i: Parameters<typeof ingredientPortion>[1], t = table) =>
  ingredientPortion(t, i).nutrients.kcal;

describe('products', () => {
  it('give nutrients for any amount in any of their units', () => {
    expect(kcal(ing(egg, 2, 'u:piece'))).toBeCloseTo(171.6);
    expect(ingredientPortion(table, ing(egg, 2, 'u:piece')).nutrients.protein).toBeCloseTo(15.12);
    expect(kcal(ing(oatFlakes, 60))).toBeCloseTo(222);
  });

  it('count an omitted nutrient as 0', () => {
    const tsp = ingredientPortion(table, ing(honey, 1, 'u:tsp')).nutrients;
    expect(tsp.protein).toBe(0);
    expect(tsp.water).toBe(0);
  });

  it('give exactly the same result for the same weight in any unit', () => {
    const cup = product('a', { kcal: 3.333, protein: 0.111 }, [
      { grams: 25, id: 'u:a', name: 'Aa' },
      { grams: 0.1, id: 'u:t', name: 'tenth' },
    ]);
    const t = buildFoodTable([cup], []);
    const p = (amount: number, unit: string) => ingredientPortion(t, ing(cup, amount, unit));
    expect(p(4, 'u:a')).toEqual(p(100, 'g'));
    // 3 × 0.1 g is 0.30000000000000004 in floating point, but exactly 0.3 g here
    expect(p(3, 'u:t')).toEqual(p(0.3, 'g'));
  });

  it('count water by their water content', () => {
    expect(ingredientPortion(table, ing(coffee, 1, 'u:mug')).nutrients.water).toBeCloseTo(297);
    expect(ingredientPortion(table, ing(milk, 1, 'u:cup')).nutrients.water).toBeCloseTo(220);
  });
});

describe('built-in foods', () => {
  it('are there without being stored, with grams and, for water, millilitres', () => {
    expect(table.get('water')?.units.map((u) => u.id)).toEqual(['g', 'ml']);
    expect(table.get('protein')?.units.map((u) => u.id)).toEqual(['g']);
    expect(ingredientPortion(table, ing(water, 330, 'ml')).nutrients).toEqual({
      carbs: 0,
      fat: 0,
      kcal: 0,
      protein: 0,
      water: 330,
    });
  });

  it('let a meal be estimated as macros', () => {
    const estimate = [ing({ id: 'protein' }, 40), ing({ id: 'fat' }, 20), ing({ id: 'carbs' }, 60)];
    expect(ingredientsNutrients(table, estimate).kcal).toBe(40 * 4 + 20 * 9 + 60 * 4);
  });
});

describe('recipes', () => {
  // 60 g oat flakes + 1 cup of milk + 1 tsp honey; makes 1 bowl, or 2 small bowls
  const oats = recipe(
    'oats',
    [ing(oatFlakes, 60), ing(milk, 1, 'u:cup'), ing(honey, 1, 'u:tsp')],
    [makes(1, 'bowl'), makes(2, 'small bowl')],
  );
  const t = buildFoodTable(products, [oats]);
  const wholeKcal = 222 + 250 * 0.64 + 7 * 3.04;

  it('are eaten in their own units: the whole recipe makes so many of each', () => {
    expect(kcal(ing(oats, 1, 'u:bowl'), t)).toBeCloseTo(wholeKcal);
    expect(kcal(ing(oats, 1, 'u:small bowl'), t)).toBeCloseTo(wholeKcal / 2);
    expect(t.get(oats.id)?.units.map((u) => u.name)).toEqual(['bowl', 'small bowl']);
  });

  it('have no built-in units: not even grams', () => {
    expect(t.get(oats.id)?.portion('g', 100)).toBeUndefined();
  });

  it('divide last: makes of a unit is exactly the whole recipe', () => {
    const thirds = recipe('thirds', [ing(oatFlakes, 100)], [makes(3, 'third')]);
    const tt = buildFoodTable(products, [thirds]);
    expect(kcal(ing(thirds, 3, 'u:third'), tt)).toBe(kcal(ing(oatFlakes, 100), tt));
  });

  it('can say how many grams the finished dish weighs', () => {
    // A pot of 1 kg oat flakes and 2 kg water weighs 2.5 kg once cooked.
    const pot = recipe('porridge', [ing(oatFlakes, 1000), ing(water, 2000)], [makes(2500, 'g')]);
    const tt = buildFoodTable(products, [pot]);
    expect(kcal(ing(pot, 250, 'u:g'), tt)).toBeCloseTo(370);
  });

  it('can contain recipes, in any order, and follow edits of their ingredients', () => {
    const plain = recipe('plain', [ing(oatFlakes, 60), ing(water, 240)], [makes(1, 'bowl')]);
    const sweet = recipe(
      'sweet',
      [ing(plain, 1, 'u:bowl'), ing(honey, 2, 'u:tsp')],
      [makes(1, 'bowl')],
    );
    expect(kcal(ing(sweet, 1, 'u:bowl'), buildFoodTable(products, [sweet, plain]))).toBeCloseTo(
      222 + 14 * 3.04,
    );
    const fixed = { ...oatFlakes, perGram: { ...oatFlakes.perGram, kcal: 3.8 } };
    const edited = buildFoodTable([fixed, honey], [sweet, plain]);
    expect(kcal(ing(sweet, 1, 'u:bowl'), edited)).toBeCloseTo(228 + 14 * 3.04);
    // water from the built-in water inside the inner recipe
    expect(ingredientPortion(edited, ing(sweet, 1, 'u:bowl')).nutrients.water).toBe(240);
  });

  it('refuse recipes that contain each other, and unknown foods or units', () => {
    const a = recipe('a', [{ amount: 1, food: 'r:b', unit: 'u:x' }], [makes(1, 'x')]);
    const b = recipe('b', [ing(a, 1, 'u:x')], [makes(1, 'x')]);
    expect(() => buildFoodTable(products, [a, b])).toThrow('"a" → "b" → "a"');
    expect(() => buildFoodTable(products, [a, b])).toThrow(FoodTableError);
    const unknown = recipe('u', [{ amount: 1, food: 'p:none', unit: 'g' }], [makes(1)]);
    expect(() => buildFoodTable(products, [unknown])).toThrow('unknown food p:none');
    const badUnit = recipe('v', [ing(egg, 1, 'u:none')], [makes(1)]);
    expect(() => buildFoodTable(products, [badUnit])).toThrow('"egg" has no unit u:none');
  });
});

describe('meals and days', () => {
  // Europe/Berlin: 07:30 UTC is 08:30 local; 23:30 UTC is 00:30 the next local day.
  const breakfast = meal('2026-11-17T07:30:41.512Z', [
    ing(egg, 2, 'u:piece'),
    ing(water, 330, 'ml'),
  ]);
  const lunch = meal('2026-11-17T12:00:00.000Z', [ing(oatFlakes, 100)]);
  const lateSnack = meal('2026-11-17T23:30:00.000Z', [ing(egg, 1, 'u:piece')]);
  const meals = [lateSnack, lunch, breakfast];

  it('belong to their local day, in time order', () => {
    expect(mealsOn(meals, '2026-11-17')).toEqual([breakfast, lunch]);
    expect(mealsOn(meals, '2026-11-18')).toEqual([lateSnack]);
  });

  it('sum up into the day', () => {
    const day = dayNutrients(table, meals, '2026-11-17');
    expect(day.kcal).toBeCloseTo(171.6 + 370);
    expect(day.water).toBe(330);
    expect(dayNutrients(table, meals, '2026-11-19').kcal).toBe(0);
  });
});
