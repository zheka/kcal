/**
 * What the code makes of a meal the model perceived (read.ts), with the user's answers: each
 * product's amount and values, the meal's totals, and the questions worth asking. A product has
 * up to three questions, in this order: what it is (its alternative products), how big (the
 * chosen product's smaller and larger sizes: another product has its own), how many (the fewest
 * and the most pieces). Questions are asked largest first until what is left unasked fits the
 * meal's budget (`budget`), combined as independent errors are (the root of the sum of squares:
 * some guesses are over, some under); none under the budget's minimum is ever asked. Whether a
 * question is asked is judged at the model's guesses, so answers never change it.
 */
import type { Food, Item, Meal, Per100 } from './read.ts';

/** A product as eaten: its amount is (count ?? 1) × size, in its base. */
export interface Product {
  name: string;
  base: 'g' | 'ml';
  /** Pieces; null for loose food and stated weights. */
  count: number | null;
  /** The piece as counted (шт., ломт.). */
  unit: string | null;
  /** One piece when counted, else the whole amount. */
  size: number;
  per_100: Per100;
}

export interface Values {
  /** In the product's base (g or ml); a sum's is the sum of all. */
  amount: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  water: number;
}

/**
 * How much the questions left unasked may typically change a meal, in kcal: a share of the meal,
 * at least `min` (a coffee alone: a splash of milk, 18 kcal, or a teaspoon of sugar, 20, is
 * asked), at most `max` (asked in any meal). `min` is also the smallest change ever asked. Kcal
 * only: what changes protein a lot changes kcal too. Why these: a day can't be counted better
 * than about 5–10 %, and a day's meals are independent errors too, so a meal may be off about
 * twice that (docs/lab-meal-format.md).
 */
export const BUDGET = { share: 0.12, min: 15, max: 120 };

/** The meal's budget, by its kcal at the model's guesses. */
export const budget = (mealKcal: number): number =>
  Math.min(BUDGET.max, Math.max(BUDGET.min, BUDGET.share * mealKcal));

/** What an answer changes: `kind` what it is, `size` how big, `count` how many. */
export type Axis = 'kind' | 'size' | 'count';

export interface Option {
  /** What the answer keeps: a product's name, a size's or a count's amount. */
  id: string;
  label: string;
  /** The product with this answer, the other answers as they are. */
  product: Product;
  values: Values;
  /** Against the product as it is. */
  delta: Values;
  chosen: boolean;
}

export interface Question {
  axis: Axis;
  options: Option[];
  /** The largest change of an answer at the model's guesses, kcal either way. */
  change: number;
  /**
   * Asked: left unasked, it and the smaller ones would typically change the meal by more than
   * its budget.
   */
  asked: boolean;
}

export interface ProcessedItem {
  /** The product's name, as chosen. */
  name: string;
  /** As said: `2 шт. × 50г`, `250мл`. */
  amount: string;
  product: Product;
  values: Values;
  questions: Question[];
}

export interface ProcessedDish {
  name: string;
  items: ProcessedItem[];
  values: Values;
}

export interface Processed {
  title: string;
  dishes: ProcessedDish[];
  total: Values;
}

/**
 * The user's answers to a product's questions: the product chosen (by name), the size chosen
 * for each product (by its amount: each has its own sizes, kept for when it is chosen again), the
 * count chosen. An answer no option has any more is ignored.
 */
export interface ItemAnswers {
  food?: string;
  sizes?: Record<string, string>;
  count?: string;
}

/** The answers of a meal, by `itemKey`. */
export type Answers = Record<string, ItemAnswers>;

/** A product's place in the meal, which its answers are kept by. */
export const itemKey = (dish: number, item: number): string => `${dish}.${item}`;

/** A product's answers with one more: the option `id` of question `q`, for the product as shown. */
export function choose(
  answers: ItemAnswers | undefined,
  item: ProcessedItem,
  q: Question,
  id: string,
): ItemAnswers {
  const a = answers ?? {};
  if (q.axis === 'kind') return { ...a, food: id };
  if (q.axis === 'size') return { ...a, sizes: { ...a.sizes, [item.name]: id } };
  return { ...a, count: id };
}

