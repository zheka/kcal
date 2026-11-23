/**
 * A meal in the lab's format (docs/lab-meal-format.md): what the model answers, what the meal
 * screen adjusts, what is stored and sent back. Rows of foods and dishes, each with its questions
 * (what it is, how big, how many) and their current answers; the amounts and values follow from
 * the answers, with no model call. No imports: the bench script (scripts/meal-bench.ts) runs it
 * in Node as it is.
 */

export interface Per100 {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  water: number;
}

export interface Product {
  /** The chip: what tells it apart from the other options. */
  label: string;
  /** The full name: the row's name when chosen. */
  name: string;
  base: 'g' | 'ml';
  per_100: Per100;
}

export interface SizedProduct extends Product {
  unit: { name: string; size: number };
}

/** A size in the product's base. Its label is the unit in the amount ("1 grande", "150 г"). */
export interface Size {
  label: string;
  size: number;
}

export interface Count {
  label: string;
  count: number;
}

/** The doubt, the current answer (a label of an option), the options; one option when certain. */
export interface Question<T> {
  why: string;
  chosen: string;
  options: T[];
}

/** A food whose size comes with its kind (croissant plain 60 g / almond 90 g). */
export interface SizedFood {
  sized_products: Question<SizedProduct>;
  counts: Question<Count>;
}

/**
 * A food whose size is chosen on its own: a menu size (latte tall / grande), a named portion of
 * loose food (маленькая / обычная / большая, counted 1), or loose food in grams (a size of 1 g).
 */
export interface Food {
  products: Question<Product>;
  sizes: Question<Size>;
  counts: Question<Count>;
}

/** A dish of foods, each part's amount per serving; the count of servings multiplies them. */
export interface Dish {
  name: string;
  items: Part[];
  counts: Question<Count>;
}

export type Part = { sized_food: SizedFood } | { food: Food };
export type Row = Part | { dish: Dish };

export interface Meal {
  title: string;
  items: Row[];
}

// Reading --------------------------------------------------------------------------------------

/** Size labels that are the base unit itself: such a size is 1. */
const BASE_UNITS = ['г', 'g', 'мл', 'ml'];

/** More options than this is the model hedging, not a choice. */
export const MAX_OPTIONS = 8;

/** More than this in one row, at any of its answers, isn't a meal (g or ml, kcal). */
export const MAX_AMOUNT = 3000;
export const MAX_KCAL = 3000;

/**
 * Reads a meal (the model's answer, or a stored one) strictly: any problem and it isn't used.
 * `notes` are harmless slips, fixed as read (a why on a certain question is dropped).
 */
