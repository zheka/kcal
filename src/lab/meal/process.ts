/**
 * What the code makes of a meal the model perceived (read.ts): each product's amount and values,
 * the meal's totals, and the questions worth asking. The model's alternatives are split into
 * independent questions where they fit (what it is, how big, how many), else kept whole (one
 * question of whole products); a question is worth asking when an answer changes the product by
 * THRESHOLD, and at most MAX_QUESTIONS are asked in a meal, the ones that change the most.
 */
import { type Item, type Meal, type Product, sameName, samePer100 } from './read.ts';

export interface Values {
  /** In the product's base (g or ml); a sum's is the sum of all. */
  amount: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  water: number;
}

/** A change worth asking about: one of these, either way. */
export const THRESHOLD = { kcal: 80, protein: 10 };
export const MAX_QUESTIONS = 3;

/** What an answer changes: `kind` what it is, `size` how big, `count` how many, `whole` all. */
export type Axis = 'kind' | 'size' | 'count' | 'whole';

export interface Option {
  label: string;
  /** The product with this answer (and the other questions at the model's guess). */
  product: Product;
  values: Values;
  /** Against the model's guess. */
  delta: Values;
  /** The model's guess. */
  chosen: boolean;
}

export interface Question {
  axis: Axis;
  options: Option[];
  /** The largest change of an answer, in thresholds: 1 or more is worth asking. */
  impact: number;
  /** Asked: worth it and among the meal's MAX_QUESTIONS. */
  asked: boolean;
}

export interface ProcessedItem {
  name: string;
  /** As said: `2 шт. × 50 г`, `обычная, 200 г`. */
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

export function process(meal: Meal, language = 'ru'): Processed {
  const u = units(language);
  const dishes = meal.dishes.map((d) => {
    const items = d.items.map((i) => processItem(i, u));
    return { name: d.name, items, values: items.reduce((s, i) => add(s, i.values), ZERO) };
  });
  // the meal's most telling questions are asked, the rest kept for "more"
  const all = dishes.flatMap((d) => d.items.flatMap((i) => i.questions));
  all
    .filter((q) => q.impact >= 1)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, MAX_QUESTIONS)
    .forEach((q) => (q.asked = true));
  return {
    title: meal.title,
    dishes,
    total: dishes.reduce((s, d) => add(s, d.values), ZERO),
  };
}

function processItem(item: Item, u: { g: string; ml: string }): ProcessedItem {
  const { alternatives, ...product } = item;
  return {
    name: product.name,
    amount: amountText(product, u),
    product,
    values: values(product),
    questions: questions(product, alternatives, u),
  };
}

/** What an alternative changes against the guess. */
export function axisOf(guess: Product, alt: Product): Axis {
  const kind = !(sameName(guess, alt) || samePer100(guess.per_100, alt.per_100));
  const size = alt.size !== guess.size || alt.alias !== guess.alias;
  const count = alt.count !== guess.count;
  if (kind && !count) return 'kind'; // a kind may come with its own size (a bigger croissant)
  if (!kind && size && !count) return 'size';
  if (!kind && !size && count) return 'count';
  return 'whole';
}

/**
 * The alternatives as questions: independent ones (what, how big, how many) when every
 * alternative changes one of them and no kind brings its own size while a size is also asked;
 * else one question of whole products.
 */
export function questions(guess: Product, alts: Product[], u = units('ru')): Question[] {
  if (alts.length === 0) return [];
  const axes = alts.map((a) => axisOf(guess, a));
  const kindsSized = alts.some((a, i) => axes[i] === 'kind' && a.size !== guess.size);
  const split = !axes.includes('whole') && !(kindsSized && axes.includes('size'));
  if (!split) return [question('whole', guess, alts, u)];
  const of = (axis: Axis) => alts.filter((_, i) => axes[i] === axis);
  return (['kind', 'size', 'count'] as const)
    .filter((axis) => of(axis).length > 0)
    .map((axis) => {
      // each answer changes only its own part of the guess
      const products = of(axis).map((a): Product => {
        if (axis === 'kind') return { ...a, count: guess.count };
        if (axis === 'size') return { ...guess, size: a.size, alias: a.alias };
        return { ...guess, count: a.count, unit: a.unit ?? guess.unit };
      });
      return question(axis, guess, products, u);
    });
}