const ZERO: Values = { amount: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, water: 0 };

export function add(a: Values, b: Values): Values {
  return {
    amount: a.amount + b.amount,
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    water: a.water + b.water,
  };
}

export function subtract(a: Values, b: Values): Values {
  return {
    amount: a.amount - b.amount,
    kcal: a.kcal - b.kcal,
    protein: a.protein - b.protein,
    fat: a.fat - b.fat,
    carbs: a.carbs - b.carbs,
    water: a.water - b.water,
  };
}

export function values(p: Product): Values {
  const amount = (p.count ?? 1) * p.size;
  const f = amount / 100;
  const v = p.per_100;
  return {
    amount,
    kcal: v.kcal * f,
    protein: v.protein * f,
    fat: v.fat * f,
    carbs: v.carbs * f,
    water: v.water * f,
  };
}

/** Units in the answer language. */
export function units(language: string): { g: string; ml: string } {
  return language === 'ru' ? { g: 'г', ml: 'мл' } : { g: 'g', ml: 'ml' };
}

type Units = ReturnType<typeof units>;

export function process(meal: Meal, language = 'ru', answers: Answers = {}): Processed {
  const u = units(language);
  // what is asked: judged at the model's guesses, the largest first, until the rest fits
  const all = meal.dishes.flatMap((d, di) =>
    d.items.flatMap((item, ii) =>
      (Object.entries(changes(item)) as [Axis, number][]).map(([axis, change]) => ({
        key: `${itemKey(di, ii)}:${axis}`,
        change,
      })),
    ),
  );
  const guessed = meal.dishes.reduce(
    (s, d) => s + d.items.reduce((t, i) => t + values(product(i, i.foods[0]!)).kcal, 0),
    0,
  );
  const asked = new Set<string>();
  let rest = all.reduce((s, q) => s + q.change ** 2, 0);
  const most = budget(guessed);
  for (const q of [...all].sort((a, b) => b.change - a.change)) {
    if (rest <= most ** 2 || q.change < BUDGET.min) break;
    asked.add(q.key);
    rest -= q.change ** 2;
  }

  const dishes = meal.dishes.map((d, di) => {
    const items = d.items.map((item, ii) => {
      const key = itemKey(di, ii);
      const shown = view(item, answers[key] ?? {}, u);
      for (const q of shown.questions) q.asked = asked.has(`${key}:${q.axis}`);
      return shown;
    });
    return { name: d.name, items, values: items.reduce((s, i) => add(s, i.values), ZERO) };
  });
  return { title: meal.title, dishes, total: dishes.reduce((s, d) => add(s, d.values), ZERO) };
}

/** The product of an item as eaten: this food, at this size and count. */
function product(item: Item, food: Food, size = food.size, count = item.count): Product {
  return {
    name: food.name,
    base: item.base,
    count,
    unit: item.unit,
    size,
    per_100: food.per_100,
  };
}

const sizesOf = (f: Food): number[] => [f.smaller, f.size, f.larger].filter((s) => s !== null);
const countsOf = (i: Item): number[] =>
  i.count === null ? [] : [i.fewer, i.count, i.more].filter((c) => c !== null);

/** How much each of an item's questions can change it, at the model's guesses. */
function changes(item: Item): Partial<Record<Axis, number>> {
  const guess = item.foods[0]!;
  const kcal = (p: Product) => values(p).kcal;
  const at = kcal(product(item, guess));
  const largest = (xs: number[]) => Math.max(0, ...xs.map((x) => Math.abs(x)));
  const out: Partial<Record<Axis, number>> = {};
  if (item.foods.length > 1) out.kind = largest(item.foods.map((f) => kcal(product(item, f)) - at));
  // another product has its own sizes: the largest change of any product's
  const sizes = item.foods.map((f) =>
    largest(sizesOf(f).map((s) => kcal(product(item, f, s)) - kcal(product(item, f)))),
  );
  if (item.foods.some((f) => sizesOf(f).length > 1)) out.size = Math.max(...sizes);
  if (countsOf(item).length > 1) {
    out.count = largest(countsOf(item).map((c) => kcal(product(item, guess, guess.size, c)) - at));
  }
  return out;
}

