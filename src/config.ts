/**
 * What the app tracks and offers, built into the code. Saved data that uses something removed
 * from here fails the check on load.
 */

export const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs'] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

/** Nutrients every product must have. The others may be unknown (absent, not 0). */
export const REQUIRED_NUTRIENTS: readonly Nutrient[] = ['kcal'];

/** How each nutrient's amount is shown. */
export const NUTRIENT_UNIT: Readonly<Record<Nutrient, string>> = {
  kcal: 'kcal',
  protein: 'g',
  fat: 'g',
  carbs: 'g',
};

/** Built-in measurement units: every food has them, they are never stored. Grams per unit. */
export const MASS_UNITS: Readonly<Record<string, number>> = { g: 1, kg: 1000 };

/** Built-in unit of a recipe that says how many servings it makes. */
export const SERVING_UNIT = 'serving';
