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

/** A size: one piece (or the whole amount, as one piece), with its name if it has one. */
export interface Size {
  /** A menu size, a portion (M, grande, large). */
  name: string | null;
  /** In the item's base. */
  amount: number;
}

/** A food or drink an item may be: its size, the smallest and largest it likely is, its values. */
export interface Food {
  name: string;
  size: Size;
  smaller: Size | null;
  larger: Size | null;
  per_100: Per100;
}

/** A product of a dish, as the model perceived it: how many, of what it may be. */
export interface Item {
  base: 'g' | 'ml';
  /** Pieces; null for loose food and stated weights. */
  count: number | null;
  /** The fewest and the most pieces it likely is; null when the count is certain. */
  fewer: number | null;
  more: number | null;
  /** The piece as counted (шт., ломт.). */
  unit: string | null;
  /** What it may be: the model's guess first, then its alternative products. */
  foods: Food[];
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

export function readMeal(raw: unknown): { meal: Meal; flags: string[] } {
  const flags: string[] = [];
  const flag = (at: string, what: string) => flags.push(`${at}: ${what}`);

  if (!isObject(raw)) {
    flag('the answer', 'not an object');
    return { meal: { title: '', dishes: [] }, flags };
  }

  /** The values per 100 base units; water to drink at most 100. */
  function per100(x: Obj, at: string): Per100 {
    const value = (key: string) => {
      const v = x[key];
      if (isAmount(v)) return v;
      flag(`${at}.${key}`, `${JSON.stringify(v)}, 0 used`);
      return 0;
    };
    const water = value('hydration_ml_per_100_base_units');
    if (water > 100) flag(`${at}.hydration_ml_per_100_base_units`, `${water}, over 100: 100 used`);
    return {
      kcal: value('kcal_per_100_base_units'),
      protein: value('protein_g_per_100_base_units'),
      fat: value('fat_g_per_100_base_units'),
      carbs: value('carbs_g_per_100_base_units'),
      water: Math.min(water, 100),
    };
  }

  /**
   * A bound of a guess (the fewest or most pieces, the smallest or largest size): null when there
   * is none, or it is the guess itself; dropped, flagged, when it is on the wrong side.
   */
  function bound(x: Obj, key: string, guess: number, side: -1 | 1, at: string): number | null {
    const v = x[key];
    if (v === null) return null;
    if (v === undefined) {
      flag(`${at}.${key}`, 'missing, none used');
      return null;
    }
    if (!isAmount(v)) {
      flag(`${at}.${key}`, `${JSON.stringify(v)}, none used`);
      return null;
    }
    if (v === guess) return null;
    if (Math.sign(v - guess) !== side) {
      flag(`${at}.${key}`, `${v}, not ${side < 0 ? 'under' : 'over'} ${guess}: dropped`);
      return null;
    }
    return v;
  }

  /** A size bound with its name: a name with no size is dropped, flagged. */
  function sizeBound(x: Obj, side: 'smaller' | 'larger', guess: number, at: string): Size | null {
    const amount = bound(x, `${side}_base_units_in_piece`, guess, side === 'smaller' ? -1 : 1, at);
    const name = textOrNull(x[`${side}_piece_size_name`]);
    if (amount === null) {
      if (name && x[`${side}_base_units_in_piece`] === null)
        flag(`${at}.${side}_piece_size_name`, `"${name}" with no size, dropped`);
      return null;
    }
    return { name, amount };
  }

  /** A food: the product's own or an alternative product. Null when it has no size. */
  function food(x: Obj, at: string): Food | null {
    const name = textOrNull(x.name);
    if (name === null) flag(`${at}.name`, 'missing');
    const amount = x.base_units_in_piece;
    if (!isAmount(amount)) {
      flag(at, `"${name ?? '?'}": no base_units_in_piece, dropped`);
      return null;
    }
    return {
      name: name ?? '?',
      size: { name: textOrNull(x.piece_size_name), amount },
      smaller: sizeBound(x, 'smaller', amount, at),
      larger: sizeBound(x, 'larger', amount, at),
      per_100: per100(x, at),
    };
  }

  /** Kept, but worth a look: values that don't add up, an amount nobody eats. */
  function check(f: Food, item: Item, at: string) {
    const v = f.per_100;
    const atwater = 4 * v.protein + 4 * v.carbs + 9 * v.fat;
    if (
      Math.max(v.kcal, atwater) > 30 &&
      Math.abs(v.kcal - atwater) > 0.3 * Math.max(v.kcal, atwater)
    ) {
      flag(at, `"${f.name}": ${v.kcal} kcal per 100, but its macros make ${Math.round(atwater)}`);
    }
    const mass = v.protein + v.fat + v.carbs + v.water;
    if (item.base === 'g' && mass > 105) flag(at, `"${f.name}": ${Math.round(mass)} g of 100 g`);
    const amount = (item.count ?? 1) * f.size.amount;
    const kcal = (amount * v.kcal) / 100;
    if (amount > MAX_AMOUNT || kcal > MAX_KCAL) {
      flag(at, `"${f.name}": ${Math.round(amount)} ${item.base}, ${Math.round(kcal)} kcal`);
    }
  }

  function item(x: unknown, at: string): Item | null {
    if (!isObject(x)) {
      flag(at, 'not an object, dropped');
      return null;
    }
    const guess = food(x, at);
    if (!guess) return null;
    let base: 'g' | 'ml' = 'g';
    if (x.base_unit === 'g' || x.base_unit === 'ml') base = x.base_unit;
    else flag(`${at}.base_unit`, `${JSON.stringify(x.base_unit)}, g used`);
    let count: number | null = null;
    if (isAmount(x.piece_count)) count = x.piece_count;
    else if (x.piece_count !== null) {
      flag(`${at}.piece_count`, `${JSON.stringify(x.piece_count)}, none used`);
    }
    if (count === 0) flag(at, `"${guess.name}": count 0`);
    const counted = count !== null && count > 0 ? count : null;
    const it: Item = {
      base,
      count,
      fewer: counted !== null ? bound(x, 'fewer_piece_count', counted, -1, at) : null,
      more: counted !== null ? bound(x, 'more_piece_count', counted, 1, at) : null,
      unit: textOrNull(x.piece_name),
      foods: [guess],
    };
    check(guess, it, at);

    const raw = x.alternative_products;
    if (raw !== undefined && !Array.isArray(raw)) {
      flag(`${at}.alternative_products`, 'not a list, dropped');
    }
    for (const [i, a] of (Array.isArray(raw) ? raw : []).entries()) {
      const there = `${at}.alternative_products[${i}]`;
      if (!isObject(a)) {
        flag(there, 'not an object, dropped');
        continue;
      }
      const alt = food(a, there);
      if (!alt) continue;
      if (it.foods.some((f) => f.name.toLowerCase() === alt.name.toLowerCase())) {
        flag(there, `"${alt.name}": named as one before, dropped`);
        continue;
      }
      check(alt, it, there);
      it.foods.push(alt);
    }
    return it;
  }

  const rawDishes: unknown = raw.dishes;
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
    dishes.push({ name: name ?? items[0]!.foods[0]!.name, items });
  }
  const title = textOrNull(raw.title);
  if (!title) flag('title', 'missing');
  return { meal: { title: title ?? '', dishes }, flags };
}
