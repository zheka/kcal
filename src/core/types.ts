import type { Nutrient } from '../config';

/**
 * The stored data: the primary form of the data, exactly as in a backup (see
 * docs/backup-format.md). Normalized (every fact once, nothing derived) and always valid.
 * An omitted field is undefined; an omitted nutrient counts as 0.
 */

export type NutrientValues = Partial<Record<Nutrient, number>>;

/** A unit of a product: how many grams one of it weighs. */
export interface ProductUnit {
  grams: number;
  id: string;
  name: string;
}

export interface Product {
  /** The barcode (EAN/UPC digits), when the product was scanned; unique among products. */
  barcode?: string;
  id: string;
  name: string;
  /** Nutrients in 1 g of the product. */
  perGram: NutrientValues;
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
  /** Id of a product, a recipe or a built-in food. */
  food: string;
  /** `g` (products and built-in foods), `ml` (water), or the id of one of the food's units. */
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

export interface AppData {
  goals: GoalSet[];
  meals: Meal[];
  products: Product[];
  recipes: Recipe[];
}