/** An item as answered: the product chosen, at its size and count chosen, and its questions. */
function view(item: Item, a: ItemAnswers, u: Units): ProcessedItem {
  const food = item.foods.find((f) => f.name === a.food) ?? item.foods[0]!;
  const size = sizesOf(food).find((s) => String(s) === a.sizes?.[food.name]) ?? food.size;
  const count = countsOf(item).find((c) => String(c) === a.count) ?? item.count;
  const current = product(item, food, size, count);
  const now = values(current);
  const question = (axis: Axis, options: { id: string; product: Product }[], id: string) => {
    const labels = optionLabels(
      axis,
      options.map((o) => o.product),
      u,
    );
    return {
      axis,
      options: options.map((o, i): Option => ({
        ...o,
        label: labels[i]!,
        values: values(o.product),
        delta: subtract(values(o.product), now),
        chosen: o.id === id,
      })),
      change: 0,
      asked: false,
    };
  };

  const questions: Question[] = [];
  if (item.foods.length > 1) {
    const options = item.foods.map((f) => ({
      id: f.name,
      // another product at its own default size
      product: f === food ? current : product(item, f, f.size, count),
    }));
    questions.push(question('kind', options, food.name));
  }
  if (sizesOf(food).length > 1) {
    const options = sizesOf(food).map((s) => ({
      id: String(s),
      product: product(item, food, s, count),
    }));
    questions.push(question('size', options, String(size)));
  }
  if (countsOf(item).length > 1) {
    const options = countsOf(item).map((c) => ({
      id: String(c),
      product: product(item, food, size, c),
    }));
    questions.push(question('count', options, String(count)));
  }
  const ch = changes(item);
  for (const q of questions) q.change = ch[q.axis] ?? 0;
  return {
    name: food.name,
    amount: amountText(current, u),
    product: current,
    values: now,
    questions,
  };
}

/** The chips: only what tells the options apart; made unique by their amounts if need be. */
function optionLabels(axis: Axis, all: Product[], u: Units): string[] {
  const kinds = distinctNames(all.map((p) => p.name));
  const labels = all.map((p, i) => {
    if (axis === 'kind') return kinds[i]!;
    if (axis === 'size') return `${num(p.size)}${u[p.base]}`;
    return num(p.count ?? 1);
  });
  if (new Set(labels).size === labels.length) return labels;
  return labels.map((l, i) => `${l} (${amountText(all[i]!, u)})`);
}

/**
 * Names without the words they all share at the start and the end: "Вареники с картошкой" /
 * "Вареники с творогом" → "с картошкой" / "с творогом"; "Треска на гриле" / "Курица на гриле"
 * → "Треска" / "Курица". A name left empty stays whole.
 */
export function distinctNames(names: string[]): string[] {
  const words = names.map((n) => n.split(/\s+/));
  const shared = (at: (w: string[], i: number) => string | undefined) => {
    let n = 0;
    const shortest = Math.min(...words.map((w) => w.length));
    while (
      n < shortest &&
      words.every((w) => at(w, n)?.toLowerCase() === at(words[0]!, n)?.toLowerCase())
    ) {
      n++;
    }
    return n;
  };
  let start = shared((w, i) => w[i]);
  // a preposition stays with what it introduces: "с творогом", "на миндальном"
  while (start > 0 && words[0]![start - 1]!.length <= 3) start--;
  const end = Math.min(
    shared((w, i) => w[w.length - 1 - i]),
    Math.min(...words.map((w) => w.length)) - start,
  );
  return words.map((w, i) => w.slice(start, w.length - end).join(' ') || names[i]!);
}

/**
 * The amount as said: `2 ломт. × 30г`, `2 × 50г` (a piece with no name), `150г`; a unit right
 * after its number, as in the values (`450g, 675kcal`).
 */
export function amountText(p: Product, u = units('ru')): string {
  const size = `${num(p.size)}${u[p.base]}`;
  if (p.count === null) return size;
  return `${num(p.count)}${p.unit ? ` ${p.unit}` : ''} × ${size}`;
}

export const num = (x: number) => String(Math.round(x * 10) / 10);