export function readMeal(raw: unknown): { meal: Meal; problems: string[]; notes: string[] } {
  const problems: string[] = [];
  const notes: string[] = [];
  const fail = (at: string, what: string): never => {
    throw new Problem(`${at}: ${what}`);
  };

  const text = (x: unknown, at: string): string =>
    typeof x === 'string' ? x.trim() : fail(at, 'not text');
  const label = (x: unknown, at: string): string => text(x, at) || fail(at, 'empty');
  const amount = (x: unknown, at: string): number =>
    typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : fail(at, 'not a number ≥ 0');
  const object = (x: unknown, at: string): Record<string, unknown> =>
    typeof x === 'object' && x !== null && !Array.isArray(x)
      ? (x as Record<string, unknown>)
      : fail(at, 'not an object');

  function question<T extends { label: string }>(
    x: unknown,
    at: string,
    option: (o: Record<string, unknown>, at: string) => T,
  ): Question<T> {
    const q = object(x, at);
    if (!Array.isArray(q.options) || q.options.length === 0) fail(at, 'no options');
    const list = q.options as unknown[];
    if (list.length > MAX_OPTIONS) fail(at, `more than ${MAX_OPTIONS} options`);
    const options = list.map((o, i) => option(object(o, `${at}[${i}]`), `${at}[${i}]`));
    const labels = options.map((o) => o.label);
    if (new Set(labels).size !== labels.length) fail(at, 'labels repeat');
    const chosen = text(q.chosen, `${at}.chosen`);
    if (!labels.includes(chosen)) fail(at, `chosen "${chosen}" isn't a label`);
    let why = text(q.why, `${at}.why`);
    if (options.length === 1 && why) {
      notes.push(`${at}: a why on a certain question, dropped`);
      why = '';
    }
    if (options.length > 1 && !why) notes.push(`${at}: a choice without a why`);
    return { why, chosen, options };
  }

  const per100 = (x: unknown, at: string): Per100 => {
    const v = object(x, at);
    return {
      kcal: amount(v.kcal, `${at}.kcal`),
      protein: amount(v.protein, `${at}.protein`),
      fat: amount(v.fat, `${at}.fat`),
      carbs: amount(v.carbs, `${at}.carbs`),
      water: amount(v.water, `${at}.water`),
    };
  };
  const product = (o: Record<string, unknown>, at: string): Product => ({
    label: label(o.label, `${at}.label`),
    name: label(o.name, `${at}.name`),
    base: o.base === 'g' || o.base === 'ml' ? o.base : fail(`${at}.base`, 'not g or ml'),
    per_100: per100(o.per_100, `${at}.per_100`),
  });
  const sizedProduct = (o: Record<string, unknown>, at: string): SizedProduct => {
    const unit = object(o.unit, `${at}.unit`);
    return {
      ...product(o, at),
      unit: {
        name: text(unit.name, `${at}.unit.name`),
        size: amount(unit.size, `${at}.unit.size`),
      },
    };
  };
  const size = (o: Record<string, unknown>, at: string): Size => ({
    label: text(o.label, `${at}.label`),
    size: amount(o.size, `${at}.size`),
  });
  const count = (o: Record<string, unknown>, at: string): Count => ({
    label: label(o.label, `${at}.label`),
    count: amount(o.count, `${at}.count`),
  });
  /** A size labelled as the base unit itself ("г") but not 1: noted, for the bench to show. */
  const pieces = (q: Question<Size>, at: string): Question<Size> => {
    const wrong = q.options.find((o) => BASE_UNITS.includes(o.label.toLowerCase()) && o.size !== 1);
    if (wrong) notes.push(`${at}: a size of ${wrong.size} labelled "${wrong.label}"`);
    return q;
  };
  const oneBase = (products: Product[], at: string) => {
    if (new Set(products.map((p) => p.base)).size > 1) fail(at, 'products of different bases');
  };

  function part(x: unknown, at: string): Part {
    const row = object(x, at);
    const keys = Object.keys(row);
    if (keys.length !== 1) fail(at, `a row with ${keys.join(', ') || 'nothing'}`);
    if ('sized_food' in row) {
      const f = object(row.sized_food, `${at}.sized_food`);
      const sized_products = question(f.sized_products, `${at}.sized_products`, sizedProduct);
      oneBase(sized_products.options, `${at}.sized_products`);
      return { sized_food: { sized_products, counts: question(f.counts, `${at}.counts`, count) } };
    }
    if ('food' in row) {
      const f = object(row.food, `${at}.food`);
      const products = question(f.products, `${at}.products`, product);
      oneBase(products.options, `${at}.products`);
      return {
        food: {
          products,
          sizes: pieces(question(f.sizes, `${at}.sizes`, size), `${at}.sizes`),
          counts: question(f.counts, `${at}.counts`, count),
        },
      };
    }
    return fail(at, `not a food: ${keys[0]}`);
  }

  function row(x: unknown, at: string): Row {
    const r = object(x, at);
    if (!('dish' in r)) return part(r, at);
    if (Object.keys(r).length !== 1) fail(at, `a row with ${Object.keys(r).join(', ')}`);
    const d = object(r.dish, `${at}.dish`);
    if (!Array.isArray(d.items) || d.items.length === 0) fail(`${at}.dish`, 'no items');
    return {
      dish: {
        name: label(d.name, `${at}.dish.name`),
        items: (d.items as unknown[]).map((p, i) => part(p, `${at}.dish.items[${i}]`)),
        counts: question(d.counts, `${at}.dish.counts`, count),
      },
    };
  }

  const empty: Meal = { title: '', items: [] };
  try {
    const m = object(raw, 'the meal');
    if (!Array.isArray(m.items)) fail('the meal', 'no items');
    const meal = {
      title: text(m.title, 'title'),
      items: (m.items as unknown[]).map((r, i) => row(r, `items[${i}]`)),
    };
    // An amount no one eats is the model multiplying twice (a weight as a count and a size, a
    // dish's servings counted again in a part): checked at every answer, not only the chosen.
    meal.items.forEach((r, i) => {
      for (const a of extremes(r)) {
        if (a.amount > MAX_AMOUNT || a.kcal > MAX_KCAL) {
          fail(
            `items[${i}] "${rowName(r)}"`,
            `${Math.round(a.amount)} g, ${Math.round(a.kcal)} kcal`,
          );
        }
      }
    });
    return { meal, problems, notes };
  } catch (err) {
    if (!(err instanceof Problem)) throw err;
    problems.push(err.message);
    return { meal: empty, problems, notes };
  }
}

