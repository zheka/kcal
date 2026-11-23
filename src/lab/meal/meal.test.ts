import { describe, expect, it } from 'vitest';
import {
  amountText,
  budget,
  choose,
  distinctNames,
  itemKey,
  type Answers,
  process,
  type Product,
  values,
} from './process.ts';
import { readMeal } from './read.ts';
import { changeText, textView } from './view.ts';

const PER = {
  kcal_per_100_base_units: 150,
  protein_g_per_100_base_units: 4,
  carbs_g_per_100_base_units: 26,
  fat_g_per_100_base_units: 3,
  hydration_ml_per_100_base_units: 0,
};
const NO_RANGE = {
  smaller_piece_size_name: null,
  smaller_base_units_in_piece: null,
  larger_piece_size_name: null,
  larger_base_units_in_piece: null,
};
/** A food as the model answers it: an alternative product, or a product's own part. */
const food = (over: Record<string, unknown> = {}) => ({
  name: 'Вареники с картошкой',
  piece_size_name: null,
  base_units_in_piece: 45,
  ...NO_RANGE,
  ...PER,
  ...over,
});
const raw = (over: Record<string, unknown> = {}) => ({
  ...food(),
  base_unit: 'g',
  piece_count: 10,
  fewer_piece_count: null,
  more_piece_count: null,
  piece_name: 'шт.',
  alternative_products: [],
  ...over,
});
const meal = (...products: unknown[]) => ({
  title: 'Обед',
  dishes: [{ name: 'Вареники', products }],
});
const product = (over: Partial<Product> = {}): Product => ({
  name: 'Вареники с картошкой',
  base: 'g',
  count: 10,
  unit: 'шт.',
  alias: null,
  size: 45,
  per_100: { kcal: 150, protein: 4, carbs: 26, fat: 3, water: 0 },
  ...over,
});
const first = (m: ReturnType<typeof process>) => m.dishes[0]!.items[0]!;
const shown = (answer: object, answers: Answers = {}) =>
  process(readMeal(answer).meal, 'ru', answers);

describe('readMeal', () => {
  it('reads a well-formed answer with no flags', () => {
    const { meal: m, flags } = readMeal(meal(raw()));
    expect(flags).toEqual([]);
    expect(m.dishes[0]!.items[0]).toMatchObject({
      base: 'g',
      count: 10,
      fewer: null,
      more: null,
      unit: 'шт.',
      foods: [{ name: 'Вареники с картошкой', size: { name: null, amount: 45 }, smaller: null }],
    });
  });

  it('reads the likely range: a bound on the wrong side dropped, the guess itself none', () => {
    const { meal: m, flags } = readMeal(
      meal(
        raw({
          fewer_piece_count: 8,
          more_piece_count: 10, // the guess: no bound
          smaller_piece_size_name: 'S',
          smaller_base_units_in_piece: 50, // over the guess: dropped
          larger_piece_size_name: 'L',
          larger_base_units_in_piece: 60,
        }),
      ),
    );
    const item = m.dishes[0]!.items[0]!;
    expect([item.fewer, item.more]).toEqual([8, null]);
    expect(item.foods[0]).toMatchObject({ smaller: null, larger: { name: 'L', amount: 60 } });
    expect(flags).toEqual([expect.stringContaining('50, not under 45: dropped')]);
  });

  it('drops a size name with no size, and a count range of loose food', () => {
    const { meal: m, flags } = readMeal(
      meal(raw({ piece_count: null, more_piece_count: 3, larger_piece_size_name: 'large' })),
    );
    expect(m.dishes[0]!.items[0]).toMatchObject({ count: null, more: null });
    expect(flags).toEqual([expect.stringContaining('"large" with no size, dropped')]);
  });

  it('drops an alternative product named as one before, and a product with no size', () => {
    const { meal: m, flags } = readMeal(
      meal(
        raw({ alternative_products: [food({ name: 'вареники с картошкой' })] }),
        raw({ base_units_in_piece: 'много' }),
      ),
    );
    expect(m.dishes[0]!.items).toHaveLength(1);
    expect(m.dishes[0]!.items[0]!.foods).toHaveLength(1);
    expect(flags).toEqual([
      expect.stringContaining('named as one before, dropped'),
      expect.stringContaining('no base_units_in_piece, dropped'),
    ]);
  });

  it('flags values that don’t add up and an amount nobody eats, but keeps them', () => {
    const { meal: m, flags } = readMeal(
      meal(raw({ piece_count: 150, base_units_in_piece: 150, kcal_per_100_base_units: 400 })),
    );
    expect(m.dishes[0]!.items).toHaveLength(1);
    expect(flags.join('\n')).toMatch(/macros make 147/);
    expect(flags.join('\n')).toMatch(/22500 g/);
  });

  it('reads the water to drink, at most 100', () => {
    const water = (h: number) =>
      readMeal(meal(raw({ base_unit: 'ml', hydration_ml_per_100_base_units: h })));
    expect(water(88).meal.dishes[0]!.items[0]!.foods[0]!.per_100.water).toBe(88);
    const { meal: m, flags } = water(330); // the can's 330 ml
    expect(m.dishes[0]!.items[0]!.foods[0]!.per_100.water).toBe(100);
    expect(flags).toEqual([expect.stringContaining('330, over 100: 100 used')]);
  });

  it('never throws', () => {
    expect(readMeal(null).flags).toEqual(['the answer: not an object']);
    expect(readMeal({ dishes: 'x' }).meal.dishes).toEqual([]);
  });
});

