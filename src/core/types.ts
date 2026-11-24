import type { AiTask, Base, Nutrient, Thinking } from '../config';

/**
 * The stored data: the primary form of the data, as in a backup (see docs/backup-format.md).
 * Normalized (every fact once, nothing derived) and always valid. An omitted field is
 * undefined. In memory, lists and objects that a document may omit when empty are always
 * present (empty); they are omitted only when the data is written (see `toDocument`).
 */

/** Nutrient values: an omitted nutrient is not given (counted as 0 for now); 0 is a value. */
export type NutrientValues = Partial<Record<Nutrient, number>>;

/** A unit of a product, in exactly one of its bases: how many g or ml one of it is. */
export type ProductUnit =
  | { g: number; id: string; ml?: never; name: string }
  | { g?: never; id: string; ml: number; name: string };

export interface Product {
  /** The barcode (EAN/UPC digits), when the product was scanned; unique among products. */
  barcode?: string;
  id: string;
  name: string;
  /** Nutrients in 1 g: present when the product can be weighed; never empty. */
  perG?: NutrientValues;
  /** Nutrients in 1 ml: present when the product can be measured in ml; never empty. */
  perMl?: NutrientValues;
  units: ProductUnit[];
}

/** A unit of a recipe: how many of it the whole recipe makes. */
export interface RecipeUnit {
  id: string;
  makes: number;
  name: string;
}

export interface Recipe {
  id: string;
  ingredients: Ingredient[];
  name: string;
  /** At least one: a recipe is eaten only in its own units. */
  units: RecipeUnit[];
}

/** How much of which food, in which of its units. Shared by meals and recipes. */
export interface Ingredient {
  amount: number;
  /** Id of a product or a recipe. */
  food: string;
  /** `g` or `ml` (a product with that base), or the id of one of the food's units. */
  unit: string;
}

/** Anything consumed together, drinks included. */
export interface Meal {
  /** UTC timestamp to the millisecond. */
  consumedAt: string;
  id: string;
  ingredients: Ingredient[];
}

/** Daily targets, applying from the start of the local day containing `setAt`. */
export interface GoalSet {
  /** Omitted: no goals from that day on. */
  perDay?: NutrientValues;
  /** UTC timestamp to the millisecond. */
  setAt: string;
}

/** A button on the day screen that opens a new meal: empty, or with a food in it. */
export type QuickButton =
  { label: string; amount?: never; food?: never; unit?: never } | ({ label: string } & Ingredient);

/**
 * How a model is asked for a task, where it differs from the task's built-in settings
 * (src/ai/tasks.ts): an omitted field is the built-in one, so a better default in a later build
 * reaches everyone who didn't choose otherwise.
 */
export interface ModelSettings {
  /** An id or an alias, as the provider names it (`gemini-3.5-flash-lite`). */
  model?: string;
  thinking?: Thinking;
  /** null: the model's own default. */
  temperature?: number | null;
}

export interface Settings {
  /** Per task; a task not here uses its built-in settings. */
  ai: Partial<Record<AiTask, ModelSettings>>;
  quickButtons: QuickButton[];
}

export interface AppData {
  goals: GoalSet[];
  meals: Meal[];
  products: Product[];
  recipes: Recipe[];
  settings: Settings;
}

/** The base a product unit is in, and how many g or ml one of it is. */
export function unitSize(unit: ProductUnit): { base: Base; size: number } {
  return unit.g !== undefined ? { base: 'g', size: unit.g } : { base: 'ml', size: unit.ml };
}

/** The values of a product per 1 of a base, if it has that base. */
export function valuesPer(product: Product, base: Base): NutrientValues | undefined {
  return base === 'g' ? product.perG : product.perMl;
}
