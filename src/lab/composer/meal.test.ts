import { describe, expect, it } from 'vitest';
import { amounts, amountText, isNone, type Meal, readMeal, screenForm, total } from './meal';

const per = (kcal: number, protein = 0) => ({ kcal, protein, fat: 0, carbs: 0, water: 0 });
const one = <T extends { label: string }>(option: T) => ({
  why: '',
  chosen: option.label,
  options: [option],
});
const count = (n: number) => one({ label: String(n), count: n });
const grams = one({ label: 'г', size: 1 });

const tortilla = {
  sized_food: {
    sized_products: one({
      label: 'тортилья',
      name: 'Кукурузная тортилья',
      base: 'g' as const,
      per_100: per(200),
      unit: { name: 'шт.', size: 20 },
    }),
    counts: count(2),
  },
};
const filling = {
  food: {
    products: {
      why: 'начинку не различить',
      chosen: 'пастор',
      options: [
        { label: 'пастор', name: 'Мясо аль пастор', base: 'g' as const, per_100: per(230, 18) },
        { label: 'асада', name: 'Говядина асада', base: 'g' as const, per_100: per(210, 25) },
      ],
    },
    sizes: grams,
    counts: count(40),
  },
};
const milk = {
  food: {
    products: {
      why: 'молоко',
      chosen: 'нет',
      options: [
        { label: 'нет', name: 'Без молока', base: 'ml' as const, per_100: per(0) },
        { label: 'цельное', name: 'Молоко 3,2 %', base: 'ml' as const, per_100: per(60, 3) },
      ],
    },
    sizes: one({ label: 'мл', size: 1 }),
    counts: count(30),
  },
};
const meal: Meal = {
  title: 'Тако',
  items: [
    {
      dish: {
        name: 'Тако',
        items: [tortilla, filling],
        counts: {
          why: 'одно закрыто',
          chosen: '3',
          options: [
            { label: '2', count: 2 },
            { label: '3', count: 3 },
          ],
        },
      },
    },
    milk,
  ],
};

describe('readMeal', () => {
  it('reads a meal of the format as it is', () => {
    expect(readMeal(JSON.parse(JSON.stringify(meal)))).toEqual({ meal, problems: [], notes: [] });
  });

  it('rejects what the format forbids', () => {
    const problem = (change: (m: Meal) => unknown) => {
      const m = structuredClone(meal) as Meal;
      const changed = change(m);
      // a change returns the new meal, or changes it in place (returning what it assigned)
      return readMeal(
        typeof changed === 'object' && changed !== null && 'title' in changed ? changed : m,
      ).problems;
    };
    const dish = (m: Meal) => (m.items[0] as { dish: { items: unknown[] } }).dish;
    expect(
      problem((m) => ((m.items[1] as typeof milk).food.products.chosen = 'Без молока')),
    ).toEqual(['items[1].products: chosen "Без молока" isn\'t a label']);
    expect(problem((m) => dish(m).items.push(structuredClone(meal.items[0])))).toEqual([
      'items[0].dish.items[2]: not a food: dish',
    ]);
    expect(problem((m) => ({ ...m, items: [{ ...tortilla, ...filling }] }))).toEqual([
      'items[0]: a row with sized_food, food',
    ]);
    expect(
      problem((m) => ((m.items[1] as typeof milk).food.counts.options[0]!.count = -1)),
    ).toEqual(['items[1].counts[0].count: not a number ≥ 0']);
    expect(
      problem((m) => ((m.items[1] as typeof milk).food.products.options[1]!.base = 'g' as 'ml')),
    ).toEqual(['items[1].products: products of different bases']);
  });

  it('drops a why on a certain question, as a note', () => {
    const m = structuredClone(meal);
    (m.items[1] as typeof milk).food.counts.why = 'обычно';
    const read = readMeal(m);
    expect(read.problems).toEqual([]);
    expect(read.notes).toEqual(['items[1].counts: a why on a certain question, dropped']);
    expect((read.meal.items[1] as typeof milk).food.counts.why).toBe('');
  });
});

describe('readMeal, a piece labelled as the unit', () => {
  it('is relabelled шт., the amount unchanged', () => {
    const eggs = {
      title: 'Омлет',
      items: [
        {
          food: {
            products: one({ label: 'яйцо', name: 'Яйцо', base: 'g', per_100: per(155) }),
            sizes: one({ label: 'г', size: 50 }),
            counts: count(3),
          },
        },
      ],
    };
    const read = readMeal(eggs);
    expect(read.problems).toEqual([]);
    expect(read.notes).toEqual(['items[0].sizes: a size of 50 labelled as the unit, as шт.']);
    expect(amountText(read.meal.items[0]!)).toBe('3 шт.');
    expect(amounts(read.meal.items[0]!).amount).toBe(150);
  });
});

describe('readMeal, what no one eats', () => {
  const omelette = (count: number, size: number) => ({
    title: 'Омлет',
    items: [
      {
        food: {
          products: one({ label: 'омлет', name: 'Омлет', base: 'g', per_100: per(180) }),
          sizes: one({ label: 'порция', size }),
          counts: one({ label: String(count), count }),
        },
      },
    ],
  });

  it('rejects a weight written as both a count and a size', () => {
    expect(readMeal(omelette(1, 200)).problems).toEqual([]);
    expect(readMeal(omelette(200, 200)).problems).toEqual([
      'items[0] "Омлет": 40000 g, 72000 kcal',
    ]);
  });

  it('rejects a dish part counted in servings again, at the largest count', () => {
    const m = structuredClone(meal);
    const part = (m.items[0] as { dish: { items: (typeof filling)[] } }).dish.items[1]!;
    part.food.counts = count(1000);
    expect(readMeal(m).problems).toEqual(['items[0] "Тако": 3000 g, 6900 kcal']);
  });

  it('notes a choice without a why', () => {
    const m = structuredClone(meal);
    (m.items[1] as typeof milk).food.products.why = '';
    expect(readMeal(m).notes).toEqual(['items[1].products: a choice without a why']);
  });
});

describe('amounts', () => {
  it('multiply a dish’s parts by its servings', () => {
    // 3 tacos × (2 × 20 g tortilla at 200 kcal + 40 g filling at 230 kcal)
    const tacos = amounts(meal.items[0]!);
    expect(tacos.amount).toBe(3 * (40 + 40));
    expect(tacos.kcal).toBeCloseTo(3 * (80 + 92));
    expect(tacos.protein).toBeCloseTo(3 * 7.2);
  });

  it('are nothing for a "none" kind, which the row shows as нет', () => {
    expect(amounts(milk).kcal).toBe(0);
    expect(isNone(milk)).toBe(true);
    expect(total(meal).kcal).toBeCloseTo(3 * 172);
  });
});

describe('screenForm', () => {
  it('shows rows, amounts and the questions with a choice', () => {
    expect(screenForm(meal)).toBe(
      [
        '# Тако',
        '- Тако — ×3 (516 kcal · 21.6 P · 0 F · 0 C)',
        '  C одно закрыто: 2 / [3]',
        '  - Кукурузная тортилья — 2 шт. (240 kcal · 0 P · 0 F · 0 C)',
        '  - Мясо аль пастор — 40 г (276 kcal · 21.6 P · 0 F · 0 C)',
        '    P начинку не различить: [пастор] / асада',
        '- Без молока — 30 мл (нет)',
        '  P молоко: [нет] / цельное',
        '= 516 kcal · 21.6 P · 0 F · 0 C',
      ].join('\n'),
    );
  });
});
