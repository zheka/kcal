/**
 * What the app tracks, built into the code. Saved data that uses something removed from here
 * fails the check on load.
 */

/**
 * The app's name, written exactly so everywhere: lowercase, like the unit, even at the start of
 * a sentence.
 */
export const APP_NAME = 'kcal';

/** Nutrients, in display order. Each is an amount per g or per ml of a product. */
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

/** The bases a product can be measured in: grams and millilitres. Reserved as unit names. */
export const GRAMS = 'g';
export const MILLILITRES = 'ml';
export const BASES = [GRAMS, MILLILITRES] as const;
export type Base = (typeof BASES)[number];

/** A quick button's label is at most this many characters as seen (grapheme clusters). */
export const LABEL_MAX_CHARS = 12;

/** Decimals every stored number may have at most. */
export const STORED_DECIMALS = 3;
