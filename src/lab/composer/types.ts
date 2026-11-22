import type { ScannedProductData } from '../../data/openFoodFacts';

/**
 * The meal composer experiment's records (kept in its lab data, see data.ts). Items are
 * parametric, as the model returns them (prompt-v3.txt): everything after that, picking a
 * variant, editing an amount, removing an item, is recomputed on the phone (recompute.ts). Kept
 * apart from the app's data, which the experiment only reads.
 */

/** Nutrients per 100 g (or 100 ml) of an item. `water_ml` only where hydration is material. */
export interface Per100 {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  water_ml: number | null;
}

/** One answer to a parameter, with what it changes, if anything. */
export interface Variant {
  label: string;
  per_100g: Per100 | null;
  grams_per_unit: number | null;
}

/** A question about an item, with its answer: `default` is the variant chosen now. */
export interface Parameter {
  name: string;
  variants: Variant[];
  default: string;
  surfaced: boolean;
  why: string;
}

export type Source = 'visual' | 'published' | 'history';

/**
 * One food in a meal. `count` and each parameter's `default` are the current answers: the model
 * sets them, and the user's edits change them in place, so the item sent back to the model as
 * "meal so far" carries the answers.
 */
export interface Item {
  name: string;
  count: number;
  unit: string;
  grams_per_unit: number;
  per_100g: Per100;
  source: Source;
  amount_flag: boolean;
  likely_counts: number[];
  parameters: Parameter[];
}

/** What the model returns. */
export interface Answer {
  meal_label: string;
  items: Item[];
  dropped: string[];
  out_of_focus: string[];
}

/** What the meal is composed from, as attached (already prepared: photos shrunk, codes looked up). */
export type Attached =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'photo'; file: string }
  /** A scanned barcode: what Open Food Facts says about it, as it is. */
  | { id: string; kind: 'product'; product: ScannedProductData };

export interface ComposedMeal {
  id: string;
  /** For the list: the model's meal label. */
  title: string;
  /** When the meal was started (UTC). */
  at: string;
  context: Attached[];
  /** The model's last answer, as adjusted since. */
  items: Item[];
  /** The context changed since the items were answered: Update sends it all. */
  changed: boolean;
  /** Why the last update failed, until the context changes or an update works. */
  failed?: string;
}
