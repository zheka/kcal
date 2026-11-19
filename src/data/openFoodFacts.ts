import type { NutrientValues } from '../core/types';
import { cleanText, nameKey } from '../core/text';

/**
 * Looking up a scanned barcode on Open Food Facts (https://world.openfoodfacts.org), the free
 * open database of food products. Only the barcode is sent. The result fills the product form;
 * nothing is stored until the user saves.
 */

export interface FoundProduct {
  kind: 'found';
  /** Name with brand, e.g. "Skyr Natur (Arla)"; empty when the database has none. */
  name: string;
  /** Nutrients per 100 g, or per 100 ml when `liquid`; only those the database gives. */
  per100: NutrientValues;
  /** A drink: values are per 100 ml. */
  liquid: boolean;
}

export type LookupResult =
  | FoundProduct
  | { kind: 'not-found' }
  /** No connection. */
  | { kind: 'offline' }
  | { kind: 'error' };

const FIELDS = 'product_name,brands,quantity,product_quantity_unit,nutriments';

export async function lookUpBarcode(barcode: string, timeoutMs = 10_000): Promise<LookupResult> {
  if (!navigator.onLine) return { kind: 'offline' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
      { signal: controller.signal },
    );
    if (response.status === 404) return { kind: 'not-found' };
    if (!response.ok) return { kind: 'error' };
    return parseProduct(await response.json());
  } catch {
    return navigator.onLine ? { kind: 'error' } : { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the API's answer: `{ status: 1, product: { … } }`, or status 0 when unknown. */
export function parseProduct(json: unknown): LookupResult {
  const answer = json as { status?: number; product?: Record<string, unknown> };
  if (answer?.status !== 1 || !answer.product) return { kind: 'not-found' };
  const p = answer.product;
  const nutriments = (p.nutriments ?? {}) as Record<string, unknown>;
  const number = (key: string) => {
    const v = nutriments[key];
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const per100: NutrientValues = {};
  // kcal, or converted from kJ when only that is given
  const kcal = number('energy-kcal_100g');
  const kj = number('energy-kj_100g') ?? number('energy_100g');
  if (kcal !== undefined) per100.kcal = kcal;
  else if (kj !== undefined) per100.kcal = kj / 4.184;
  const protein = number('proteins_100g');
  const fat = number('fat_100g');
  const carbs = number('carbohydrates_100g');
  if (protein !== undefined) per100.protein = protein;
  if (fat !== undefined) per100.fat = fat;
  if (carbs !== undefined) per100.carbs = carbs;

  return { kind: 'found', name: productName(p), per100, liquid: isLiquid(p) };
}

function productName(p: Record<string, unknown>): string {
  const name = typeof p.product_name === 'string' ? cleanText(p.product_name) : '';
  const brand = typeof p.brands === 'string' ? cleanText(p.brands.split(',')[0] ?? '') : '';
  if (!brand) return name;
  if (!name) return brand;
  return nameKey(name).includes(nameKey(brand)) ? name : `${name} (${brand})`;
}

/** Drinks are sold by volume: their values are per 100 ml. */
function isLiquid(p: Record<string, unknown>): boolean {
  if (typeof p.product_quantity_unit === 'string') {
    return p.product_quantity_unit.trim().toLowerCase() === 'ml';
  }
  return typeof p.quantity === 'string' && /\d\s*(ml|cl|dl|l)\b/i.test(p.quantity);
}
