import type { NutrientValues } from '../core/types';
import { cleanText, nameKey } from '../core/text';
import { withRetries } from './retry';

/**
 * Looking up a scanned barcode on Open Food Facts (https://world.openfoodfacts.org), the free
 * open database of food products. Only the barcode is sent. The result fills the product form
 * (nothing is stored until the user saves), and the lab sends it to the model as it is.
 */

/**
 * What Open Food Facts says about a product: its data only, in a shape of ours. What helps tell
 * which product it is (on a photo, from a text), its nutrition as we track it, and its name in
 * the language to answer in.
 */
export interface ScannedProductData {
  code: string;
  /** The product's language, of what's printed on it (`de`). */
  language?: string;
  /**
   * Names by language: the product's language (`unknown` when not given), and the answer language
   * when someone gave it.
   */
  names: Record<string, string>;
  /** What kind of product it is, often printed under the name (`generic_name`). */
  description?: string;
  /** All its brands, in the database's order (`Danone, Activia`). */
  brands: string[];
  /** Categories in Open Food Facts' taxonomy, general to specific (`en:skyrs`). */
  categories: string[];
  /** The ingredients as printed (product language). */
  ingredients?: string;
  /** The pack size as printed: `450 g`, `6 x 125 g`. */
  quantity?: string;
  /** One serving as printed: `1 Riegel (45 g)`. */
  servingSize?: string;
  /** One serving in g (ml for a drink). */
  serving?: number;
  /** A drink: values per 100 ml, serving in ml. */
  liquid: boolean;
  /** Label values per 100 g (or 100 ml); only those the database gives. */
  per100: NutrientValues;
}

export type LookupResult =
  | { kind: 'found'; data: ScannedProductData }
  | { kind: 'not-found' }
  /** No connection. */
  | { kind: 'offline' }
  | { kind: 'error' };

const FIELDS = [
  'lang',
  'product_name',
  'generic_name',
  'brands',
  'categories_tags',
  'ingredients_text',
  'quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'nutriments',
];

/** Waits before each new try of a busy or unreachable Open Food Facts. */
export const LOOKUP_RETRY_DELAYS_MS = [1_000, 3_000];
/** How long one try may take. */
export const LOOKUP_TIMEOUT_MS = 8_000;

/** Statuses of a busy or failing server: worth another try. */
const BUSY = [429, 500, 502, 503, 504];

export interface LookupOptions {
  /** The language to answer in: its name is asked for too (`ru`). */
  language?: string;
  timeoutMs?: number;
  /** Before another try (from 2), of how many. */
  onRetry?: (attempt: number, of: number) => void;
  wait?: (ms: number) => Promise<void>;
}

class Retriable extends Error {}

export async function lookUpBarcode(
  barcode: string,
  options: LookupOptions = {},
): Promise<LookupResult> {
  const { language, timeoutMs = LOOKUP_TIMEOUT_MS, onRetry, wait } = options;
  if (!navigator.onLine) return { kind: 'offline' };
  const fields = [...FIELDS, ...(language ? [`product_name_${language}`] : [])].join(',');
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${fields}`;

  const once = async (): Promise<LookupResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 404) return { kind: 'not-found' };
      if (BUSY.includes(response.status)) throw new Retriable(`HTTP ${response.status}`);
      if (!response.ok) return { kind: 'error' };
      return parseProduct(await response.json(), barcode, language);
    } catch (err) {
      if (err instanceof Retriable) throw err;
      // timed out, or the network failed while online: worth another try
      if (navigator.onLine) throw new Retriable(String(err));
      return { kind: 'offline' };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await withRetries(once, {
      delays: LOOKUP_RETRY_DELAYS_MS,
      retriable: (err) => err instanceof Retriable && navigator.onLine,
      onRetry: (_err, attempt, of) => onRetry?.(attempt, of),
      ...(wait && { wait }),
    });
  } catch {
    return navigator.onLine ? { kind: 'error' } : { kind: 'offline' };
  }
}

/** Reads the API's answer: `{ status: 1, product: { … } }`, or status 0 when unknown. */
export function parseProduct(json: unknown, code: string, language?: string): LookupResult {
  const answer = json as { status?: number; product?: Record<string, unknown> };
  if (answer?.status !== 1 || !answer.product) return { kind: 'not-found' };
  const p = answer.product;
  const text = (key: string) => {
    const v = p[key];
    return typeof v === 'string' && cleanText(v) ? cleanText(v) : undefined;
  };

  const productLanguage = text('lang');
  const names: Record<string, string> = {};
  const name = text('product_name');
  if (name) names[productLanguage ?? 'unknown'] = name;
  const answerName = language ? text(`product_name_${language}`) : undefined;
  if (language && answerName) names[language] = answerName;

  const serving = number(p.serving_quantity);
  const description = text('generic_name');
  const ingredients = text('ingredients_text');
  const quantity = text('quantity');
  const servingSize = text('serving_size');
  const data: ScannedProductData = {
    code,
    ...(productLanguage && { language: productLanguage }),
    names,
    ...(description && { description }),
    brands: (text('brands') ?? '')
      .split(',')
      .map((b) => cleanText(b))
      .filter(Boolean),
    categories: Array.isArray(p.categories_tags)
      ? p.categories_tags.filter((c): c is string => typeof c === 'string')
      : [],
    ...(ingredients && { ingredients }),
    ...(quantity && { quantity }),
    ...(servingSize && { servingSize }),
    ...(serving !== undefined && serving > 0 && { serving }),
    liquid: isLiquid(p),
    per100: per100((p.nutriments ?? {}) as Record<string, unknown>),
  };
  return { kind: 'found', data };
}

/** The label values we track, per 100 g or ml: kcal (from kJ when only that is given), macros. */
function per100(nutriments: Record<string, unknown>): NutrientValues {
  const get = (key: string) => number(nutriments[key]);
  const values: NutrientValues = {};
  const kcal = get('energy-kcal_100g');
  const kj = get('energy-kj_100g') ?? get('energy_100g');
  if (kcal !== undefined) values.kcal = kcal;
  else if (kj !== undefined) values.kcal = kj / 4.184;
  const protein = get('proteins_100g');
  const fat = get('fat_100g');
  const carbs = get('carbohydrates_100g');
  if (protein !== undefined) values.protein = protein;
  if (fat !== undefined) values.fat = fat;
  if (carbs !== undefined) values.carbs = carbs;
  return values;
}

function number(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * A name for the product form: the name in `language` (else the product's own) with its first
 * brand, e.g. "Skyr Natur (Arla)"; empty when the database has neither.
 */
export function formName(data: ScannedProductData, language?: string): string {
  const name =
    (language && data.names[language]) ||
    (data.language && data.names[data.language]) ||
    Object.values(data.names)[0] ||
    '';
  const brand = data.brands[0] ?? '';
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
