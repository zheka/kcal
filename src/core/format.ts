import { NUTRIENT_UNIT, type Nutrient } from '../config';

/**
 * Reads a typed number: digits with an optional decimal point or comma (`2.5`, `2,5`, `.5`).
 * Returns null for empty or anything else, negative numbers included.
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}

/** A number with at most `decimals` decimals, without trailing zeros: 2.50 → `2.5`. */
export function formatNumber(n: number, decimals: number): string {
  return String(Number(n.toFixed(decimals)));
}

/** A nutrient amount for display: kcal and water whole, grams with one decimal below 10. */
export function formatNutrientValue(value: number, nutrient: Nutrient): string {
  if (nutrient === 'kcal' || nutrient === 'water') return formatNumber(value, 0);
  return formatNumber(value, value < 10 ? 1 : 0);
}

/** An amount with its unit: `690 kcal`, `48 g protein`, `330 ml water`. */
export function formatNutrient(value: number, nutrient: Nutrient): string {
  const v = formatNutrientValue(value, nutrient);
  return nutrient === 'kcal' ? `${v} kcal` : `${v} ${NUTRIENT_UNIT[nutrient]} ${nutrient}`;
}