describe('questions', () => {
  const cottage = food({
    name: 'Вареники с творогом',
    smaller_base_units_in_piece: 35,
    larger_base_units_in_piece: 55,
    kcal_per_100_base_units: 200,
  });
  const ranged = raw({
    fewer_piece_count: 8,
    more_piece_count: 14,
    smaller_base_units_in_piece: 35,
    larger_base_units_in_piece: 55,
    alternative_products: [cottage],
  });

  it('asks what it is, how big, how many, in that order, labelled by their difference', () => {
    const qs = first(shown(meal(ranged))).questions;
    expect(qs.map((q) => q.axis)).toEqual(['kind', 'size', 'count']);
    expect(qs.map((q) => q.options.map((o) => o.label))).toEqual([
      ['с картошкой', 'с творогом'],
      ['35г', '45г', '55г'],
      ['8', '10', '14'],
    ]);
    expect(qs[0]!.options[1]!.delta.kcal).toBeCloseTo(225); // 450 g × 50 kcal / 100
    expect(qs.map((q) => q.options.find((o) => o.chosen)!.label)).toEqual([
      'с картошкой',
      '45г',
      '10',
    ]);
  });

  it('takes the user’s answers: the product chosen, at the size and count chosen', () => {
    const m = shown(meal(ranged));
    const [kind, size, count] = first(m).questions;
    let a = choose(undefined, first(m), kind!, 'Вареники с творогом');
    a = choose(a, first(shown(meal(ranged), { '0.0': a })), size!, '55');
    a = choose(a, first(m), count!, '14');
    const item = first(shown(meal(ranged), { [itemKey(0, 0)]: a }));
    expect(item.product).toMatchObject({ name: 'Вареники с творогом', count: 14, size: 55 });
    expect(item.name).toBe('Вареники с творогом');
    expect(item.amount).toBe('14 шт. × 55г');
    expect(item.values.kcal).toBeCloseTo(1540); // 14 × 55 g × 200 / 100
    // none, or an answer no option has: the guess
    expect(shown(meal(ranged)).total.kcal).toBeCloseTo(675);
    expect(shown(meal(ranged), { '0.0': { count: '99' } }).total.kcal).toBeCloseTo(675);
  });

  it('shows another product in its own size, and keeps each product’s size chosen', () => {
    const croissant = raw({
      name: 'Круассан миндальный',
      piece_count: 1,
      base_units_in_piece: 90,
      smaller_base_units_in_piece: 70,
      larger_base_units_in_piece: 130,
      alternative_products: [
        food({
          name: 'Круассан классический',
          base_units_in_piece: 60,
          smaller_base_units_in_piece: 50,
          larger_base_units_in_piece: 80,
        }),
      ],
    });
    const at = (answers: Answers['0.0']) => first(shown(meal(croissant), { '0.0': answers }));
    // larger for the almond one, then the classic one: at its own 60 g, its own sizes
    const classic = at({ sizes: { 'Круассан миндальный': '130' }, food: 'Круассан классический' });
    expect(classic.product.size).toBe(60);
    expect(classic.questions[1]!.options.map((o) => o.label)).toEqual(['50г', '60г', '80г']);
    // back to the almond one: its larger size again
    expect(at({ sizes: { 'Круассан миндальный': '130' } }).product.size).toBe(130);
  });

  it('has a budget of 12 % of the meal’s kcal, at least 15, at most 120', () => {
    expect([budget(5), budget(500), budget(2000)]).toEqual([15, 60, 120]);
  });

  it('asks the largest first until what is left fits the budget, however many that is', () => {
    const p = (name: string, kcal: number, size = 100) =>
      raw({
        name,
        piece_count: null,
        piece_name: null,
        base_units_in_piece: size,
        kcal_per_100_base_units: 100,
        alternative_products: [
          food({
            name: `${name} 2`,
            base_units_in_piece: size,
            kcal_per_100_base_units: 100 + kcal,
          }),
        ],
      });
    const asked = (...changes: number[]) =>
      shown(meal(...changes.map((c, i) => p(`f${i}`, c)))).dishes[0]!.items.map(
        (i) => i.questions[0]!.asked,
      );
    // 500 kcal: a budget of 60; the rest as independent errors: √(45² + 35²) = 57
    expect(asked(45, 35, 3, 2, 0)).toEqual([false, false, false, false, false]);
    expect(asked(50, 40, 3, 2, 0)).toEqual([true, false, false, false, false]); // 64, then 40
    // many small ones: √(5 × 30²) = 67 over 60, the 30s asked until the rest fits (√(4 × 30²) = 60)
    expect(asked(30, 30, 30, 30, 30)).toEqual([true, false, false, false, false]);
    // never under the minimum (15), however many: 10 snacks of 10 kcal, each ±14 (√ = 44 over 15)
    const snacks = shown(meal(...Array.from({ length: 10 }, (_, i) => p(`s${i}`, 140, 10))));
    expect(snacks.dishes[0]!.items.map((i) => i.questions[0]!.asked)).toEqual(
      Array(10).fill(false),
    );
    // no cap: 6 large ones (600 kcal, a budget of 72), asked until the last (60) fits
    expect(asked(200, 150, 100, 90, 80, 60)).toEqual([true, true, true, true, true, false]);
  });

  it('asks about a coffee alone with milk or not, and a size of what may not be there', () => {
    const coffee = raw({
      name: 'Кофе черный',
      base_unit: 'ml',
      piece_count: 1,
      piece_name: 'чашка',
      base_units_in_piece: 250,
      kcal_per_100_base_units: 2,
      alternative_products: [
        food({ name: 'Кофе с молоком', base_units_in_piece: 250, kcal_per_100_base_units: 9 }),
      ], // 30 ml of milk
    });
    const q = first(shown(meal(coffee))).questions[0]!;
    expect(q.change).toBeCloseTo(17.5);
    expect(q.asked).toBe(true);
    const sugar = raw({
      name: 'Сахар',
      piece_count: null,
      base_units_in_piece: 5,
      smaller_base_units_in_piece: 0,
      larger_base_units_in_piece: 10,
      kcal_per_100_base_units: 400,
    });
    const sizes = first(shown(meal(sugar)));
    expect(sizes.questions[0]!.options.map((o) => o.label)).toEqual(['0г', '5г', '10г']);
  });
});

