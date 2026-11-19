import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appData, egg, ing, makes, meal, milk, oatFlakes, recipe } from '../core/testData';
import type { AppData } from '../core/types';
import { serializeBackup } from '../data/backup';
import { createStore, type Store } from '../state/store';
import { App } from './App';
import { clearDrafts } from './drafts';
import { ProblemScreen } from './ProblemScreen';
import { navigate } from './router';

let store: Store;

function start(data: AppData = appData(), path = '/') {
  store = createStore(data, vi.fn());
  navigate(path);
  render(<App store={store} />);
}

const type = (el: HTMLElement, value: string) => fireEvent.input(el, { target: { value } });
const field = (label: string) => screen.getByLabelText(label, { exact: false });
/** The food's own name (not a unit's). */
const nameField = () => screen.getByLabelText(/^Name/);
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const chip = (name: string) =>
  fireEvent.click(within(screen.getByLabelText('Foods')).getByText(name));

beforeEach(() => {
  history.replaceState(null, '', '#/');
  clearDrafts();
});
afterEach(cleanup);

describe('products', () => {
  it('stores a label’s per-100 g values per gram, and lists the product', async () => {
    start(appData(), '/library');
    click('＋ Product');
    type(nameField(), '  Skyr  natural ');
    type(field('kcal'), '63');
    type(field('Protein'), '11');
    click('Save');

    expect(await screen.findByText('Skyr natural')).toBeTruthy();
    expect(screen.getByText('63 kcal · 11 g protein / 100 g')).toBeTruthy();
    expect(store.data.value.products[0]).toMatchObject({
      name: 'Skyr natural',
      perGram: { kcal: 0.63, protein: 0.11 },
      units: [],
    });
  });

  it('converts values copied per unit, e.g. a bar’s column, rounded to 3 decimals', async () => {
    start(appData(), '/product/new');
    type(nameField(), 'Protein bar');
    click('＋ Add unit');
    type(field('Unit name'), 'bar');
    type(field('Grams in 1 bar'), '45');
    const bar = store.data.value; // the unit only exists in the form so far
    expect(bar.products).toHaveLength(0);
    const unitId = (field('Per unit') as HTMLSelectElement).options[1]!.value;
    fireEvent.change(field('Per unit'), { target: { value: unitId } });
    expect((field('Per amount') as HTMLInputElement).value).toBe('1');
    type(field('kcal'), '190');
    type(field('Protein'), '9');
    click('Save');

    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    expect(store.data.value.products[0]).toMatchObject({
      perGram: { kcal: 4.222, protein: 0.2 },
      units: [{ grams: 45, name: 'bar' }],
    });
  });

  it('records the water in drinks', async () => {
    start(appData(), '/product/new');
    type(nameField(), 'coffee');
    type(field('kcal'), '2');
    type(field('Water'), '99');
    click('Save');
    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    expect(store.data.value.products[0]!.perGram).toEqual({ kcal: 0.02, water: 0.99 });
  });

  it('explains what is wrong instead of saving; nothing is required', () => {
    start(appData({ products: [egg] }), '/product/new');
    click('Save');
    expect(screen.getByText('Add a name')).toBeTruthy();
    type(nameField(), 'EGG');
    type(field('Protein'), 'lots');
    click('Save');
    expect(screen.getByText('“egg” already exists')).toBeTruthy();
    expect(screen.getByText('Not a number')).toBeTruthy();
    type(nameField(), 'Water');
    expect(screen.getByText('“Water” is a built-in food')).toBeTruthy();
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

  it('shows a product per 100 g, and warns that editing a used one changes what uses it', () => {
    start(
      appData({
        products: [egg],
        meals: [meal('2026-11-17T07:00:00.000Z', [ing(egg, 2, 'u:piece')])],
      }),
      `/product/${egg.id}`,
    );
    expect((field('kcal') as HTMLInputElement).value).toBe('143');
    expect((field('Protein') as HTMLInputElement).value).toBe('12.6');
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
  it('composes a recipe, says what it makes, and saves it', async () => {
    start(appData({ products: [oatFlakes, milk] }), '/recipe/new');
    type(nameField(), 'Oats');
    chip('oat flakes');
    expect((field('Amount of oat flakes') as HTMLInputElement).value).toBe('100');
    type(field('Amount of oat flakes'), '60');
    chip('milk');
    fireEvent.change(field('Unit of milk'), { target: { value: 'g' } });
    type(field('Amount of milk'), '200');
    type(field('How many'), '1');
    type(field('Unit name'), 'bowl');

    // 60 g oat flakes (222 kcal) + 200 g milk (128 kcal)
    const kcalRow = screen.getByText('kcal', { selector: '.totals th' }).closest('tr')!;
    expect(kcalRow.textContent).toBe('kcal350350');

    click('Save');
    await vi.waitFor(() => expect(store.data.value.recipes).toHaveLength(1));
    expect(store.data.value.recipes[0]).toMatchObject({
      ingredients: [ing(oatFlakes, 60), ing(milk, 200)],
      name: 'Oats',
      units: [{ makes: 1, name: 'bowl' }],
    });
  });

  it('needs to say what it makes', () => {
    start(appData({ products: [oatFlakes] }), '/recipe/new');
    type(nameField(), 'Oats');
    chip('oat flakes');
    click('Save');
    expect(screen.getByText('Say what it makes, e.g. 6 servings')).toBeTruthy();
    expect(store.data.value.recipes).toEqual([]);
  });

  it('creates a missing product from the picker and adds it, keeping the recipe', async () => {
    start(appData({ products: [oatFlakes] }), '/recipe/new');
    type(nameField(), 'Oats with skyr');
    chip('oat flakes');
    type(field('Find food'), 'Skyr');
    click('＋ create “Skyr”');

    expect(await screen.findByText('New product')).toBeTruthy();
    expect((nameField() as HTMLInputElement).value).toBe('Skyr');
    type(field('kcal'), '63');
    click('Save');

    expect(await screen.findByText('New recipe')).toBeTruthy();
    expect((nameField() as HTMLInputElement).value).toBe('Oats with skyr');
    expect(screen.getByText('oat flakes', { selector: '.ingredient-name' })).toBeTruthy();
    expect(screen.getByText('Skyr', { selector: '.ingredient-name' })).toBeTruthy();
  });

  it('adds a unit to a product right from an ingredient row', async () => {
    start(appData({ products: [oatFlakes] }), '/recipe/new');
    chip('oat flakes');
    fireEvent.change(field('Unit of oat flakes'), { target: { value: '__new__' } });
    type(field('New unit name'), 'cup');
    type(field('New unit grams'), '80');
    click('Add unit');

    await vi.waitFor(() =>
      expect(store.data.value.products[0]!.units).toMatchObject([{ grams: 80, name: 'cup' }]),
    );
    const cup = store.data.value.products[0]!.units[0]!;
    expect((field('Unit of oat flakes') as HTMLSelectElement).value).toBe(cup.id);
  });

  it('offers built-in foods, but not recipes that would contain themselves', () => {
    const oats = recipe('oats', [ing(oatFlakes, 60)], [makes(1, 'bowl')]);
    start(appData({ products: [oatFlakes], recipes: [oats] }), `/recipe/${oats.id}`);
    const chips = screen.getByLabelText('Foods');
    expect(within(chips).queryByText('oats')).toBeNull();
    for (const name of ['oat flakes', 'water', 'protein', 'fat', 'carbs']) {
      expect(within(chips).getByText(name)).toBeTruthy();
    }
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
