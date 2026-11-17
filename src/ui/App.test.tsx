import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appData, egg, ing, meal, milk, oatFlakes, recipe } from '../core/testData';
import type { AppData } from '../core/types';
import { serializeBackup } from '../data/backup';
import { createStore, type Store } from '../state/store';
import { App } from './App';
import { ProblemScreen } from './ProblemScreen';
import { clearDrafts } from './drafts';
import { navigate } from './router';

let store: Store;

function start(data: AppData = appData(), path = '/') {
  store = createStore(data, vi.fn());
  navigate(path);
  render(<App store={store} />);
}

const type = (el: HTMLElement, value: string) => fireEvent.input(el, { target: { value } });
const field = (label: string) => screen.getByLabelText(label, { exact: false });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  history.replaceState(null, '', '#/');
  clearDrafts();
});
afterEach(cleanup);

describe('products', () => {
  it('creates a product from its label and lists it in the library', async () => {
    start(appData(), '/library');
    click('＋ Product');
    type(field('Name'), '  Skyr  natural ');
    type(field('kcal'), '63');
    type(field('Protein'), '11');
    click('Save');

    expect(await screen.findByText('Skyr natural')).toBeTruthy();
    expect(screen.getByText('63 kcal · 11 g protein / 100 g')).toBeTruthy();
    expect(store.data.value.products[0]).toMatchObject({
      name: 'Skyr natural',
      per100g: { kcal: 63, protein: 11 },
      units: [],
    });
  });

  it('converts values copied per unit, e.g. a bar’s column, to per 100 g', async () => {
    start(appData(), '/product/new');
    type(field('Name'), 'Protein bar');
    click('＋ Add unit');
    type(field('Unit name'), 'bar');
    type(field('Grams in 1 bar'), '45');
    fireEvent.change(field('Per unit'), { target: { value: 'u1' } });
    expect((field('Per amount') as HTMLInputElement).value).toBe('1');
    type(field('kcal'), '190');
    type(field('Protein'), '9');
    click('Save');

    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    expect(store.data.value.products[0]).toMatchObject({
      per100g: { kcal: 422.222, protein: 20 },
      units: [{ id: 'u1', name: 'bar', grams: 45 }],
    });
  });

  it('explains what is missing instead of saving', () => {
    start(appData({ products: [egg] }), '/product/new');
    click('Save');
    expect(screen.getByText('Add a name')).toBeTruthy();
    expect(screen.getByText('Add kcal')).toBeTruthy();
    type(field('Name'), 'EGG');
    type(field('Protein'), 'lots');
    click('Save');
    expect(screen.getByText('“egg” already exists')).toBeTruthy();
    expect(screen.getByText('Not a number')).toBeTruthy();
    expect(store.data.value.products).toEqual([egg]);
  });

  it('hints at a typo when kcal and macros disagree', () => {
    start(appData(), '/product/new');
    type(field('kcal'), '143');
    type(field('Protein'), '126');
    type(field('Fat'), '9.5');
    type(field('Carbs'), '0.7');
    expect(screen.getByText(/The macros give about 592 kcal/)).toBeTruthy();
  });

  it('warns that editing a used product changes what uses it, and offers no delete', () => {
    start(
      appData({ products: [egg], meals: [meal('2026-11-17T08:00', [ing(egg, 2, 'u1')])] }),
      `/product/${egg.id}`,
    );
    expect(screen.getByText(/Used in 1 meal and 0 recipes: saving changes them too/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect((screen.getByLabelText('Remove unit piece') as HTMLButtonElement).disabled).toBe(true);
  });

  it('deletes an unused product with two taps', async () => {
    start(appData({ products: [egg] }), `/product/${egg.id}`);
    click('Delete');
    expect(store.data.value.products).toHaveLength(1);
    click('Tap again to delete');
    await vi.waitFor(() => expect(store.data.value.products).toEqual([]));
  });
});

describe('recipes', () => {
  it('composes a recipe from chips, with live totals, and saves it', async () => {
    start(appData({ products: [oatFlakes, milk] }), '/recipe/new');
    type(field('Name'), 'Oats');
    const chips = screen.getByLabelText('Foods');
    fireEvent.click(within(chips).getByText('oat flakes'));
    // Never used before: 100 g.
    expect((field('Amount of oat flakes') as HTMLInputElement).value).toBe('100');
    type(field('Amount of oat flakes'), '60');
    fireEvent.click(within(chips).getByText('milk'));
    // milk has its own unit (ml), so it starts at 1 ml.
    fireEvent.change(field('Unit of milk'), { target: { value: 'g' } });
    type(field('Amount of milk'), '200');
    type(field('Servings'), '1');

    // 60 g oat flakes (222 kcal) + 200 g milk (128 kcal)
    const kcalRow = screen.getByText('kcal', { selector: '.totals th' }).closest('tr')!;
    expect(kcalRow.textContent).toBe('kcal350350135');
    expect(screen.getByText('Weighs 260 g: the sum of its ingredients.')).toBeTruthy();

    click('Save');
    await vi.waitFor(() => expect(store.data.value.recipes).toHaveLength(1));
    expect(store.data.value.recipes[0]).toMatchObject({
      name: 'Oats',
      ingredients: [ing(oatFlakes, 60), ing(milk, 200)],
      servings: 1,
      cookedGrams: null,
    });
  });

  it('creates a missing product from the picker and adds it, keeping the recipe', async () => {
    start(appData({ products: [oatFlakes] }), '/recipe/new');
    type(field('Name'), 'Oats with skyr');
    fireEvent.click(within(screen.getByLabelText('Foods')).getByText('oat flakes'));
    type(field('Find food'), 'Skyr');
    click('＋ create “Skyr”');

    expect(await screen.findByText('New product')).toBeTruthy();
    expect((field('Name') as HTMLInputElement).value).toBe('Skyr');
    type(field('kcal'), '63');
    click('Save');

    expect(await screen.findByText('New recipe')).toBeTruthy();
    expect((field('Name') as HTMLInputElement).value).toBe('Oats with skyr');
    expect(screen.getByText('oat flakes', { selector: '.ingredient-name' })).toBeTruthy();
    expect(screen.getByText('Skyr', { selector: '.ingredient-name' })).toBeTruthy();
  });

  it('adds a unit to a food right from an ingredient row', async () => {
    start(appData({ products: [oatFlakes] }), '/recipe/new');
    fireEvent.click(within(screen.getByLabelText('Foods')).getByText('oat flakes'));
    fireEvent.change(field('Unit of oat flakes'), { target: { value: '__new__' } });
    type(field('New unit name'), 'cup');
    type(field('New unit grams'), '80');
    click('Add unit');

    await vi.waitFor(() =>
      expect(store.data.value.products[0]!.units).toEqual([{ id: 'u1', name: 'cup', grams: 80 }]),
    );
    expect((field('Unit of oat flakes') as HTMLSelectElement).value).toBe('u1');
    expect((field('Amount of oat flakes') as HTMLInputElement).value).toBe('1');
  });

  it('does not offer recipes that would contain themselves', () => {
    const oats = recipe('oats', [ing(oatFlakes, 60)]);
    start(appData({ products: [oatFlakes], recipes: [oats] }), `/recipe/${oats.id}`);
    const chips = screen.getByLabelText('Foods');
    expect(within(chips).queryByText('oats')).toBeNull();
    expect(within(chips).getByText('oat flakes')).toBeTruthy();
  });
});

describe('backup', () => {
  it('imports a backup after a two-tap confirmation', async () => {
    start(appData(), '/menu');
    const backup = serializeBackup(appData({ products: [egg] }), new Date());
    fireEvent.change(field('Import backup'), {
      target: { files: [new File([backup], 'kcal-backup.json')] },
    });
    expect(await screen.findByText(/kcal-backup.json: 1 product, 0 recipes, 0 meals/)).toBeTruthy();
    click('Replace my data');
    click('Tap again to replace');
    expect(await screen.findByText('Imported.')).toBeTruthy();
    expect(store.data.value.products).toEqual([egg]);
  });

  it('refuses a broken backup, listing its problems', async () => {
    start(appData({ products: [egg] }), '/menu');
    fireEvent.change(field('Import backup'), {
      target: { files: [new File(['{"version":"kcal 0.1.0"}'], 'bad.json')] },
    });
    expect(await screen.findByText('Import refused: 4 problems')).toBeTruthy();
    expect(screen.getByText('products: missing')).toBeTruthy();
    expect(store.data.value.products).toEqual([egg]);
  });
});

describe('problem screen', () => {
  it('lists the problems and starts fresh only after a second tap', () => {
    const onStartFresh = vi.fn();
    render(<ProblemScreen problems={['meals: missing']} raw="{}" onStartFresh={onStartFresh} />);
    expect(screen.getByText('meals: missing')).toBeTruthy();
    click('Start fresh');
    expect(onStartFresh).not.toHaveBeenCalled();
    click('Tap again to delete saved data');
    expect(onStartFresh).toHaveBeenCalledOnce();
  });
});