class Problem extends Error {}

// Amounts --------------------------------------------------------------------------------------

/** A question's current answer. */
export function answer<T extends { label: string }>(q: Question<T>): T {
  return q.options.find((o) => o.label === q.chosen) ?? q.options[0]!;
}

export interface Amounts {
  /** In the row's base (g or ml); a dish's is its parts' sum. */
  amount: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  water: number;
}

const ZERO: Amounts = { amount: 0, kcal: 0, protein: 0, fat: 0, carbs: 0, water: 0 };

export function add(a: Amounts, b: Amounts): Amounts {
  return {
    amount: a.amount + b.amount,
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    water: a.water + b.water,
  };
}

/** What a row amounts to with its current answers; `servings` is a dish's count. */
export function amounts(row: Row, servings = 1): Amounts {
  if ('dish' in row) {
    const n = servings * answer(row.dish.counts).count;
    return row.dish.items.reduce((sum, p) => add(sum, amounts(p, n)), ZERO);
  }
  const { product, size } =
    'sized_food' in row
      ? (() => {
          const p = answer(row.sized_food.sized_products);
          return { product: p, size: p.unit.size };
        })()
      : { product: answer(row.food.products), size: answer(row.food.sizes).size };
  const count = answer('sized_food' in row ? row.sized_food.counts : row.food.counts).count;
  const amount = servings * count * size;
  const f = amount / 100;
  const v = product.per_100;
  return {
    amount,
    kcal: v.kcal * f,
    protein: v.protein * f,
    fat: v.fat * f,
    carbs: v.carbs * f,
    water: v.water * f,
  };
}

/** The row's amounts at its largest answers (each question's option with the most). */
function extremes(row: Row): Amounts[] {
  const largest = <T extends { label: string }>(q: Question<T>, value: (o: T) => number) => ({
    ...q,
    chosen: q.options.reduce((a, b) => (value(b) > value(a) ? b : a)).label,
  });
  const big = (p: Part): Part =>
    'sized_food' in p
      ? {
          sized_food: {
            sized_products: largest(p.sized_food.sized_products, (o) => o.unit.size),
            counts: largest(p.sized_food.counts, (o) => o.count),
          },
        }
      : {
          food: {
            products: largest(p.food.products, (o) => o.per_100.kcal),
            sizes: largest(p.food.sizes, (o) => o.size),
            counts: largest(p.food.counts, (o) => o.count),
          },
        };
  if (!('dish' in row)) return [amounts(big(row))];
  // per part, at the dish's largest count: one part's amount is what can't be eaten
  const n = Math.max(...row.dish.counts.options.map((o) => o.count));
  return row.dish.items.map((p) => amounts(big(p), n));
}

