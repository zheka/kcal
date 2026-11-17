import type { Nutrient } from '../config';

/** Nutrient values; a missing nutrient is unknown, not 0. */
export type NutrientValues = Partial<Record<Nutrient, number>>;

/** A unit of one food, defined in grams: `piece = 60 g`, `cup = 250 g`. */
export interface Unit {
  /** Unique within its food; never a built-in unit id. */
  id: string;
  name: string;
  grams: number;
}

/** A food in a recipe or a meal: how much of which food, in which of its units. */
export interface Ingredient {
  /** Id of a product or a recipe. */
  food: string;
  /** A built-in unit (`g`, `kg`, a recipe's `serving`) or the id of one of the food's units. */
  unit: string;
  amount: number;
}

export interface Product {
  id: string;
  name: string;
  /** Nutrients per 100 g, as on the label. */
  per100g: NutrientValues;
  units: Unit[];
  archived: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: Ingredient[];
  /** Weighed weight of the finished dish; null = the sum of the ingredients. */
  cookedGrams: number | null;
  /** How many servings it makes; gives the recipe a `serving` unit. */
  servings: number | null;
  units: Unit[];
  archived: boolean;
}

/** A logged meal: foods taken together. */
export interface Meal {
  id: string;
  /** Local date and time the meal is (to be) eaten: `YYYY-MM-DDTHH:mm`. */
  eatenAt: string;
  ingredients: Ingredient[];
}

/** Daily targets, valid from `from` until the next goal set starts. */
export interface GoalSet {
  /** Local date: `YYYY-MM-DD`. */
  from: string;
  /** Only nutrients with a goal. */
  targets: NutrientValues;
}

/** Everything the app stores (the backup without its header). */
export interface AppData {
  /** Ordered by `from`, strictly increasing. */
  goals: GoalSet[];
  products: Product[];
  recipes: Recipe[];
  meals: Meal[];
}
