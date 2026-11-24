import {
  AI_TASKS,
  BASES,
  LABEL_MAX_CHARS,
  NUTRIENTS,
  TEMPERATURE_MAX,
  THINKING,
  type Base,
} from '../config';
import { isStoredPrecision } from './decimal';
import { buildFoodTable, FoodTableError } from './nutrition';
import { charCount, isClean, nameKey } from './text';
import { isValidUtc } from './time';
import type { Product, Recipe } from './types';
import { isReservedProductUnitName } from './units';

/**
 * Checks the stored data (the four lists of a document) as strictly as an import: fields,
 * values, unique ids and names, and that every reference resolves (see
 * docs/backup-format.md). Returns every problem found, each saying where it is; an empty list
 * means the data can be used as it is. Nothing is fixed.
 */
export function validateAppData(data: object): string[] {
  const doc = data as Readonly<Record<string, unknown>>;
  const problems: string[] = [];
  const check = new Checker(problems);

  const goals = check.list(doc.goals, 'goals');
  const meals = check.list(doc.meals, 'meals');
  const products = check.list(doc.products, 'products');
  const recipes = check.list(doc.recipes, 'recipes');
  const settings = check.settings(doc.settings);

  goals.forEach((g, i) => check.goalSet(g, i, goals[i - 1]));
  products.forEach((p, i) => check.product(p, i));
  recipes.forEach((r, i) => check.recipe(r, i));
  meals.forEach((m, i) => check.meal(m, i));
  settings.quickButtons.forEach((b, i) => check.quickButton(b, i));

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
  /** Unit ids an ingredient may use: the product's bases and the food's own units. */
  unitIds: Set<string>;
}

class Checker {
  private readonly ids = new Map<string, string>();
  private readonly names = new Map<string, string>();
  private readonly barcodes = new Map<string, string>();
  private readonly foods = new Map<string, FoodInfo>();
  /** Every ingredient seen, checked against the foods once all of them are known. */
  private readonly ingredients: { where: string; food: string; unit: string }[] = [];
  private readonly products: Rec[] = [];
  private readonly recipes: Rec[] = [];

  constructor(private readonly problems: string[]) {}

  private problem(where: string, what: string): void {
    this.problems.push(`${where}: ${what}`);
  }

  /** An optional list: omitted means empty. */
  list(value: unknown, name: string): unknown[] {
    if (value === undefined || Array.isArray(value)) return value ?? [];
    this.problems.push(`${name}: must be a list`);
    return [];
  }

  settings(value: unknown): { quickButtons: unknown[] } {
    if (value === undefined) return { quickButtons: [] };
    const settings = this.record(value, 'settings', [], ['ai', 'quickButtons']);
    if (settings?.ai !== undefined) this.ai(settings.ai);
    return { quickButtons: this.list(settings?.quickButtons, 'settings, quickButtons') };
  }

  /** Model settings per task: known tasks only, each with only what it overrides. */
  private ai(value: unknown): void {
    const ai = this.record(value, 'settings, ai', [], AI_TASKS);
    if (!ai) return;
    for (const task of AI_TASKS) {
      if (ai[task] === undefined) continue;
      const where = `settings, ai, ${task}`;
      const s = this.record(ai[task], where, [], ['model', 'temperature', 'thinking']);
      if (!s) continue;
      const { model, temperature, thinking } = s;
      if ('model' in s && (typeof model !== 'string' || !model || !isClean(model))) {
        this.problem(where, 'model must be a model id');
      }
      if ('thinking' in s && !(THINKING as readonly unknown[]).includes(thinking)) {
        this.problem(where, `thinking must be one of ${THINKING.join(', ')}`);
      }
      const inRange = isNumber(temperature) && temperature >= 0 && temperature <= TEMPERATURE_MAX;
      if ('temperature' in s && temperature !== null && !inRange) {
        this.problem(where, `temperature must be null or a number from 0 to ${TEMPERATURE_MAX}`);
      }
    }
  }

  /** An object with exactly these required and optional fields. */
  private record(
    value: unknown,
    where: string,
    required: readonly string[],
    optional: readonly string[] = [],
  ): Rec | null {
    if (!isRecord(value)) {
      this.problem(where, 'must be an object');
      return null;
    }
    for (const key of Object.keys(value)) {
      if (!required.includes(key) && !optional.includes(key)) {
        this.problem(where, `unknown field "${key}"`);
      }
    }
    for (const key of required) {
      if (!(key in value)) this.problem(where, `missing ${key}`);
    }
    return value;
  }

  /** A number with at most 3 decimals, positive or non-negative. */
  private number(value: unknown, where: string, field: string, positive: boolean): void {
    if (!isNumber(value) || value < 0 || (positive && value === 0)) {
      this.problem(where, `${field} must be a ${positive ? 'positive' : 'non-negative'} number`);
    } else if (!isStoredPrecision(value)) {
      this.problem(where, `${field} has more than 3 decimals`);
    }
  }