export function total(meal: Meal): Amounts {
  return meal.items.reduce((sum, r) => add(sum, amounts(r)), ZERO);
}

/**
 * Not eaten: a "none" kind (all values 0), or a count or size of 0. The phone shows it as "нет"
 * and hides the row's other questions.
 */
export function isNone(row: Row): boolean {
  if ('dish' in row) return answer(row.dish.counts).count === 0;
  if ('sized_food' in row) {
    const p = answer(row.sized_food.sized_products);
    return answer(row.sized_food.counts).count === 0 || p.unit.size === 0 || zero(p.per_100);
  }
  const { products, sizes, counts } = row.food;
  return answer(counts).count === 0 || answer(sizes).size === 0 || zero(answer(products).per_100);
}

const zero = (v: Per100) => Object.values(v).every((x) => x === 0);

/** A row's name: a dish's own, or the chosen product's. */
export function rowName(row: Row): string {
  if ('dish' in row) return row.dish.name;
  return 'sized_food' in row
    ? answer(row.sized_food.sized_products).name
    : answer(row.food.products).name;
}

/** The amount as said: `2 шт.`, `1 grande`, `150 г`; a dish's servings: `×3`. */
export function amountText(row: Row): string {
  if ('dish' in row) return `×${num(answer(row.dish.counts).count)}`;
  if ('sized_food' in row) {
    return `${num(answer(row.sized_food.counts).count)} ${answer(row.sized_food.sized_products).unit.name}`;
  }
  return `${num(answer(row.food.counts).count)} ${answer(row.food.sizes).label}`;
}

// The screen form ------------------------------------------------------------------------------

/**
 * The meal as text, in the screen form of docs/lab-meal-format.md: a row per line with its
 * amount and values, each question with more than one option under it (U a kind with its size,
 * P a kind, S a size, C a count), the chosen one in brackets.
 */
export function screenForm(meal: Meal): string {
  const lines = [`# ${meal.title}`];
  const values = (a: Amounts) =>
    `${Math.round(a.kcal)} kcal · ${num(a.protein)} P · ${num(a.fat)} F · ${num(a.carbs)} C`;
  const ask = <T extends { label: string }>(
    mark: string,
    q: Question<T>,
    indent: string,
    show: (o: T) => string = (o) => o.label,
  ) => {
    if (q.options.length < 2) return;
    const options = q.options.map((o) => (o.label === q.chosen ? `[${show(o)}]` : show(o)));
    lines.push(`${indent}  ${mark} ${q.why}: ${options.join(' / ')}`);
  };
  const show = (row: Row, indent: string, servings: number) => {
    const a = amounts(row, servings);
    const eaten = isNone(row) ? 'нет' : values(a);
    lines.push(`${indent}- ${rowName(row)} — ${amountText(row)} (${eaten})`);
    if ('dish' in row) {
      ask('C', row.dish.counts, indent);
      const n = servings * answer(row.dish.counts).count;
      for (const p of row.dish.items) show(p, `${indent}  `, n);
    } else if ('sized_food' in row) {
      ask(
        'U',
        row.sized_food.sized_products,
        indent,
        (o) => `${o.label}, ${num(o.unit.size)} ${o.base}`,
      );
      ask('C', row.sized_food.counts, indent);
    } else {
      ask('P', row.food.products, indent);
      ask('S', row.food.sizes, indent, (o) => `${o.label} ${num(o.size)}`);
      ask('C', row.food.counts, indent);
    }
  };
  for (const row of meal.items) show(row, '', 1);
  lines.push(`= ${values(total(meal))}`);
  return lines.join('\n');
}

const num = (x: number) => String(Math.round(x * 10) / 10);
