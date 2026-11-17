import { MASS_UNITS, NUTRIENTS, REQUIRED_NUTRIENTS, SERVING_UNIT, type Nutrient } from '../config';
import { buildFoodTable, FoodTableError } from './nutrition';
import { isClean, nameKey } from './text';
import { isValidDate, isValidDateTime } from './time';
import type { Product, Recipe } from './types';
import { isReservedUnitName } from './units';

/**
 * Checks the stored data (the four lists of a backup) as strictly as an import: shapes,
 * values, unique ids and names, and that every reference resolves. Returns every problem
 * found, each saying where it is; an empty list means the data can be used as it is.
 * Nothing is fixed.
 */
export function validateAppData(doc: Readonly<Record<string, unknown>>): string[] {
  const problems: string[] = [];
  const check = new Checker(problems);

  const goals = check.list(doc.goals, 'goals');
  const products = check.list(doc.products, 'products');
  const recipes = check.list(doc.recipes, 'recipes');
  const meals = check.list(doc.meals, 'meals');

  goals.forEach((g, i) => check.goalSet(g, `goal set #${i + 1}`, goals[i - 1]));
  products.forEach((p, i) => check.product(p, i));
  recipes.forEach((r, i) => check.recipe(r, i));
  meals.forEach((m, i) => check.meal(m, i));

  // References are checked only on well-formed data, so every message has one cause.
  if (problems.length === 0) check.references();
  return problems;
}

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

interface FoodInfo {
  kind: 'product' | 'recipe';
  name: string;
  unitIds: Set<string>;
  hasServings: boolean;
}

class Checker {
  private readonly ids = new Map<string, string>();
  private readonly names = new Map<string, string>();
  private readonly foods = new Map<string, FoodInfo>();
  /** Every ingredient seen, checked against the foods once all of them are known. */
  private readonly ingredients: { where: string; food: unknown; unit: unknown }[] = [];
  private products: Rec[] = [];
  private recipes: Rec[] = [];

  constructor(private readonly problems: string[]) {}

  private problem(where: string, what: string): void {
    this.problems.push(`${where}: ${what}`);
  }

  list(value: unknown, name: string): unknown[] {
    if (Array.isArray(value)) return value;
    this.problems.push(`${name}: ${value === undefined ? 'missing' : 'must be a list'}`);
    return [];
  }

  private record(value: unknown, where: string, fields: readonly string[]): Rec | null {
    if (!isRecord(value)) {
      this.problem(where, 'must be an object');
      return null;
    }
    for (const key of Object.keys(value)) {
      if (!fields.includes(key)) this.problem(where, `unknown field "${key}"`);
    }
    for (const key of fields) {
      if (!(key in value)) this.problem(where, `missing ${key}`);
    }
    return value;
  }

  private id(value: unknown, where: string): void {
    if (typeof value !== 'string' || value === '') {
      this.problem(where, 'id must be a non-empty text');
      return;
    }
    const seen = this.ids.get(value);
    if (seen) this.problem(where, `id ${value} is also used by ${seen}`);
    else this.ids.set(value, where);
  }

  private name(value: unknown, where: string): value is string {
    if (typeof value !== 'string' || value.trim() === '') {
      this.problem(where, 'name must be a non-empty text');
      return false;
    }
    if (!isClean(value)) {
      this.problem(where, 'name has extra spaces or is not in Unicode NFC form');
    }
    return true;
  }

  private nutrients(
    value: unknown,
    where: string,
    { required, positive }: { required: readonly Nutrient[]; positive: boolean },
  ): void {
    if (!isRecord(value)) {
      this.problem(where, 'must be an object');
      return;
    }
    for (const [key, v] of Object.entries(value)) {
      if (!(NUTRIENTS as readonly string[]).includes(key)) {
        this.problem(where, `unknown nutrient "${key}"`);
      } else if (!isNumber(v) || v < 0 || (positive && v === 0)) {
        this.problem(where, `${key} must be a ${positive ? 'positive' : 'non-negative'} number`);
      }
    }
    for (const nutrient of required) {
      if (!(nutrient in value)) this.problem(where, `missing ${nutrient}`);
    }
  }

  private units(value: unknown, where: string, kind: 'product' | 'recipe'): Set<string> {
    const ids = new Set<string>();
    if (!Array.isArray(value)) {
      this.problem(where, 'units must be a list');
      return ids;
    }
    const names = new Set<string>();
    value.forEach((u, i) => {
      const at = `${where}, unit #${i + 1}`;
      const unit = this.record(u, at, ['id', 'name', 'grams']);
      if (!unit) return;
      if (typeof unit.id !== 'string' || unit.id === '') {
        this.problem(at, 'id must be a non-empty text');
      } else if (isReservedUnitName(kind, unit.id)) {
        this.problem(at, `id "${unit.id}" is a built-in unit`);
      } else if (ids.has(unit.id)) {
        this.problem(at, `id "${unit.id}" is used twice`);
      } else {
        ids.add(unit.id);
      }
      if (this.name(unit.name, at)) {
        const key = nameKey(unit.name);
        if (isReservedUnitName(kind, unit.name)) {
          this.problem(at, `"${unit.name}" is a built-in unit`);
        } else if (names.has(key)) {
          this.problem(at, `unit "${unit.name}" is defined twice`);
        }
        names.add(key);
      }
      if (!isNumber(unit.grams) || unit.grams <= 0) {
        this.problem(at, 'grams must be a positive number');
      }
    });
    return ids;
  }

