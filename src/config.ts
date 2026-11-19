/**
 * What the app tracks, built into the code. Saved data that uses something removed from here
 * fails the check on load.
 */

/**
 * The app's name, written exactly so everywhere: lowercase, like the unit, even at the start of
 * a sentence.
 */
export const APP_NAME = 'kcal';

/** Nutrients, in display order. Each is a number per gram of a food; omitted counts as 0. */
export const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs', 'water'] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

/** How each nutrient's amount is shown. */
export const NUTRIENT_UNIT: Readonly<Record<Nutrient, string>> = {
  kcal: 'kcal',
  protein: 'g',
  fat: 'g',
  carbs: 'g',
  water: 'ml',
};

export const NUTRIENT_LABEL: Readonly<Record<Nutrient, string>> = {
  kcal: 'kcal',
  protein: 'Protein',
  fat: 'Fat',
  carbs: 'Carbs',
  water: 'Water',
};

/** The unit every product and built-in food has: grams. Reserved as a product unit name. */
export const GRAMS = 'g';
/** Built-in water's second unit: millilitres, equal to grams. */
export const MILLILITRES = 'ml';

/** Decimals every stored number may have at most. */
export const STORED_DECIMALS = 3;
