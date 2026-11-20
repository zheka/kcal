import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appData, egg, honey, ing, meal, oatFlakes, water } from '../core/testData';
import type { AppData } from '../core/types';
import { createStore, type Store } from '../state/store';
import { App } from './App';
import { clearDrafts } from './drafts';
import { navigate, today } from './router';

// Tests run in Europe/Berlin (UTC+1 in November). "Now" is 19:45:12.345 local on Nov 17.
const NOW = '2026-11-17T18:45:12.345Z';

let store: Store;

const breakfast = meal('2026-11-17T07:30:41.512Z', [ing(egg, 2, 'u:piece')], 'm:breakfast');
const lunch = meal(
  '2026-11-17T12:00:00.000Z',
  [ing(oatFlakes, 100), ing(water, 300, 'ml')],
  'm:lunch',
);
const yesterday = meal('2026-11-16T08:00:00.000Z', [ing(egg, 3, 'u:piece')], 'm:yesterday');
const goals = [
  { perDay: { kcal: 2000, protein: 150, water: 2000 }, setAt: '2026-11-01T18:20:05.114Z' },
];

function start(data: Partial<AppData> = {}, path = '/') {
  store = createStore(
    appData({
      products: [egg, oatFlakes, honey, water],
      goals,
      settings: {
        quickButtons: [{ amount: 250, food: water.id, label: '💧', unit: 'ml' }, { label: '🍽️' }],
      },
      meals: [breakfast, lunch, yesterday],
      ...data,
    }),
    vi.fn(),
  );
  navigate(path);
  render(<App store={store} />);
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const bar = (name: RegExp) => screen.getByRole('img', { name }).getAttribute('aria-label');
const pick = (food: string) =>
  fireEvent.click(within(screen.getByLabelText('Foods')).getByText(food));
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  today.value = '2026-11-17';
  history.replaceState(null, '', '#/');
  clearDrafts();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('day screen', () => {
  it('shows the day against its goals, and its meals newest first with the goal nutrients', () => {
    start();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    // 2 eggs (171.6 kcal, 15.12 g protein) + 100 g oat flakes (370 kcal, 13 g) + 300 ml water
    expect(bar(/^kcal/)).toBe('kcal: 542 taken, goal 2000');
    expect(bar(/^Water/)).toBe('Water: 300 ml taken, goal 2000 ml');
    expect(bar(/^Fat/)).toBe('Fat: 18 g taken, no goal');

    const rows = screen.getAllByRole('button', { name: /kcal ·/ });
    expect(rows.map((r) => r.textContent)).toEqual([
      '13:00370 kcal · 13 g protein · 300 ml water',
      '08:30172 kcal · 15 g protein · 0 ml water',
    ]);
  });

  it('moves between days with the arrows', () => {
    start();
    click('Previous day');
    expect(location.hash).toBe('#/day/2026-11-16');
    expect(screen.getAllByRole('button', { name: /kcal ·/ })).toHaveLength(1);
    click('Next day');
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
  });

  it('says when a past day had other goals', () => {
    start(
      {
        goals: [
          { perDay: { kcal: 1800 }, setAt: '2026-11-01T10:00:00.000Z' },
          { perDay: { kcal: 2000 }, setAt: '2026-11-15T10:00:00.000Z' },
        ],
      },
      '/day/2026-11-10',
    );
    expect(screen.getByText('Goals of Nov 1, 2026: 1800 kcal')).toBeTruthy();
    expect(bar(/^kcal/)).toBe('kcal: 0 taken, goal 1800');
  });

  it('shows kcal per meal and no goal lines before the first goals, and offers to set them', () => {
    start({ goals: [] });
    expect(bar(/^kcal/)).toBe('kcal: 542 taken, no goal');
    expect(screen.getAllByRole('button', { name: /kcal/ }).map((r) => r.textContent)).toContain(
      '13:00370 kcal',
    );
    click('Set daily goals');
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeTruthy();
  });
});

describe('meal composer', () => {
  it('composes a meal against the day and logs it at the exact moment', async () => {
    start();
    click('🍽️: New meal');
    expect(screen.getByRole('heading', { name: 'New meal' })).toBeTruthy();
    expect(input('Consumed at').value).toBe('2026-11-17T19:45');
    pick('egg');
    // the last use of egg: 2 pieces
    expect(input('Amount of egg').value).toBe('2');
    expect(bar(/^kcal/)).toBe('kcal: 542 taken, 172 this meal, goal 2000');
    fireEvent.input(input('Amount of egg'), { target: { value: '4' } });
    expect(screen.getByText(/^This meal: 343 kcal · 30 g protein/)).toBeTruthy();

    click('Save');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(store.data.value.meals.at(-1)).toMatchObject({
      consumedAt: NOW,
      ingredients: [ing(egg, 4, 'u:piece')],
    });
  });

  it('shows the quick buttons from the settings, in their order, round or pill-shaped', () => {
    start({
      settings: {
        quickButtons: [
          { amount: 250, food: water.id, label: '💧', unit: 'ml' },
          { amount: 2, food: egg.id, label: 'eggs', unit: 'u:piece' },
          { label: '🍽️' },
        ],
      },
    });
    const buttons = within(screen.getByRole('navigation', { name: 'Quick buttons' }))
      .getAllByRole('button')
      .map((b) => [b.getAttribute('aria-label'), b.className]);
    expect(buttons).toEqual([
      ['💧: water · 250 ml', 'quick-button round'],
      ['eggs: egg · 2 piece', 'quick-button pill'],
      ['🍽️: New meal', 'quick-button round'],
    ]);
    click('eggs: egg · 2 piece');
    expect(input('Amount of egg').value).toBe('2');
  });

  it('has no quick buttons, and no plain eat button, when the settings have none', () => {
    start({ settings: { quickButtons: [] } });
    expect(screen.queryByRole('navigation', { name: 'Quick buttons' })).toBeNull();
  });

  it('logs a glass of water with the 💧 quick button, its amount as set', async () => {
    start();
    click('💧: water · 250 ml');
    expect(screen.getByRole('heading', { name: 'New meal' })).toBeTruthy();
    // the button's amount, not the last use (300 ml)
    expect(input('Amount of water').value).toBe('250');
    expect(bar(/^Water/)).toBe('Water: 300 ml taken, 250 ml this meal, goal 2000 ml');
    click('Save');
    await screen.findByRole('heading', { name: 'Today' });
    expect(store.data.value.meals.at(-1)?.ingredients).toEqual([ing(water, 250, 'ml')]);
    expect(screen.getAllByRole('button', { name: /kcal ·/ })[0]!.textContent).toBe(
      '19:450 kcal · 0 g protein · 250 ml water',
    );
  });

  it('refuses an empty meal', () => {
    start();
    click('🍽️: New meal');
    click('Save');
    expect(screen.getByText('Add food')).toBeTruthy();
    expect(store.data.value.meals).toHaveLength(3);
  });

  it('edits a meal: counted once in the chart; a new minute keeps its seconds', async () => {
    start();
    fireEvent.click(screen.getByRole('button', { name: /^08:30/ }));
    expect(screen.getByRole('heading', { name: 'Meal' })).toBeTruthy();
    expect(bar(/^kcal/)).toBe('kcal: 370 taken, 172 this meal, goal 2000');
    fireEvent.input(input('Amount of egg'), { target: { value: '1' } });
    fireEvent.input(input('Consumed at'), { target: { value: '2026-11-17T09:00' } });
    click('Save');
    await screen.findByRole('heading', { name: 'Today' });
    expect(store.data.value.meals.find((m) => m.id === breakfast.id)).toEqual({
      consumedAt: '2026-11-17T08:00:41.512Z',
      id: breakfast.id,
      ingredients: [ing(egg, 1, 'u:piece')],
    });
  });

  it('eats a past meal again, now', async () => {
    start({}, `/meal/${yesterday.id}`);
    click('Eat again');
    expect(screen.getByRole('heading', { name: 'Eat again' })).toBeTruthy();
    expect(input('Amount of egg').value).toBe('3');
    click('Save');
    await vi.waitFor(() => expect(store.data.value.meals).toHaveLength(4));
    expect(store.data.value.meals.at(-1)).toMatchObject({
      consumedAt: NOW,
      ingredients: yesterday.ingredients,
    });
    expect(store.data.value.meals).toContainEqual(yesterday);
  });

  it('deletes a meal with two taps', async () => {
    start({}, `/meal/${lunch.id}`);
    click('Delete');
    click('Tap again to delete');
    await vi.waitFor(() => expect(store.data.value.meals).toHaveLength(2));
  });

  it('adds a meal to a past day a minute after its last meal, with the seconds of now', async () => {
    start({}, '/day/2026-11-16');
    click('🍽️: New meal');
    expect(input('Consumed at').value).toBe('2026-11-16T09:01');
    pick('egg');
    click('Save');
    await vi.waitFor(() => expect(store.data.value.meals).toHaveLength(4));
    expect(
      store.data.value.meals.find((m) => m.consumedAt.startsWith('2026-11-16T08:01'))?.consumedAt,
    ).toBe('2026-11-16T08:01:12.345Z');
  });
});

describe('goals', () => {
  it('saves new goals now, effective from the start of today', async () => {
    start({}, '/goals');
    expect(input('kcal').value).toBe('2000');
    expect(input('Water (ml)').value).toBe('2000');
    fireEvent.input(input('kcal'), { target: { value: '2200' } });
    fireEvent.input(input('Protein (g)'), { target: { value: '' } });
    fireEvent.input(input('Fat (g)'), { target: { value: 'x' } });
    click('Save');
    expect(screen.getByText('Not a positive number')).toBeTruthy();
    fireEvent.input(screen.getByLabelText('Fat (g)', { exact: false }), {
      target: { value: '70' },
    });
    click('Save');

    await vi.waitFor(() =>
      expect(store.data.value.goals).toEqual([
        ...goals,
        { perDay: { fat: 70, kcal: 2200, water: 2000 }, setAt: NOW },
      ]),
    );
  });

  it('lists the goals history', () => {
    start({}, '/goals');
    expect(screen.getByText('From Nov 1, 2026')).toBeTruthy();
    expect(screen.getByText('2000 kcal · 150 g protein · 2000 ml water')).toBeTruthy();
  });
});
