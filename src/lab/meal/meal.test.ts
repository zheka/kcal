import { describe, expect, it } from 'vitest';
import { amountText, axisOf, distinctNames, process, questions, values } from './process.ts';
import { type Product, readMeal } from './read.ts';
import { changeText, textView } from './view.ts';

const PER = { calories: 150, protein_g: 4, carbs_g: 26, fat_g: 3, hydration_ml: 0 };
const raw = (over: Record<string, unknown> = {}) => ({
  name: 'Вареники с картошкой',
  basis_unit: 'g',
  count: 10,
  unit_name: 'шт.',
  amount_alias: null,
  unit_amount: 45,
  per_100: PER,
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
      meal(raw({ alternatives: [{ count: 12 }, { name: 'вареники с картошкой' }] })),
    );
    expect(m.dishes[0]!.items[0]!.alternatives).toEqual([product({ count: 12 })]);
    expect(flags).toEqual([expect.stringContaining('the same as one before')]);
  });

  it('drops a product with no amount, and a dish left empty', () => {
    const { meal: m, flags } = readMeal(meal(raw({ unit_amount: 'много' })));
    expect(m.dishes).toEqual([]);
    expect(flags).toHaveLength(2);
  });

  it('takes products with no dishes as one dish', () => {
    const { meal: m } = readMeal({ title: 'Обед', products: [raw()] });
    expect(m.dishes[0]!.items).toHaveLength(1);
  });

  it('flags values that don’t add up and an amount nobody eats, but keeps them', () => {
    const { meal: m, flags } = readMeal(
      meal(raw({ count: 150, unit_amount: 150, per_100: { ...PER, calories: 400 } })),
    );
    expect(m.dishes[0]!.items).toHaveLength(1);
    expect(flags.join('\n')).toMatch(/macros make 147/);
    expect(flags.join('\n')).toMatch(/22500 g/);
  });

  it('reads the water to drink, and an answer without it as 0, flagged', () => {
    const borscht = raw({ basis_unit: 'ml', per_100: { ...PER, hydration_ml: 88 } });
    expect(readMeal(meal(borscht)).meal.dishes[0]!.items[0]!.per_100.water).toBe(88);
    const old = { calories: 150, protein_g: 4, carbs_g: 26, fat_g: 3, water_g: 64 }; // before it
    const { meal: m, flags } = readMeal(meal(raw({ per_100: old })));
    expect(m.dishes[0]!.items[0]!.per_100.water).toBe(0);
    expect(flags).toEqual([expect.stringContaining('per_100.hydration_ml')]);
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

  it('asks only what changes 80 kcal or 10 g protein, at most 3 in a meal, the largest first', () => {
    const p = (name: string, kcal: number) => ({
      name,
      basis_unit: 'g',
      count: null,
      unit_name: null,
      amount_alias: null,
      unit_amount: 100,
      per_100: { ...PER, calories: 100 },
      alternatives: [{ name: `${name} 2`, per_100: { ...PER, calories: 100 + kcal } }],
    });
    const out = process(
      readMeal(meal(p('a', 50), p('b', 90), p('c', 200), p('d', 150), p('e', 100))).meal,
    );
    const asked = out.dishes[0]!.items.map((i) => i.questions[0]!.asked);
    expect(asked).toEqual([false, false, true, true, true]);
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
    const text = textView(process(readMeal(meal(raw({ alternatives: [{ count: 14 }] }))).meal));
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
