/**
 * Reads the model's answer (schema.ts) forgivingly: whatever can be used is used, what can't is
 * dropped or filled in, and each such repair is a flag (shown by the bench and the CLI, kept in
 * the log). Never throws. Also flags what looks wrong but is kept: values that don't add up, an
 * amount nobody eats.
 */

export interface Per100 {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Water to drink (ml): from drinks and soups; 0 for food. The app's water nutrient. */
  water: number;
}

/** A food as eaten: its amount is (count ?? 1) × size, in its base. */
export interface Product {
  name: string;
  base: 'g' | 'ml';
  /** Pieces; null for loose food and stated weights. */
  count: number | null;
  /** The piece as counted (шт., ломт.). */
  unit: string | null;
  /** A size name: a menu size, a named portion. */
  alias: string | null;
  /** One piece when counted, else the whole amount. */
  size: number;
  per_100: Per100;
}

export interface Item extends Product {
  /** Whole products it could be instead, as the model gave them (sparse ones filled in). */
  alternatives: Product[];
}

export interface Dish {
  name: string;
  items: Item[];
}

export interface Meal {
  title: string;
  dishes: Dish[];
}

/** More than this in one product, g or ml or kcal, is the model multiplying twice. */
export const MAX_AMOUNT = 3000;
export const MAX_KCAL = 3000;

type Obj = Record<string, unknown>;

const isObject = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isAmount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const textOrNull = (x: unknown): string | null =>
  typeof x === 'string' && x.trim() ? x.trim() : null;

/** The keys of answers before the flat schema (2026-11-23), as they are now. */
const OLD_KEYS: Record<string, string> = {
  basis_unit: 'base_unit',
  count: 'piece_count',
  unit_name: 'piece_name',
  amount_alias: 'piece_size_name',
  unit_amount: 'base_units_in_piece',
};
const OLD_PER_100: Record<string, string> = {
  calories: 'kcal_per_100_base_units',
  protein_g: 'protein_g_per_100_base_units',
  carbs_g: 'carbs_g_per_100_base_units',
  fat_g: 'fat_g_per_100_base_units',
  hydration_ml: 'hydration_ml_per_100_base_units', // water_g was the water content: not read
};

/** An old answer's product with today's keys (saved runs and logs read again); a new one as is. */
function upgraded(x: Obj): Obj {
  const out: Obj = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === 'per_100' && isObject(v)) {
      for (const [pk, pv] of Object.entries(v)) if (OLD_PER_100[pk]) out[OLD_PER_100[pk]] = pv;
    } else out[OLD_KEYS[k] ?? k] = v;
  }
  return out;
}