  private id(value: unknown, where: string): value is string {
    if (typeof value !== 'string' || value === '') {
      this.problem(where, 'id must be a non-empty text');
      return false;
    }
    const seen = this.ids.get(value);
    if (seen) {
      this.problem(where, `id ${value} is also used by ${seen}`);
      return false;
    }
    this.ids.set(value, where);
    return true;
  }

  private name(value: unknown, where: string, field = 'name'): value is string {
    if (typeof value !== 'string' || value.trim() === '') {
      this.problem(where, `${field} must be a non-empty text`);
      return false;
    }
    if (!isClean(value)) {
      this.problem(where, `${field} has extra spaces or is not in Unicode NFC form`);
    }
    return true;
  }

  private nutrients(value: unknown, where: string, positive: boolean, nonEmpty = false): void {
    if (!isRecord(value)) {
      this.problem(where, 'must be an object');
      return;
    }
    if (nonEmpty && Object.keys(value).length === 0) {
      this.problem(where, 'must have at least one nutrient');
    }
    for (const [key, v] of Object.entries(value)) {
      if (!(NUTRIENTS as readonly string[]).includes(key)) {
        this.problem(where, `unknown nutrient "${key}"`);
      } else {
        this.number(v, where, key, positive);
      }
    }
  }

  private describe(kind: string, value: unknown, index: number): string {
    const name = isRecord(value) && typeof value.name === 'string' ? ` "${value.name}"` : '';
    return `${kind} #${index + 1}${name}`;
  }

  /**
   * The fields products and recipes share: id, name, units (each with id and name). `unitIds`
   * starts with the units every such food has (a product's bases).
   */
  private food(
    value: Rec,
    kind: 'product' | 'recipe',
    where: string,
    unitFields: { required: string[]; optional?: string[] },
    checkUnit: (unit: Rec, at: string) => void,
    unitIds = new Set<string>(),
  ): void {
    const hasId = this.id(value.id, where);
    const named = this.name(value.name, where);
    if (named) {
      const key = nameKey(value.name as string);
      const seen = this.names.get(key);
      if (seen) {
        this.problem(where, `name is also used by ${seen}`);
      } else {
        this.names.set(key, where);
      }
    }
    // A product's units may be omitted (none); a recipe needs at least one.
    const units = kind === 'product' && value.units === undefined ? [] : value.units;
    if (!Array.isArray(units)) {
      this.problem(where, 'units must be a list');
    } else {
      if (kind === 'recipe' && units.length === 0) {
        this.problem(where, 'needs at least one unit: recipes are eaten only in their own units');
      }
      const unitNames = new Set<string>();
      units.forEach((u, i) => {
        const at = `${where}, unit #${i + 1}`;
        const unit = this.record(u, at, unitFields.required, unitFields.optional);
        if (!unit) return;
        if (this.id(unit.id, at)) unitIds.add(unit.id as string);
        if (this.name(unit.name, at)) {
          const key = nameKey(unit.name as string);
          if (unitNames.has(key)) this.problem(at, `unit "${unit.name}" is defined twice`);
          unitNames.add(key);
        }
        checkUnit(unit, at);
      });
    }
    if (hasId && named)
      this.foods.set(value.id as string, { kind, name: value.name as string, unitIds });
  }

  private ingredientList(value: unknown, where: string): void {
    if (!Array.isArray(value) || value.length === 0) {
      this.problem(where, 'ingredients must be a non-empty list');
      return;
    }
    value.forEach((v, i) => {
      const at = `${where}, ingredient #${i + 1}`;
      const ingredient = this.record(v, at, ['amount', 'food', 'unit']);
      if (!ingredient) return;
      this.number(ingredient.amount, at, 'amount', true);
      if (typeof ingredient.food !== 'string') this.problem(at, 'food must be a text (an id)');
      if (typeof ingredient.unit !== 'string') this.problem(at, 'unit must be a text');
      if (typeof ingredient.food === 'string' && typeof ingredient.unit === 'string') {
        this.ingredients.push({ where: at, food: ingredient.food, unit: ingredient.unit });
      }
    });
  }

