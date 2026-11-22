import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canScan, startScan } from '../barcode';
import { appData, egg } from '../core/testData';
import type { AppData } from '../core/types';
import { lookUpBarcode } from '../data/openFoodFacts';
import { createStore, type Store } from '../state/store';
import { App } from './App';
import { clearDrafts } from './drafts';
import { navigate } from './router';

// The camera and Open Food Facts are replaced: scanning "reads" CODE at once.
const CODE = '4006040002093';
vi.mock('../barcode', () => ({
  canScan: vi.fn(() => true),
  startScan: vi.fn((_video: HTMLVideoElement, onCode: (code: string) => void) => {
    queueMicrotask(() => onCode(CODE));
    return { stop: vi.fn() };
  }),
}));
vi.mock('../data/openFoodFacts', async (original) => ({
  ...(await original<typeof import('../data/openFoodFacts')>()),
  lookUpBarcode: vi.fn(),
}));

let store: Store;
function start(data: AppData = appData(), path = '/product/new') {
  store = createStore(data, vi.fn());
  navigate(path);
  render(<App store={store} />);
}
const input = (label: string) => screen.getByLabelText(label, { exact: true }) as HTMLInputElement;
const scan = () => fireEvent.click(screen.getByRole('button', { name: 'Scan barcode' }));

beforeEach(() => {
  history.replaceState(null, '', '#/');
  clearDrafts();
  vi.mocked(canScan).mockReturnValue(true);
  vi.mocked(startScan).mockClear();
});
afterEach(cleanup);

