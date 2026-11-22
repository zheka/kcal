import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookUpBarcode, parseProduct } from './openFoodFacts';

const skyr = {
  status: 1,
  product: {
    product_name: 'Skyr Natur',
    brands: 'Arla, Arla Foods',
    quantity: '450 g',
    product_quantity_unit: 'g',
    nutriments: {
      'energy-kcal_100g': 63,
      energy_100g: 264,
      proteins_100g: 11,
      fat_100g: 0.2,
      carbohydrates_100g: 4,
    },
  },
};

describe('parseProduct', () => {
  it('takes the name with its brand and the macros per 100 g', () => {
    expect(parseProduct(skyr)).toEqual({
      kind: 'found',
      name: 'Skyr Natur (Arla)',
      per100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4 },
      liquid: false,
    });
  });

  it('keeps one serving’s size when the database gives it', () => {
    const bar = {
      status: 1,
      product: { product_name: 'Bar', serving_quantity: '45', nutriments: {} },
    };
    expect(parseProduct(bar)).toMatchObject({ serving: 45 });
    expect(parseProduct(skyr)).not.toHaveProperty('serving');
  });

  it('does not repeat a brand already in the name', () => {
    const named = { ...skyr, product: { ...skyr.product, product_name: 'Arla Skyr Natur' } };
    expect(parseProduct(named)).toMatchObject({ name: 'Arla Skyr Natur' });
  });

  it('converts kJ to kcal when kcal is missing', () => {
    const kj = { status: 1, product: { product_name: 'Bar', nutriments: { energy_100g: 1674 } } };
    const result = parseProduct(kj);
    expect(result.kind === 'found' && result.per100.kcal).toBeCloseTo(400.1, 1);
  });

  it('recognises drinks, whose values are per 100 ml', () => {
    const milk = {
      status: 1,
      product: { product_name: 'Milch 1.5%', quantity: '1 l', nutriments: {} },
    };
    expect(parseProduct(milk)).toMatchObject({ liquid: true, per100: {} });
    const cola = { status: 1, product: { product_name: 'Cola', product_quantity_unit: 'ml' } };
    expect(parseProduct(cola)).toMatchObject({ liquid: true });
  });

  it('leaves out values that are missing or not numbers', () => {
    const odd = { status: 1, product: { nutriments: { proteins_100g: 'n/a', fat_100g: -1 } } };
    expect(parseProduct(odd)).toEqual({ kind: 'found', name: '', per100: {}, liquid: false });
  });

  it('knows an unknown barcode', () => {
    expect(parseProduct({ status: 0, status_verbose: 'product not found' })).toEqual({
      kind: 'not-found',
    });
  });
});

describe('lookUpBarcode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks Open Food Facts for that barcode only', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(skyr)));
    vi.stubGlobal('fetch', fetch);
    expect(await lookUpBarcode('4006040002093')).toMatchObject({ kind: 'found' });
    expect(fetch.mock.calls[0]![0]).toMatch(
      /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/4006040002093\.json\?fields=/,
    );
  });

  it('tells not found, errors and offline apart', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
    expect(await lookUpBarcode('1')).toEqual({ kind: 'not-found' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    expect(await lookUpBarcode('1')).toEqual({ kind: 'error' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await lookUpBarcode('1')).toEqual({ kind: 'error' });
    vi.stubGlobal('navigator', { onLine: false });
    expect(await lookUpBarcode('1')).toEqual({ kind: 'offline' });
  });
});
