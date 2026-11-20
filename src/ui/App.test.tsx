import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appData, egg, ing, makes, meal, milk, oatFlakes, recipe, water } from '../core/testData';
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
  it('stores a label’s per-100 g values per g, and lists the product', async () => {
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
      perG: { kcal: 0.63, protein: 0.11 },
      units: [],
    });
    expect(store.data.value.products[0]!.perMl).toBeUndefined();
  });

  it('converts values copied per unit, e.g. a bar’s column, rounded to 3 decimals', async () => {
    start(appData(), '/product/new');
    type(nameField(), 'Protein bar');
    click('＋ Add unit');
    type(field('Unit name'), 'bar');
    type(field('Size of 1 bar'), '45');
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
      perG: { kcal: 4.222, protein: 0.2 },
      units: [{ g: 45, name: 'bar' }],
    });
  });

  it('stores a drink per ml, with its water and an explicit 0; nothing per g', async () => {
    start(appData(), '/product/new');
    type(nameField(), 'coffee');
    click('per ml');
    type(field('kcal'), '2');
    type(field('Fat'), '0');
    type(field('Water'), '99');
    click('Save');
    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    const [coffee] = store.data.value.products;
    expect(coffee!.perMl).toEqual({ fat: 0, kcal: 0.02, water: 0.99 });
    expect(coffee!.perG).toBeUndefined();
  });

  it('stores both bases when both have values, each on its own', async () => {
    start(appData(), '/product/new');
    type(nameField(), 'milk');
    type(field('kcal'), '64');
    click('per ml');
    expect((field('kcal') as HTMLInputElement).value).toBe('');
    type(field('kcal'), '66');
    expect(screen.getByRole('button', { name: /per g/ }).textContent).toBe('per g ✓');
    click('Save');
    await vi.waitFor(() => expect(store.data.value.products).toHaveLength(1));
    expect(store.data.value.products[0]).toMatchObject({
      perG: { kcal: 0.64 },
      perMl: { kcal: 0.66 },
    });
  });

  it('offers ml for units only once there are values per ml', () => {
    start(appData(), '/product/new');
    type(nameField(), 'juice');
    type(field('kcal'), '45');
    click('＋ Add unit');
    // only g has values: the unit is in g, no selector
    expect(screen.queryByLabelText('Unit of 1 unit')).toBeNull();
    click('per ml');
    type(field('kcal'), '44');
    fireEvent.change(field('Unit of 1 unit'), { target: { value: 'ml' } });
    type(field('Unit name'), 'glass');
    type(field('Size of 1 glass'), '200');
    // clearing the ml values marks the unit, and saving waits
    type(field('kcal'), '');
    click('Save');
    expect(screen.getByText('glass is in ml: enter at least one value per ml')).toBeTruthy();
    expect(store.data.value.products).toEqual([]);
  });

  it('keeps a base that meals use: clearing its values is refused', () => {
    start(
      appData({
        products: [water],
        meals: [meal('2026-11-17T07:00:00.000Z', [ing(water, 250, 'ml')])],
      }),
      `/product/${water.id}`,
    );
    click('per ml');
    type(field('Water'), '');
    click('Save');
    expect(screen.getByText('Used in ml 1 time: keep at least one value per ml')).toBeTruthy();
    expect(store.data.value.products).toEqual([water]);
  });

  it('explains what is wrong instead of saving; at least one value is needed', () => {
    start(appData({ products: [egg] }), '/product/new');
    click('Save');
    expect(screen.getByText('Add a name')).toBeTruthy();
    expect(screen.getByText('Enter at least one value, per g or per ml (0 counts)')).toBeTruthy();
    type(nameField(), 'EGG');
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
    expect(screen.getByText('Used in 1 meal: saving changes them too.')).toBeTruthy();
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

  it('creates a missing product from the picker; it is saved only with the recipe', async () => {
    start(appData({ products: [oatFlakes] }), '/library');
    click('＋ Recipe');
    type(nameField(), 'Oats with skyr');
    chip('oat flakes');
    type(field('Find food'), 'Skyr');
    click('＋ create “Skyr”');

    expect(await screen.findByText('New product')).toBeTruthy();
    expect((nameField() as HTMLInputElement).value).toBe('Skyr');
    type(field('kcal'), '63');
    click('Done');

    expect(await screen.findByText('New recipe')).toBeTruthy();
    expect((nameField() as HTMLInputElement).value).toBe('Oats with skyr');
    expect(screen.getByText('oat flakes', { selector: '.ingredient-name' })).toBeTruthy();
    expect(screen.getByText('Skyr', { selector: '.ingredient-name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit new product Skyr' })).toBeTruthy();
    expect(store.data.value.products.map((p) => p.name)).toEqual(['oat flakes']);

    type(field('How many units it makes'), '2');
    type(field('Unit name'), 'bowl');
    click('Save + 1 new food');
    expect(await screen.findByRole('heading', { name: 'Library' })).toBeTruthy();
    expect(store.data.value.products.map((p) => p.name).sort()).toEqual(['Skyr', 'oat flakes']);
    const skyr = store.data.value.products.find((p) => p.name === 'Skyr')!;
    expect(store.data.value.recipes[0]!.ingredients.map((i) => i.food)).toEqual([
      oatFlakes.id,
      skyr.id,
    ]);
  });

  it('adds a unit to a product right from an ingredient row, saved with the recipe', async () => {
    start(appData({ products: [oatFlakes] }), '/library');
    click('＋ Recipe');
    type(nameField(), 'Oats');
    chip('oat flakes');
    fireEvent.change(field('Unit of oat flakes'), { target: { value: '__new__' } });
    type(field('New unit name'), 'cup');
    type(field('New unit size'), '80');
    click('Add unit');

    const select = field('Unit of oat flakes') as HTMLSelectElement;
    expect(select.selectedOptions[0]?.textContent).toBe('cup (new)');
    expect(store.data.value.products[0]!.units).toEqual([]);

    type(field('How many units it makes'), '1');
    type(field('Unit name'), 'bowl');
    click('Save + 1 new unit');
    expect(await screen.findByRole('heading', { name: 'Library' })).toBeTruthy();
    const [cup] = store.data.value.products[0]!.units;
    expect(cup).toMatchObject({ g: 80, name: 'cup' });
    expect(store.data.value.recipes[0]!.ingredients).toEqual([
      { amount: 1, food: oatFlakes.id, unit: cup!.id },
    ]);
  });

  it('refuses g and ml as a new unit’s name, and closes the new unit with ×', () => {
    start(appData({ products: [oatFlakes] }), '/recipe/new');
    chip('oat flakes');
    fireEvent.change(field('Unit of oat flakes'), { target: { value: '__new__' } });
    type(field('New unit name'), 'ML');
    type(field('New unit size'), '80');
    click('Add unit');
    expect(screen.getByText('“ML” is reserved: g and ml are the product’s bases')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    click('Close new unit of oat flakes');
    expect(screen.queryByLabelText('New unit name')).toBeNull();
  });

  it('offers foods, but not recipes that would contain themselves', () => {
    const oats = recipe('oats', [ing(oatFlakes, 60)], [makes(1, 'bowl')]);
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
      target: {
        files: [new File(['{"version":"kcal 0.2.0","goals":{},"products":{}}'], 'bad.json')],
      },
    });
    expect(await screen.findByText('Import refused: 2 problems')).toBeTruthy();
    expect(screen.getByText('products: must be a list')).toBeTruthy();
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

describe('new foods wait for their meal', () => {
  it('discards a product created for a meal when the meal is closed', async () => {
    start(appData({ products: [egg] }), '/meal/new');
    type(field('Find food'), 'Skyr');
    click('＋ create “Skyr”');
    type(await screen.findByLabelText('kcal', { exact: false }), '63');
    click('Done');
    expect(await screen.findByRole('heading', { name: 'New meal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save + 1 new food' })).toBeTruthy();
    click('Close');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(store.data.value.products).toEqual([egg]);
    expect(store.data.value.meals).toEqual([]);
  });

  it('opens a new product from its chip to edit it, and saves it with the meal', async () => {
    start(appData(), '/meal/new');
    type(field('Find food'), 'Skyr');
    click('＋ create “Skyr”');
    type(await screen.findByLabelText('kcal', { exact: false }), '63');
    click('Done');
    click(
      await screen
        .findByRole('button', { name: 'Edit new product Skyr' })
        .then(() => 'Edit new product Skyr'),
    );
    expect(await screen.findByRole('heading', { name: 'New product' })).toBeTruthy();
    expect((field('kcal') as HTMLInputElement).value).toBe('63');
    type(field('kcal'), '70');
    click('Done');
    expect(await screen.findByRole('heading', { name: 'New meal' })).toBeTruthy();
    expect(screen.getAllByText('Skyr', { selector: '.ingredient-name' })).toHaveLength(1);
    click('Save + 1 new food');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    const [skyr] = store.data.value.products;
    expect(skyr).toMatchObject({ name: 'Skyr', perG: { kcal: 0.7 } });
    expect(store.data.value.meals[0]!.ingredients[0]!.food).toBe(skyr!.id);
  });

  it('keeps an edit made elsewhere when a meal saves a unit it added', async () => {
    start(appData({ products: [oatFlakes] }), '/meal/new');
    chip('oat flakes');
    fireEvent.change(field('Unit of oat flakes'), { target: { value: '__new__' } });
    type(field('New unit name'), 'cup');
    type(field('New unit size'), '80');
    click('Add unit');
    // renamed meanwhile, e.g. in the library
    store.saveProduct({ ...oatFlakes, name: 'rolled oats' });
    click(
      await screen
        .findByRole('button', { name: 'Save + 1 new unit' })
        .then(() => 'Save + 1 new unit'),
    );
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(store.data.value.products[0]).toMatchObject({
      name: 'rolled oats',
      units: [{ g: 80, name: 'cup' }],
    });
  });
});

describe('library and closing screens', () => {
  it('lists the foods by name, each per 100 of its first base', () => {
    const juice = { id: 'p:juice', name: 'juice', perMl: { kcal: 0.45 }, units: [] };
    start(appData({ products: [egg, water, juice, oatFlakes] }), '/library');
    const names = [...document.querySelectorAll('.food-name')].map(
      (n) => n.firstChild?.textContent,
    );
    expect(names).toEqual(['egg', 'juice', 'oat flakes', 'water']);
    expect(screen.getByText('0 kcal · 0 g protein · 100 ml water / 100 g')).toBeTruthy();
    expect(screen.getByText('45 kcal · 0 g protein / 100 ml')).toBeTruthy();
  });

  it('has no Cancel buttons: × closes a screen and discards its unsaved form', async () => {
    start(appData({ products: [oatFlakes] }), '/library');
    click('＋ Recipe');
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    type(nameField(), 'Half-made recipe');
    click('Close');
    expect(await screen.findByRole('heading', { name: 'Library' })).toBeTruthy();
    click('＋ Recipe');
    expect((nameField() as HTMLInputElement).value).toBe('');
  });

  it('keeps a recipe when the product form opened from it is closed', async () => {
    start(appData({ products: [oatFlakes] }), '/recipe/new');
    type(nameField(), 'Oats with skyr');
    type(field('Find food'), 'Skyr');
    click('＋ create “Skyr”');
    expect(await screen.findByRole('heading', { name: 'New product' })).toBeTruthy();
    click('Close');
    expect(await screen.findByRole('heading', { name: 'New recipe' })).toBeTruthy();
    expect((nameField() as HTMLInputElement).value).toBe('Oats with skyr');
    expect(store.data.value.products).toEqual([oatFlakes]);
  });
});