  private ingredientList(value: unknown, where: string): void {
    if (!Array.isArray(value) || value.length === 0) {
      this.problem(where, 'ingredients must be a non-empty list');
      return;
    }
    value.forEach((v, i) => {
      const at = `${where}, ingredient #${i + 1}`;
      const ingredient = this.record(v, at, ['food', 'unit', 'amount']);
      if (!ingredient) return;
      if (typeof ingredient.food !== 'string') this.problem(at, 'food must be a text (an id)');
      if (typeof ingredient.unit !== 'string') this.problem(at, 'unit must be a text');
      if (!isNumber(ingredient.amount) || ingredient.amount < 0) {
        this.problem(at, 'amount must be a non-negative number');
      }
      this.ingredients.push({ where: at, food: ingredient.food, unit: ingredient.unit });
    });
  }

  private food(value: Rec, kind: 'product' | 'recipe', where: string): void {
    this.id(value.id, where);
    const named = this.name(value.name, where);
    if (typeof value.archived !== 'boolean') this.problem(where, 'archived must be true or false');
    const unitIds = this.units(value.units, where, kind);
    if (typeof value.id === 'string' && named) {
      this.foods.set(value.id, {
        kind,
        name: value.name as string,
        unitIds,
        hasServings: kind === 'recipe' && value.servings !== null,
      });
      const key = nameKey(value.name as string);
      const seen = this.names.get(key);
      if (seen) this.problem(where, `name is also used by ${seen}`);
      else this.names.set(key, where);
    }
  }

  private describe(kind: string, value: unknown, index: number): string {
    const name = isRecord(value) && typeof value.name === 'string' ? ` "${value.name}"` : '';
    return `${kind} #${index + 1}${name}`;
  }

  product(value: unknown, index: number): void {
    const where = this.describe('product', value, index);
    const product = this.record(value, where, ['id', 'name', 'per100g', 'units', 'archived']);
    if (!product) return;
    this.products.push(product);
    this.food(product, 'product', where);
    this.nutrients(product.per100g, `${where}, per100g`, {
      required: REQUIRED_NUTRIENTS,
      positive: false,
    });
  }

  recipe(value: unknown, index: number): void {
    const where = this.describe('recipe', value, index);
    const recipe = this.record(value, where, [
      'id',
      'name',
      'ingredients',
      'cookedGrams',
      'servings',
      'units',
      'archived',
    ]);
    if (!recipe) return;
    this.recipes.push(recipe);
    this.food(recipe, 'recipe', where);
    this.ingredientList(recipe.ingredients, where);
    for (const field of ['cookedGrams', 'servings'] as const) {
      const v = recipe[field];
      if (v !== null && (!isNumber(v) || v <= 0)) {
        this.problem(where, `${field} must be a positive number or null`);
      }
    }
  }

  meal(value: unknown, index: number): void {
    const where = `meal #${index + 1}`;
    const meal = this.record(value, where, ['id', 'eatenAt', 'ingredients']);
    if (!meal) return;
    this.id(meal.id, where);
    if (typeof meal.eatenAt !== 'string' || !isValidDateTime(meal.eatenAt)) {
      this.problem(where, 'eatenAt must be a local date and time: YYYY-MM-DDTHH:mm');
    }
    this.ingredientList(meal.ingredients, `${where} (${String(meal.eatenAt)})`);
  }

  goalSet(value: unknown, where: string, previous: unknown): void {
    const set = this.record(value, where, ['from', 'targets']);
    if (!set) return;
    if (typeof set.from !== 'string' || !isValidDate(set.from)) {
      this.problem(where, 'from must be a date: YYYY-MM-DD');
    } else if (
      isRecord(previous) &&
      typeof previous.from === 'string' &&
      previous.from >= set.from
    ) {
      this.problem(
        where,
        `from ${set.from} must be after the previous goal set's ${previous.from}`,
      );
    }
    this.nutrients(set.targets, `${where}, targets`, { required: [], positive: true });
  }

  references(): void {
    for (const { where, food, unit } of this.ingredients) {
      const info = this.foods.get(food as string);
      if (!info) {
        this.problem(where, `refers to food ${String(food)}, which does not exist`);
        continue;
      }
      const valid =
        (unit as string) in MASS_UNITS ||
        (unit === SERVING_UNIT && info.hasServings) ||
        info.unitIds.has(unit as string);
      if (!valid) this.problem(where, `"${info.name}" has no unit "${String(unit)}"`);
    }
    if (this.problems.length > 0) return;
    // Cycles and weightless recipes show up while deriving the foods.
    try {
      // The records are well-formed by now (no problems were found above).
      buildFoodTable(this.products as unknown as Product[], this.recipes as unknown as Recipe[]);
    } catch (err) {
      if (!(err instanceof FoodTableError)) throw err;
      this.problems.push(err.message);
    }
  }
}
