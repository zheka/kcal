import { afterEach, describe, expect, it, vi } from 'vitest';
import { formName, lookUpBarcode, parseProduct, type ScannedProductData } from './openFoodFacts';

const CODE = '4006040002093';
const skyr = {
  status: 1,
  product: {
    lang: 'de',
    product_name: 'Skyr Natur',
    product_name_ru: 'Скир натуральный',
    generic_name: 'Fermentiertes Milchprodukt',
    brands: 'Arla, Arla Foods',
    categories_tags: ['en:dairies', 'en:skyrs'],
    ingredients_text: 'Magermilch, Sahne, Milchsäurebakterien',
    quantity: '450 g',
    product_quantity_unit: 'g',
    serving_size: '150 g',
    serving_quantity: '150',
    nutriments: {
      'energy-kcal_100g': 63,
      energy_100g: 264,
      proteins_100g: 11,
      fat_100g: 0.2,
      carbohydrates_100g: 4,
      sugars_100g: 4,
    },
    // returned though not asked for: left out
    nutriments_estimated: { calcium_100g: 0.1 },
  },
};
const data = (json: object, language?: string): ScannedProductData => {
  const result = parseProduct(json, CODE, language);
  if (result.kind !== 'found') throw new Error('not found');
  return result.data;
};

describe('parseProduct', () => {
  it('keeps what tells the product apart, its label values we track, its names', () => {
    expect(data(skyr, 'ru')).toEqual({
      code: CODE,
      language: 'de',
      names: { de: 'Skyr Natur', ru: 'Скир натуральный' },
      description: 'Fermentiertes Milchprodukt',
      brands: ['Arla', 'Arla Foods'],
      categories: ['en:dairies', 'en:skyrs'],
      ingredients: 'Magermilch, Sahne, Milchsäurebakterien',
      quantity: '450 g',
      servingSize: '150 g',
      serving: 150,
      liquid: false,
      per100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4 },
    });
  });

  it('has the product’s name only, when there is none in the answer language', () => {
    expect(data(skyr, 'fr').names).toEqual({ de: 'Skyr Natur' });
    expect(data(skyr).names).toEqual({ de: 'Skyr Natur' });
  });

  it('converts kJ to kcal when kcal is missing', () => {
    const kj = { status: 1, product: { product_name: 'Bar', nutriments: { energy_100g: 1674 } } };
    expect(data(kj).per100.kcal).toBeCloseTo(400.1, 1);
  });

  it('recognises drinks, whose values are per 100 ml', () => {
    const milk = { status: 1, product: { product_name: 'Milch 1.5%', quantity: '1 l' } };
    expect(data(milk)).toMatchObject({ liquid: true, per100: {} });
    const cola = { status: 1, product: { product_name: 'Cola', product_quantity_unit: 'ml' } };
    expect(data(cola)).toMatchObject({ liquid: true });
  });

  it('leaves out values that are missing or not numbers', () => {
    const odd = { status: 1, product: { nutriments: { proteins_100g: 'n/a', fat_100g: -1 } } };
    expect(data(odd)).toEqual({
      code: CODE,
      names: {},
      brands: [],
      categories: [],
      liquid: false,
      per100: {},
    });
  });

  it('knows an unknown barcode', () => {
    expect(parseProduct({ status: 0, status_verbose: 'product not found' }, CODE)).toEqual({
      kind: 'not-found',
    });
  });
});

describe('the name for the product form', () => {
  it('is the name with its first brand, not repeated', () => {
    expect(formName(data(skyr))).toBe('Skyr Natur (Arla)');
    expect(formName(data(skyr, 'ru'), 'ru')).toBe('Скир натуральный (Arla)');
    const named = { ...skyr, product: { ...skyr.product, product_name: 'Arla Skyr Natur' } };
    expect(formName(data(named))).toBe('Arla Skyr Natur');
    expect(formName(data({ status: 1, product: {} }))).toBe('');
  });
});

describe('lookUpBarcode', () => {
  afterEach(() => vi.unstubAllGlobals());
  const noWait = { wait: async () => {} };

  it('asks Open Food Facts for that barcode only, with the answer language’s name', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(skyr)));
    vi.stubGlobal('fetch', fetch);
    expect(await lookUpBarcode(CODE, { language: 'ru' })).toMatchObject({ kind: 'found' });
    const url = fetch.mock.calls[0]![0] as string;
    expect(url).toMatch(
      /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/4006040002093\.json\?fields=/,
    );
    expect(url).toContain('product_name_ru');
    expect(url).toContain('categories_tags');
  });

  it('tries a busy or unreachable server again, then gives up', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify(skyr)));
    vi.stubGlobal('fetch', fetch);
    const onRetry = vi.fn();
    expect(await lookUpBarcode(CODE, { ...noWait, onRetry })).toMatchObject({ kind: 'found' });
    expect(onRetry.mock.calls).toEqual([
      [2, 3],
      [3, 3],
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    expect(await lookUpBarcode(CODE, noWait)).toEqual({ kind: 'error' });
  });

  it('tells not found, errors and offline apart, without trying again', async () => {
    const notFound = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    vi.stubGlobal('fetch', notFound);
    expect(await lookUpBarcode('1', noWait)).toEqual({ kind: 'not-found' });
    expect(notFound).toHaveBeenCalledTimes(1);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 400 })));
    expect(await lookUpBarcode('1', noWait)).toEqual({ kind: 'error' });
    vi.stubGlobal('navigator', { onLine: false });
    expect(await lookUpBarcode('1', noWait)).toEqual({ kind: 'offline' });
  });
});