export function readMeal(raw: unknown): { meal: Meal; flags: string[] } {
  const flags: string[] = [];
  const flag = (at: string, what: string) => flags.push(`${at}: ${what}`);

  if (!isObject(raw)) {
    flag('the answer', 'not an object');
    return { meal: { title: '', dishes: [] }, flags };
  }

  /** The values per 100 base units; an alternative's missing ones are its item's. */
  function per100(x: Obj, at: string, inherit?: Per100): Per100 {
    const value = (key: string, name: keyof Per100) => {
      const v = x[key];
      if (isAmount(v)) return v;
      if (inherit && v === undefined) return inherit[name];
      flag(`${at}.${key}`, `${JSON.stringify(v)}, 0 used`);
      return 0;
    };
    const water = value('hydration_ml_per_100_base_units', 'water');
    if (water > 100) flag(`${at}.hydration_ml_per_100_base_units`, `${water}, over 100: 100 used`);
    return {
      kcal: value('kcal_per_100_base_units', 'kcal'),
      protein: value('protein_g_per_100_base_units', 'protein'),
      fat: value('fat_g_per_100_base_units', 'fat'),
      carbs: value('carbs_g_per_100_base_units', 'carbs'),
      water: Math.min(water, 100),
    };
  }

  /** A product; an alternative's missing fields are its item's. Null when it has no amount. */
  function product(given: unknown, at: string, of?: Product): Product | null {
    if (!isObject(given)) {
      flag(at, 'not an object, dropped');
      return null;
    }
    const x = upgraded(given);
    const has = (key: string) => key in x && x[key] !== undefined;
    const name = textOrNull(x.name) ?? of?.name ?? null;
    if (name === null) flag(`${at}.name`, 'missing');
    let base: 'g' | 'ml';
    if (x.base_unit === 'g' || x.base_unit === 'ml') base = x.base_unit;
    else {
      base = of?.base ?? 'g';
      if (!of || has('base_unit'))
        flag(`${at}.base_unit`, `${JSON.stringify(x.base_unit)}, ${base} used`);
    }
    let count: number | null;
    if (has('piece_count')) {
      if (x.piece_count === null) count = null;
      else if (isAmount(x.piece_count)) count = x.piece_count;
      else {
        count = null;
        flag(`${at}.piece_count`, `${JSON.stringify(x.piece_count)}, none used`);
      }
    } else count = of ? of.count : null;
    const size = isAmount(x.base_units_in_piece) ? x.base_units_in_piece : (of?.size ?? null);
    if (size === null) {
      flag(at, `"${name ?? '?'}": no base_units_in_piece, dropped`);
      return null;
    }
    const p: Product = {
      name: name ?? '?',
      base,
      count,
      unit: has('piece_name') ? textOrNull(x.piece_name) : (of?.unit ?? null),
      alias: has('piece_size_name') ? textOrNull(x.piece_size_name) : (of?.alias ?? null),
      size,
      per_100: per100(x, at, of?.per_100),
    };
    check(p, at);
    return p;
  }

  /** Kept, but worth a look: values that don't add up, an amount nobody eats. */
  function check(p: Product, at: string) {
    const v = p.per_100;
    const atwater = 4 * v.protein + 4 * v.carbs + 9 * v.fat;
    if (
      Math.max(v.kcal, atwater) > 30 &&
      Math.abs(v.kcal - atwater) > 0.3 * Math.max(v.kcal, atwater)
    ) {
      flag(at, `"${p.name}": ${v.kcal} kcal per 100, but its macros make ${Math.round(atwater)}`);
    }
    const mass = v.protein + v.fat + v.carbs + v.water;
    if (p.base === 'g' && mass > 105) flag(at, `"${p.name}": ${Math.round(mass)} g of 100 g`);
    const amount = (p.count ?? 1) * p.size;
    const kcal = (amount * v.kcal) / 100;
    if (amount > MAX_AMOUNT || kcal > MAX_KCAL) {
      flag(at, `"${p.name}": ${Math.round(amount)} ${p.base}, ${Math.round(kcal)} kcal`);
    }
    if (p.count === 0) flag(at, `"${p.name}": count 0`);
  }

  function item(x: unknown, at: string): Item | null {
    const p = product(x, at);
    if (!p) return null;
    const raw = isObject(x) ? x.alternatives : undefined;
    if (raw !== undefined && !Array.isArray(raw)) flag(`${at}.alternatives`, 'not a list, dropped');
    const alternatives: Product[] = [];
    for (const [i, a] of (Array.isArray(raw) ? raw : []).entries()) {
      const alt = product(a, `${at}.alternatives[${i}]`, p);
      if (!alt) continue;
      if ([p, ...alternatives].some((o) => same(o, alt))) {
        flag(`${at}.alternatives[${i}]`, `"${alt.name}": the same as one before, dropped`);
        continue;
      }
      alternatives.push(alt);
    }
    return { ...p, alternatives };
  }

  let rawDishes: unknown = raw.dishes;
  if (!Array.isArray(rawDishes) && Array.isArray(raw.products)) {
    flag('the answer', 'products with no dishes, one dish used');
    rawDishes = [{ name: textOrNull(raw.title) ?? '', products: raw.products }];
  }
  if (!Array.isArray(rawDishes)) flag('the answer', 'no dishes');
  const dishes: Dish[] = [];
  for (const [i, d] of (Array.isArray(rawDishes) ? rawDishes : []).entries()) {
    const at = `dishes[${i}]`;
    if (!isObject(d)) {
      flag(at, 'not an object, dropped');
      continue;
    }
    if (!Array.isArray(d.products)) flag(at, 'no products');
    const items = (Array.isArray(d.products) ? d.products : [])
      .map((p, j) => item(p, `${at}.products[${j}]`))
      .filter((p): p is Item => p !== null);
    if (items.length === 0) {
      flag(at, 'empty, dropped');
      continue;
    }
    const name = textOrNull(d.name);
    if (!name) flag(`${at}.name`, 'missing');
    dishes.push({ name: name ?? items[0]!.name, items });
  }
  const title = textOrNull(raw.title);
  if (!title) flag('title', 'missing');
  return { meal: { title: title ?? '', dishes }, flags };
}

/** The same product: every field equal (values within rounding). */
export function same(a: Product, b: Product): boolean {
  return (
    sameName(a, b) &&
    a.base === b.base &&
    a.count === b.count &&
    a.alias === b.alias &&
    close(a.size, b.size) &&
    samePer100(a.per_100, b.per_100)
  );
}

export const sameName = (a: Product, b: Product) => a.name.toLowerCase() === b.name.toLowerCase();

export const samePer100 = (a: Per100, b: Per100) =>
  (Object.keys(a) as (keyof Per100)[]).every((k) => close(a[k], b[k]));

/** Equal within rounding: 1, or 3 % of the larger. */
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, 0.03 * Math.max(a, b));
