import type { Nutrient } from '../config';
import type { NutrientAmount } from './nutrition';

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

/** Rounds stored values so conversions don't store noise like 422.22222222. */
export function roundStored(n: number): number {
  return Number(n.toFixed(3));
}

/** A nutrient amount for display: kcal whole, grams with one decimal below 10. */
export function formatNutrientValue(value: number, nutrient: Nutrient): string {
  if (nutrient === 'kcal') return formatNumber(value, 0);
  return formatNumber(value, value < 10 ? 1 : 0);
}

/** A total that may include unknowns: `≥ 102` when some food lacked the nutrient. */
export function formatAmount(amount: NutrientAmount, nutrient: Nutrient): string {
  const text = formatNutrientValue(amount.value, nutrient);
  return amount.missing > 0 ? `≥ ${text}` : text;
}
