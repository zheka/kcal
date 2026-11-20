import type { AppData, Product } from '../core/types';

/**
 * Unsaved forms, kept while the user leaves them for another screen (e.g. to create a
 * product for a recipe) and dropped on save or cancel.
 */
const drafts = new Map<string, unknown>();

export function loadDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined;
}

export function keepDraft(key: string, draft: unknown): void {
  drafts.set(key, draft);
}

export function dropDraft(key: string): void {
  drafts.delete(key);
}

/**
 * A product form opened from a meal or recipe: it works on the data as that draft sees it
 * (with its pending foods), edits `product` if given (a pending one) and hands its result
 * back instead of saving it.
 */
export interface ProductRequest {
  data: AppData;
  product?: Product;
  /** A barcode scanned in the draft's food picker that isn't in the library: look it up. */
  barcode?: string;
}

/** What a product form opened from a draft hands back: a product, or a food to add. */
export type HandOver = { product: Product } | { food: string };

let request: ProductRequest | null = null;
let handedOver: HandOver | null = null;

export function requestProduct(r: ProductRequest): void {
  request = r;
}

export function productRequest(): ProductRequest | null {
  return request;
}

export function handOver(h: HandOver): void {
  handedOver = h;
  request = null;
}

export function takeHandOver(): HandOver | null {
  const h = handedOver;
  handedOver = null;
  return h;
}

/** Forgets every draft (tests). */
export function clearDrafts(): void {
  drafts.clear();
  request = null;
  handedOver = null;
}
