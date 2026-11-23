import { describe, expect, it } from 'vitest';
import {
  amountText,
  answered,
  axisOf,
  distinctNames,
  itemKey,
  process,
  questions,
  budget,
  values,
} from './process.ts';
import { type Product, readMeal } from './read.ts';
import { changeText, textView } from './view.ts';

const PER = {
  kcal_per_100_base_units: 150,
  protein_g_per_100_base_units: 4,
  carbs_g_per_100_base_units: 26,
  fat_g_per_100_base_units: 3,
  hydration_ml_per_100_base_units: 0,
};
const raw = (over: Record<string, unknown> = {}) => ({
  name: 'Вареники с картошкой',
  base_unit: 'g',
  piece_count: 10,
  piece_name: 'шт.',
  piece_size_name: null,
  base_units_in_piece: 45,
  ...PER,
  alternatives: [],
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

describe('readMeal', () => {
  it('reads a well-formed answer with no flags', () => {
    const { meal: m, flags } = readMeal(meal(raw()));
    expect(flags).toEqual([]);
    expect(m.dishes[0]!.items[0]).toMatchObject({
      name: 'Вареники с картошкой',
      count: 10,
      size: 45,
    });
  });

  it('fills an alternative’s missing fields from its product, and drops one that is the same', () => {
    const { meal: m, flags } = readMeal(
      meal(raw({ alternatives: [{ piece_count: 12 }, { name: 'вареники с картошкой' }] })),
    );
    expect(m.dishes[0]!.items[0]!.alternatives).toEqual([product({ count: 12 })]);
    expect(flags).toEqual([expect.stringContaining('the same as one before')]);
  });

  it('drops a product with no amount, and a dish left empty', () => {
    const { meal: m, flags } = readMeal(meal(raw({ base_units_in_piece: 'много' })));
    expect(m.dishes).toEqual([]);
    expect(flags).toHaveLength(2);
  });

  it('takes products with no dishes as one dish', () => {
    const { meal: m } = readMeal({ title: 'Обед', products: [raw()] });
    expect(m.dishes[0]!.items).toHaveLength(1);
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
    const water = (over: Record<string, unknown>) =>
      readMeal(meal(raw({ base_unit: 'ml', ...over })));
    expect(
      water({ hydration_ml_per_100_base_units: 88 }).meal.dishes[0]!.items[0]!.per_100.water,
    ).toBe(88);
    const { meal: m, flags } = water({ hydration_ml_per_100_base_units: 330 }); // the can's 330 ml
    expect(m.dishes[0]!.items[0]!.per_100.water).toBe(100);
    expect(flags).toEqual([expect.stringContaining('330, over 100: 100 used')]);
  });

  it('reads an answer of the schema before, its water content as 0, flagged', () => {
    const old = {
      name: 'Вареники с картошкой',
      basis_unit: 'g',
      count: 10,
      unit_name: 'шт.',
      amount_alias: null,
      unit_amount: 45,
      per_100: { calories: 150, protein_g: 4, carbs_g: 26, fat_g: 3, water_g: 64 },
      alternatives: [{ count: 12 }],
    };
    const { meal: m, flags } = readMeal(meal(old));
    const item = m.dishes[0]!.items[0]!;
    expect(item).toMatchObject({ count: 10, unit: 'шт.', size: 45, base: 'g' });
    expect(item.per_100).toEqual({ kcal: 150, protein: 4, carbs: 26, fat: 3, water: 0 });
    expect(item.alternatives[0]).toMatchObject({ count: 12, size: 45 });
    expect(flags).toEqual([expect.stringContaining('hydration_ml_per_100_base_units')]);
  });

  it('never throws', () => {
    expect(readMeal(null).flags).toEqual(['the answer: not an object']);
    expect(readMeal({ dishes: 'x' }).meal.dishes).toEqual([]);
  });
});

describe('questions', () => {
  const guess = product();
  const cottage = product({
    name: 'Вареники с творогом',
    per_100: { kcal: 180, protein: 10, carbs: 24, fat: 5, water: 0 },
  });
  const cherry = product({
    name: 'Вареники с вишней',
    per_100: { kcal: 120, protein: 3, carbs: 26, fat: 1, water: 0 },
  });

  it('tells what an alternative changes', () => {
    expect(axisOf(guess, cottage)).toBe('kind');
    expect(axisOf(guess, { ...cottage, size: 90 })).toBe('kind'); // a kind with its own size
    expect(axisOf(guess, product({ size: 60 }))).toBe('size');
    expect(axisOf(guess, product({ count: 12 }))).toBe('count');
    expect(axisOf(guess, { ...cottage, count: 12 })).toBe('whole');
  });

  it('splits alternatives into independent questions, labelled by their difference', () => {
    const qs = questions(guess, [cottage, cherry, product({ count: 12 })]);
    expect(qs.map((q) => q.axis)).toEqual(['kind', 'count']);
    expect(qs[0]!.options.map((o) => o.label)).toEqual(['с картошкой', 'с творогом', 'с вишней']);
    expect(qs[0]!.options[1]!.delta.kcal).toBeCloseTo(135); // 450 g × 30 kcal / 100
    expect(qs[1]!.options.map((o) => [o.label, o.chosen])).toEqual([
      ['10', true],
      ['12', false],
    ]);
  });

  it('keeps alternatives whole when one changes two things', () => {
    const qs = questions(guess, [{ ...cottage, count: 8 }, product({ count: 12 })]);
    expect(qs).toHaveLength(1);
    expect(qs[0]!.axis).toBe('whole');
    expect(qs[0]!.options.map((o) => o.label)).toEqual([
      'с картошкой, 10 шт. × 45 г',
      'с творогом, 8 шт. × 45 г',
      'с картошкой, 12 шт. × 45 г',
    ]);
  });

  it('takes the user’s answers: the kind chosen, at the count chosen, and the totals again', () => {
    const cottage = { name: 'Вареники с творогом', kcal_per_100_base_units: 200 };
    const m = process(readMeal(meal(raw({ alternatives: [cottage, { piece_count: 14 }] }))).meal);
    const kind = m.dishes[0]!.items[0]!.questions.map((q) => q.axis);
    expect(kind).toEqual(['kind', 'count']);

    const a = answered(m, { [itemKey(0, 0)]: { kind: 'с творогом', count: '14' } });
    const item = a.dishes[0]!.items[0]!;
    expect(item.product).toMatchObject({ name: 'Вареники с творогом', count: 14, size: 45 });
    expect(item.name).toBe('Вареники с творогом');
    expect(item.amount).toBe('14 шт. × 45 г');
    expect(item.values.kcal).toBeCloseTo(1260); // 14 × 45 g × 200 / 100
    expect(a.total.kcal).toBeCloseTo(1260);
    expect(item.questions.map((q) => q.options.find((o) => o.chosen)!.label)).toEqual([
      'с творогом',
      '14',
    ]);
    // none, or a label no option has: the guess
    expect(answered(m, {}).total.kcal).toBeCloseTo(675);
    expect(answered(m, { [itemKey(0, 0)]: { count: '99' } }).total.kcal).toBeCloseTo(675);
  });

  it('has a budget of 8 % of the meal’s kcal, at least 15, at most 80', () => {
    expect([budget(5), budget(500), budget(2000)]).toEqual([15, 40, 80]);
  });

  it('asks the largest first until what is left fits the budget, however many that is', () => {
    const p = (name: string, kcal: number) => ({
      name,
      base_unit: 'g',
      piece_count: null,
      piece_name: null,
      piece_size_name: null,
      base_units_in_piece: 100,
      ...PER,
      kcal_per_100_base_units: 100,
      alternatives: [{ name: `${name} 2`, kcal_per_100_base_units: 100 + kcal }],
    });
    const asked = (...changes: number[]) =>
      process(readMeal(meal(...changes.map((c, i) => p(`f${i}`, c)))).meal).dishes[0]!.items.map(
        (i) => i.questions[0]!.asked,
      );
    // 500 kcal: a budget of 40; the rest as independent errors: √(30² + 25²) = 39
    expect(asked(30, 25, 3, 2, 0)).toEqual([false, false, false, false, false]);
    expect(asked(35, 25, 3, 2, 0)).toEqual([true, false, false, false, false]); // 43, then 25
    // many small ones: √(5 × 20²) = 45 over 40, the 20s asked until the rest fits (√(4 × 20²) = 40)
    expect(asked(20, 20, 20, 20, 20)).toEqual([true, false, false, false, false]);
    // never under the minimum (15), however many: 10 snacks of 10 kcal, each ±14 (√ = 44 over 15)
    const snack = (i: number) => ({
      ...p(`s${i}`, 0),
      base_units_in_piece: 10,
      alternatives: [{ name: `s${i} 2`, kcal_per_100_base_units: 240 }],
    });
    const snacks = process(readMeal(meal(...Array.from({ length: 10 }, (_, i) => snack(i)))).meal);
    expect(snacks.dishes[0]!.items.flatMap((i) => i.questions.map((q) => q.asked))).toEqual(
      Array(10).fill(false),
    );
    // no cap: 6 large ones (600 kcal, a budget of 48), all asked
    expect(asked(200, 150, 100, 90, 80, 60)).toEqual([true, true, true, true, true, true]);
  });

  it('asks about a coffee alone with milk or not', () => {
    const coffee = raw({
      name: 'Кофе черный',
      base_unit: 'ml',
      piece_count: 1,
      piece_name: 'чашка',
      base_units_in_piece: 250,
      kcal_per_100_base_units: 2,
      alternatives: [{ name: 'Кофе с молоком', kcal_per_100_base_units: 9 }], // 30 ml of milk
    });
    const q = process(readMeal(meal(coffee)).meal).dishes[0]!.items[0]!.questions[0]!;
    expect(q.change).toBeCloseTo(17.5);
    expect(q.asked).toBe(true);
  });
});

describe('amounts', () => {
  it('counts pieces, and takes loose food whole', () => {
    expect(values(product()).kcal).toBeCloseTo(675);
    expect(values(product({ count: null, size: 200 })).amount).toBe(200);
    expect(amountText(product())).toBe('10 шт. × 45 г');
    expect(amountText(product({ count: null, alias: 'обычная', size: 200 }))).toBe(
      'обычная, 200 г',
    );
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
    const text = textView(
      process(readMeal(meal(raw({ alternatives: [{ piece_count: 14 }] }))).meal),
    );
    expect(text).toBe(
      [
        '# Обед: 675kcal, 18p, 13.5f, 117c, 0w',
        '## Вареники: 675kcal, 18p, 13.5f, 117c, 0w',
        '- Вареники с картошкой — 10 шт. × 45 г: 450g, 675kcal, 18p, 13.5f, 117c, 0w',
        '  ? сколько',
        '    * 10',
        '    ~ 14: +180g, +270kcal, +7.2p, +5.4f, +46.8c',
      ].join('\n'),
    );
  });
});