  product(value: unknown, index: number): void {
    const where = this.describe('product', value, index);
    const product = this.record(
      value,
      where,
      ['id', 'name'],
      ['barcode', 'perG', 'perMl', 'units'],
    );
    if (!product) return;
    this.products.push(product);
    const field: Record<Base, string> = { g: 'perG', ml: 'perMl' };
    const bases = BASES.filter((b) => field[b] in product);
    if (bases.length === 0) {
      this.problem(where, 'needs perG, perMl or both: the values per g or per ml');
    }
    for (const b of bases) this.nutrients(product[field[b]], `${where}, ${field[b]}`, false, true);
    this.food(
      product,
      'product',
      where,
      { required: ['id', 'name'], optional: ['g', 'ml'] },
      (unit, at) => {
        if (typeof unit.name === 'string' && isReservedProductUnitName(unit.name)) {
          this.problem(at, `"${unit.name}" is reserved: g and ml are a product's bases`);
        }
        const unitBases = BASES.filter((b) => b in unit);
        if (unitBases.length !== 1) {
          this.problem(at, 'needs exactly one of g and ml: how many g or ml one of it is');
          return;
        }
        const base = unitBases[0]!;
        this.number(unit[base], at, base, true);
        if (!bases.includes(base)) {
          this.problem(at, `is in ${base}, but the product has no ${field[base]}`);
        }
      },
      new Set(bases),
    );
    if ('barcode' in product) this.barcode(product.barcode, where);
  }

  /** A barcode: 8 to 14 digits (EAN-8, UPC, EAN-13, GTIN-14), unique among products. */
  private barcode(value: unknown, where: string): void {
    if (typeof value !== 'string' || !/^\d{8,14}$/.test(value)) {
      this.problem(where, 'barcode must be 8 to 14 digits');
      return;
    }
    const seen = this.barcodes.get(value);
    if (seen) this.problem(where, `barcode ${value} is also used by ${seen}`);
    else this.barcodes.set(value, where);
  }

  recipe(value: unknown, index: number): void {
    const where = this.describe('recipe', value, index);
    const recipe = this.record(value, where, ['id', 'ingredients', 'name', 'units']);
    if (!recipe) return;
    this.recipes.push(recipe);
    this.food(recipe, 'recipe', where, { required: ['id', 'makes', 'name'] }, (unit, at) =>
      this.number(unit.makes, at, 'makes', true),
    );
    this.ingredientList(recipe.ingredients, where);
  }

  meal(value: unknown, index: number): void {
    const where = `meal #${index + 1}`;
    const meal = this.record(value, where, ['consumedAt', 'id', 'ingredients']);
    if (!meal) return;
    this.id(meal.id, where);
    const valid = typeof meal.consumedAt === 'string' && isValidUtc(meal.consumedAt);
    if (!valid)
      this.problem(where, 'consumedAt must be a UTC timestamp like 2026-11-17T07:30:41.512Z');
    this.ingredientList(meal.ingredients, valid ? `${where} (${String(meal.consumedAt)})` : where);
  }

  /** A quick button: a label, and optionally a food with an amount and unit. */
  quickButton(value: unknown, index: number): void {
    const where = `quick button #${index + 1}`;
    const button = this.record(value, where, ['label'], ['amount', 'food', 'unit']);
    if (!button) return;
    if (this.name(button.label, where, 'label') && charCount(button.label) > LABEL_MAX_CHARS) {
      this.problem(where, `label must be at most ${LABEL_MAX_CHARS} characters`);
    }
    const given = ['amount', 'food', 'unit'].filter((f) => f in button);
    if (given.length === 0) return;
    if (given.length < 3) {
      this.problem(where, 'needs food, amount and unit together, or none of them');
      return;
    }
    this.number(button.amount, where, 'amount', true);
    if (typeof button.food !== 'string') this.problem(where, 'food must be a text (an id)');
    if (typeof button.unit !== 'string') this.problem(where, 'unit must be a text');
    if (typeof button.food === 'string' && typeof button.unit === 'string') {
      this.ingredients.push({ where, food: button.food, unit: button.unit });
    }
  }

  goalSet(value: unknown, index: number, previous: unknown): void {
    const where = `goal set #${index + 1}`;
    const set = this.record(value, where, ['setAt'], ['perDay']);
    if (!set) return;
    if (typeof set.setAt !== 'string' || !isValidUtc(set.setAt)) {
      this.problem(where, 'setAt must be a UTC timestamp like 2026-11-17T07:30:41.512Z');
    } else if (
      isRecord(previous) &&
      typeof previous.setAt === 'string' &&
      previous.setAt >= set.setAt
    ) {
      this.problem(
        where,
        `setAt ${set.setAt} must be after the previous goal set's ${previous.setAt}`,
      );
    }
    if ('perDay' in set) this.nutrients(set.perDay, `${where}, perDay`, true);
  }

  references(): void {
    for (const { where, food, unit } of this.ingredients) {
      const info = this.foods.get(food);
      if (!info) {
        this.problem(where, `refers to food ${food}, which does not exist`);
      } else if (!info.unitIds.has(unit)) {
        this.problem(where, `"${info.name}" has no unit "${unit}"`);
      }
    }
    if (this.problems.length > 0) return;
    // Recipes that contain each other show up while deriving.
    try {
      const products = this.products.map((p) => ({ ...p, units: p.units ?? [] }));
      buildFoodTable(products as unknown as Product[], this.recipes as unknown as Recipe[]);
    } catch (err) {
      if (!(err instanceof FoodTableError)) throw err;
      this.problems.push(err.message);
    }
  }
}