describe('amounts', () => {
  it('counts pieces, and takes loose food whole', () => {
    expect(values(product()).kcal).toBeCloseTo(675);
    expect(values(product({ count: null, size: 200 })).amount).toBe(200);
    expect(amountText(product())).toBe('10 шт. × 45г');
    expect(amountText(product({ count: null, alias: '0,5', size: 500, base: 'ml' }))).toBe(
      '0,5, 500мл',
    );
    // a piece with no name: the count alone
    expect(amountText(product({ unit: null, count: 2, size: 50 }))).toBe('2 × 50г');
    expect(amountText(product({ unit: null, count: 1, alias: 'M', size: 250 }))).toBe('1 M × 250г');
  });

  it('strips the words names share', () => {
    expect(distinctNames(['Треска на гриле', 'Курица на гриле'])).toEqual(['Треска', 'Курица']);
    expect(distinctNames(['Рис', 'Рис'])).toEqual(['Рис', 'Рис']);
  });

  it('shows a change by what changes, rounded as values are', () => {
    const d = { amount: 0, kcal: 40.4, protein: -0.75, fat: 0.04, carbs: 0, water: 0 };
    expect(changeText(d, 'g')).toBe('+40kcal, -0.8p');
    expect(changeText({ ...d, amount: -70 }, 'ml')).toBe('-70ml, +40kcal, -0.8p');
    expect(changeText({ ...d, amount: -70 })).toBe('+40kcal, -0.8p');
    expect(changeText({ ...d, kcal: 0.2, protein: 0 })).toBe('');
  });

  it('shows a meal as text', () => {
    const text = textView(shown(meal(raw({ more_piece_count: 14 }))));
    expect(text).toBe(
      [
        '# Обед: 675kcal, 18p, 13.5f, 117c, 0w',
        '## Вареники: 675kcal, 18p, 13.5f, 117c, 0w',
        '- Вареники с картошкой — 10 шт. × 45г: 450g, 675kcal, 18p, 13.5f, 117c, 0w',
        '  ? сколько',
        '    * 10',
        '    ~ 14: +180g, +270kcal, +7.2p, +5.4f, +46.8c',
      ].join('\n'),
    );
  });
});