describe('scanning a barcode in a new product', () => {
  it('fills the name and the macros per 100 g, and keeps the barcode', async () => {
    vi.mocked(lookUpBarcode).mockResolvedValue({
      kind: 'found',
      data: {
        code: CODE,
        names: { de: 'Skyr Natur' },
        language: 'de',
        brands: ['Arla'],
        categories: [],
        per100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4 },
        liquid: false,
      },
    });
    start();
    scan();
    expect(await screen.findByText(/Filled from Open Food Facts, per 100 g/)).toBeTruthy();
    expect(lookUpBarcode).toHaveBeenCalledWith(CODE);
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Skyr Natur (Arla)');
    expect(input('kcal').value).toBe('63');
    expect(input('Protein (g)').value).toBe('11');
    expect(screen.getByText(CODE)).toBeTruthy();
    // the scanner closed after reading the code
    expect(screen.queryByRole('dialog', { name: 'Scan barcode' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    expect(store.data.value.products[0]).toMatchObject({
      barcode: CODE,
      name: 'Skyr Natur (Arla)',
      perG: { carbs: 0.04, fat: 0.002, kcal: 0.63, protein: 0.11 },
    });
    expect(store.data.value.products[0]!.perMl).toBeUndefined();
  });

  it('fills a drink per 100 ml, stored per ml, with nothing per g', async () => {
    vi.mocked(lookUpBarcode).mockResolvedValue({
      kind: 'found',
      data: {
        code: CODE,
        names: { de: 'Milch 1.5%' },
        language: 'de',
        brands: [],
        categories: [],
        per100: { kcal: 47, protein: 3.4 },
        liquid: true,
      },
    });
    start();
    scan();
    expect(await screen.findByText(/per 100 ml: check the values/)).toBeTruthy();
    expect(input('Per amount').value).toBe('100');
    const perUnit = screen.getByLabelText('Per unit') as HTMLSelectElement;
    expect(perUnit.selectedOptions[0]!.textContent).toBe('ml');
    expect(screen.getByRole('button', { name: /per ml/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    const [milk] = store.data.value.products;
    expect(milk).toMatchObject({ perMl: { kcal: 0.47, protein: 0.034 }, units: [] });
    expect(milk!.perG).toBeUndefined();
  });

  it('opens a product already in the library instead of making a duplicate', async () => {
    start(appData({ products: [{ ...egg, barcode: CODE }] }));
    scan();
    expect(await screen.findByText('Already in your library:')).toBeTruthy();
    expect(lookUpBarcode).not.toHaveBeenCalledWith(CODE);
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(await screen.findByRole('heading', { name: 'Product' })).toBeTruthy();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('egg');
  });

  it('adds a product already in the library to the meal it was created for', async () => {
    start(appData({ products: [{ ...egg, barcode: CODE }] }), '/meal/new');
    fireEvent.input(screen.getByLabelText('Find food'), { target: { value: 'Skyr' } });
    fireEvent.click(screen.getByRole('button', { name: '＋ create “Skyr”' }));
    expect(await screen.findByRole('heading', { name: 'New product' })).toBeTruthy();
    scan();
    expect(await screen.findByText('Already in your library:')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add it' }));
    expect(await screen.findByRole('heading', { name: 'New meal' })).toBeTruthy();
    expect(screen.getByText('egg', { selector: '.ingredient-name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('adds a scanned product of mine to a meal right from the food picker', async () => {
    start(appData({ products: [{ ...egg, barcode: CODE }] }), '/meal/new');
    scan();
    expect(await screen.findByText('egg', { selector: '.ingredient-name' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'New meal' })).toBeTruthy();
    expect(lookUpBarcode).not.toHaveBeenCalledWith(CODE);
  });

  it('starts a new product, looked up, for a barcode scanned in a meal that I don’t have', async () => {
    vi.mocked(lookUpBarcode).mockResolvedValue({
      kind: 'found',
      data: {
        code: CODE,
        names: { de: 'Skyr Natur' },
        language: 'de',
        brands: ['Arla'],
        categories: [],
        per100: { kcal: 63, protein: 11 },
        liquid: false,
      },
    });
    start(appData({ products: [egg] }), '/meal/new');
    scan();
    expect(await screen.findByRole('heading', { name: 'New product' })).toBeTruthy();
    expect(await screen.findByText(/Filled from Open Food Facts/)).toBeTruthy();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Skyr Natur (Arla)');
    expect(screen.getByText(CODE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('heading', { name: 'New meal' })).toBeTruthy();
    expect(screen.getByText('Skyr Natur (Arla)', { selector: '.ingredient-name' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save + 1 new food' }));
    await vi.waitFor(() => expect(store.data.value.meals).toHaveLength(1));
    expect(store.data.value.products.find((p) => p.barcode === CODE)?.name).toBe(
      'Skyr Natur (Arla)',
    );
  });

  it('opens a scanned product of mine from the Library’s search', async () => {
    start(appData({ products: [{ ...egg, barcode: CODE }] }), '/library');
    scan();
    expect(await screen.findByRole('heading', { name: 'Product' })).toBeTruthy();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('egg');
  });

  it('starts a new product, looked up, for an unknown barcode scanned in the Library', async () => {
    vi.mocked(lookUpBarcode).mockResolvedValue({
      kind: 'found',
      data: {
        code: CODE,
        names: { de: 'Skyr Natur' },
        language: 'de',
        brands: ['Arla'],
        categories: [],
        per100: { kcal: 63, protein: 11 },
        liquid: false,
      },
    });
    start(appData(), '/library');
    scan();
    expect(await screen.findByRole('heading', { name: 'New product' })).toBeTruthy();
    expect(await screen.findByText(/Filled from Open Food Facts/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    expect(store.data.value.products[0]).toMatchObject({
      barcode: CODE,
      name: 'Skyr Natur (Arla)',
    });
  });

  it('keeps the barcode when Open Food Facts doesn’t know it', async () => {
    vi.mocked(lookUpBarcode).mockResolvedValue({ kind: 'not-found' });
    start();
    scan();
    expect(
      await screen.findByText(
        `${CODE} isn’t in Open Food Facts. Enter the product from its label.`,
      ),
    ).toBeTruthy();
    fireEvent.input(screen.getByLabelText(/^Name/), { target: { value: 'Local bread' } });
    fireEvent.input(input('kcal'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    expect(store.data.value.products[0]).toMatchObject({ barcode: CODE, name: 'Local bread' });
  });

  it('says so when offline', async () => {
    vi.mocked(lookUpBarcode).mockResolvedValue({ kind: 'offline' });
    start();
    scan();
    expect(
      await screen.findByText(
        `Offline: couldn’t look up ${CODE}. Enter the product from its label.`,
      ),
    ).toBeTruthy();
  });

  it('offers no scanning where the browser can’t scan, or when editing', () => {
    vi.mocked(canScan).mockReturnValue(false);
    start();
    expect(screen.queryByRole('button', { name: 'Scan barcode' })).toBeNull();
    cleanup();
    vi.mocked(canScan).mockReturnValue(true);
    start(appData({ products: [egg] }), `/product/${egg.id}`);
    expect(screen.queryByRole('button', { name: 'Scan barcode' })).toBeNull();
  });
});