function question(
  axis: Axis,
  guess: Product,
  products: Product[],
  u: { g: string; ml: string },
): Question {
  const all = [guess, ...products];
  const labels = optionLabels(axis, all, u);
  const base = values(guess);
  const options = all.map((p, i): Option => {
    const v = values(p);
    return {
      label: labels[i]!,
      product: p,
      values: v,
      delta: subtract(v, base),
      chosen: i === 0,
    };
  });
  // natural order where there is one: small to large, counts ascending
  if (axis === 'size' || axis === 'count')
    options.sort((a, b) => a.values.amount - b.values.amount);
  const impact = Math.max(
    ...options.map((o) =>
      Math.max(
        Math.abs(o.delta.kcal) / THRESHOLD.kcal,
        Math.abs(o.delta.protein) / THRESHOLD.protein,
      ),
    ),
  );
  return { axis, options, impact, asked: false };
}

/** The chips: only what tells the options apart; made unique by their amounts if need be. */
function optionLabels(axis: Axis, all: Product[], u: { g: string; ml: string }): string[] {
  const kinds = distinctNames(all.map((p) => p.name));
  const labels = all.map((p, i) => {
    if (axis === 'kind') return kinds[i]!;
    if (axis === 'size') return p.alias ?? `${num(p.size)} ${u[p.base]}`;
    if (axis === 'count') return p.count === 0 ? '0' : num(p.count ?? 1);
    const amount = amountText(p, u);
    return all.every((o) => sameName(o, all[0]!)) ? amount : `${kinds[i]}, ${amount}`;
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

/** The amount as said: `2 шт. × 50 г`, `1 стакан M, 350 мл`, `обычная, 200 г`, `150 г`. */
export function amountText(p: Product, u = units('ru')): string {
  const size = `${num(p.size)} ${u[p.base]}`;
  if (p.count === null) return p.alias ? `${p.alias}, ${size}` : size;
  const unit = [p.unit ?? 'шт.', p.alias].filter(Boolean).join(' ');
  return `${num(p.count)} ${unit} × ${size}`;
}

export const num = (x: number) => String(Math.round(x * 10) / 10);

/** The user's answers: per product (by `itemKey`), per question, the label of the option chosen. */
export type Answers = Record<string, Partial<Record<Axis, string>>>;

/** A product's place in the meal, which its answers are kept by. */
export const itemKey = (dish: number, item: number): string => `${dish}.${item}`;

/**
 * The meal with the user's answers: each answered product as chosen, with its amount and values,
 * and the totals again; each question's `chosen` moved to the answer. Answers to independent
 * questions combine: the kind chosen, at the size and the count chosen. A label that no option
 * has is ignored (the guess stays).
 */
export function answered(meal: Processed, answers: Answers, language = 'ru'): Processed {
  const u = units(language);
  const dishes = meal.dishes.map((d, di) => {
    const items = d.items.map((item, ii): ProcessedItem => {
      const mine = answers[itemKey(di, ii)] ?? {};
      let product = item.product;
      const questions = item.questions.map((q): Question => {
        const pick = q.options.find((o) => o.label === mine[q.axis]);
        if (!pick) return q;
        product = withAnswer(q.axis, product, pick.product);
        return { ...q, options: q.options.map((o) => ({ ...o, chosen: o === pick })) };
      });
      return {
        ...item,
        name: product.name,
        amount: amountText(product, u),
        product,
        values: values(product),
        questions,
      };
    });
    return { ...d, items, values: items.reduce((s, i) => add(s, i.values), ZERO) };
  });
  return { ...meal, dishes, total: dishes.reduce((s, d) => add(s, d.values), ZERO) };
}

/** The product so far with one more answer: only that answer's part of it changes. */
function withAnswer(axis: Axis, so: Product, chosen: Product): Product {
  if (axis === 'size') return { ...so, size: chosen.size, alias: chosen.alias };
  if (axis === 'count') return { ...so, count: chosen.count, unit: chosen.unit };
  // a kind comes first, with the count of the guess (see questions); a whole answer is all of it
  return chosen;
}
