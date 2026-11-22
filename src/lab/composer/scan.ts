import type { FoundProduct } from '../../data/openFoodFacts';
import type { AppData, Product } from '../../core/types';
import type { Per100, ScannedProduct } from './types';

/**
 * A scanned barcode's product: my product with that barcode first (its label values), else what
 * Open Food Facts gives (see productFromLookup). Null when my foods don't have it.
 */
export function productFromFoods(code: string, app: AppData | null): ScannedProduct | null {
  const product = app?.products.find((p) => p.barcode === code);
  return product ? fromProduct(code, product) : null;
}

function fromProduct(code: string, product: Product): ScannedProduct {
  const liquid = !product.perG && !!product.perMl;
  const unit = product.units[0];
  const serving = unit ? (liquid ? unit.ml : unit.g) : undefined;
  return {
    code,
    from: 'my foods',
    name: product.name,
    liquid,
    per_100: per100(product.perG ?? product.perMl ?? {}),
    ...(serving !== undefined && { serving }),
  };
}

/** A product found on Open Food Facts. */
export function productFromLookup(code: string, found: FoundProduct): ScannedProduct {
  const v = found.per100;
  return {
    code,
    from: 'Open Food Facts',
    name: found.name || code,
    liquid: found.liquid,
    per_100: {
      kcal: v.kcal ?? 0,
      protein: v.protein ?? 0,
      fat: v.fat ?? 0,
      carbs: v.carbs ?? 0,
      water_ml: null,
    },
    ...(found.serving !== undefined && { serving: found.serving }),
  };
}

/** The app's values per 1 g or ml, as values per 100. */
function per100(v: {
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  water?: number;
}): Per100 {
  const x = (n: number | undefined) => Math.round((n ?? 0) * 100 * 1000) / 1000;
  return {
    kcal: x(v.kcal),
    protein: x(v.protein),
    fat: x(v.fat),
    carbs: x(v.carbs),
    water_ml: v.water ? x(v.water) : null,
  };
}
