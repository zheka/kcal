import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appData, egg, honey, ing, meal, oatFlakes } from '../core/testData';
import type { AppData } from '../core/types';
import { createStore, type Store } from '../state/store';
import { App } from './App';
import { clearDrafts } from './drafts';
import { navigate, today } from './router';

let store: Store;

const breakfast = meal('2026-11-17T08:30', [ing(egg, 2, 'u1')], 'm:breakfast');
const lunch = meal('2026-11-17T13:00', [ing(oatFlakes, 100)], 'm:lunch');
const yesterday = meal('2026-11-16T09:00', [ing(egg, 3, 'u1')], 'm:yesterday');
const goals = [{ from: '2026-11-01', targets: { kcal: 2000, protein: 150 } }];

function start(data: Partial<AppData> = {}, path = '/') {
  store = createStore(
    appData({
      products: [egg, oatFlakes, honey],
      goals,
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 17, 19, 45));
  today.value = '2026-11-17';
  history.replaceState(null, '', '#/');
  clearDrafts();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('day screen', () => {
  it('shows the day against its goals, and its meals newest first', () => {
    start();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
    // 2 eggs (171.6 kcal, 15.12 g protein) + 100 g oat flakes (370 kcal, 13 g)
    expect(bar(/^kcal/)).toBe('kcal: 542 taken, goal 2000');
    expect(bar(/^Protein/)).toBe('Protein: 28 g taken, goal 150 g');
    // No goals for fat and carbs: amounts and the macro split.
    expect(screen.getByText('Fat 18 g')).toBeTruthy();
    expect(screen.getByText(/^P \d+% · F \d+% · C \d+%$/)).toBeTruthy();

    const rows = screen.getAllByRole('button', { name: /kcal ·/ });
    expect(rows.map((r) => r.textContent)).toEqual([
      '13:00370 kcal · 13 g protein✎',
      '08:30172 kcal · 15 g protein✎',
    ]);
  });

  it('moves between days with the arrows', () => {
    start();
    click('Previous day');
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull();
    expect(location.hash).toBe('#/day/2026-11-16');
    expect(screen.getAllByRole('button', { name: /kcal ·/ })).toHaveLength(1);
    click('Next day');
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(location.hash).toBe('#/');
  });

  it('says when a past day had other goals', () => {
    start(
      {
        goals: [
          { from: '2026-11-01', targets: { kcal: 1800 } },
          ...goals.map((g) => ({ ...g, from: '2026-11-15' })),
        ],
      },
      '/day/2026-11-10',
    );
    expect(screen.getByText('Goals of 2026-11-01: 1800 kcal')).toBeTruthy();
    expect(bar(/^kcal/)).toBe('kcal: 0 taken, goal 1800');
  });

  it('shows plain amounts before the first goals and offers to set them', () => {
    start({ goals: [] });
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('kcal 542')).toBeTruthy();
    click('Set daily goals');
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeTruthy();
  });

  it('marks totals that include unknown values', () => {
    start({ meals: [meal('2026-11-17T10:00', [ing(egg, 1, 'u1'), ing(honey, 1, 'u1')])] });
    expect(bar(/^Protein/)).toBe('Protein: 7.6 g taken, goal 150 g, some values unknown');
    expect(screen.getByText('≥ 7.6')).toBeTruthy();
  });
});

describe('meal composer', () => {
  it('composes a meal against the day and logs it now', async () => {
    start();
    click('＋ Eat');
    expect(screen.getByRole('heading', { name: 'New meal' })).toBeTruthy();
    expect((screen.getByLabelText('Eaten at') as HTMLInputElement).value).toBe('2026-11-17T19:45');
    pick('egg');
    // The last use of egg: 2 pieces.
    expect((screen.getByLabelText('Amount of egg') as HTMLInputElement).value).toBe('2');
    expect(bar(/^kcal/)).toBe('kcal: 542 taken, 172 this meal, goal 2000');
    fireEvent.input(screen.getByLabelText('Amount of egg'), { target: { value: '4' } });
    expect(bar(/^kcal/)).toBe('kcal: 542 taken, 343 this meal, goal 2000');
    expect(screen.getByText(/^This meal: 343 kcal · 30 g protein/)).toBeTruthy();

    click('Save');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(store.data.value.meals).toHaveLength(4);
    expect(store.data.value.meals.at(-1)).toMatchObject({
      eatenAt: '2026-11-17T19:45',
      ingredients: [ing(egg, 4, 'u1')],
    });
  });

  it('refuses an empty meal', () => {
    start();
    click('＋ Eat');
    click('Save');
    expect(screen.getByText('Add food')).toBeTruthy();
    expect(store.data.value.meals).toHaveLength(3);
  });

  it('edits a meal: the day counts it only once', async () => {
    start();
    fireEvent.click(screen.getByRole('button', { name: /^08:30/ }));
    expect(screen.getByRole('heading', { name: 'Meal' })).toBeTruthy();
    expect(bar(/^kcal/)).toBe('kcal: 370 taken, 172 this meal, goal 2000');
    fireEvent.input(screen.getByLabelText('Amount of egg'), { target: { value: '1' } });
    click('Save');
    await screen.findByRole('heading', { name: 'Today' });
    expect(store.data.value.meals.find((m) => m.id === breakfast.id)?.ingredients).toEqual([
      ing(egg, 1, 'u1'),
    ]);
  });

  it('eats a past meal again, now', async () => {
    start({}, `/meal/${yesterday.id}`);
    click('Eat again');
    expect(screen.getByRole('heading', { name: 'Eat again' })).toBeTruthy();
    expect((screen.getByLabelText('Amount of egg') as HTMLInputElement).value).toBe('3');
    expect((screen.getByLabelText('Eaten at') as HTMLInputElement).value).toBe('2026-11-17T19:45');
    click('Save');
    await vi.waitFor(() => expect(store.data.value.meals).toHaveLength(4));
    expect(store.data.value.meals.at(-1)).toMatchObject({
      eatenAt: '2026-11-17T19:45',
      ingredients: yesterday.ingredients,
    });
    expect(store.data.value.meals).toContainEqual(yesterday);
  });

  it('deletes a meal with two taps', async () => {
    start({}, `/meal/${lunch.id}`);
    click('Delete');
    click('Tap again to delete');
    await vi.waitFor(() => expect(store.data.value.meals).toHaveLength(2));
    expect(store.data.value.meals.find((m) => m.id === lunch.id)).toBeUndefined();
  });

  it('adds a meal to a past day just after its last meal', () => {
    start({}, '/day/2026-11-16');
    click('＋ Eat');
    expect((screen.getByLabelText('Eaten at') as HTMLInputElement).value).toBe('2026-11-16T09:01');
    expect(bar(/^kcal/)).toBe('kcal: 257 taken, 0 this meal, goal 2000');
  });
});

describe('goals', () => {
  it('saves new goals effective from today and keeps their history', async () => {
    start({}, '/goals');
    const kcal = screen.getByLabelText('kcal') as HTMLInputElement;
    expect(kcal.value).toBe('2000');
    fireEvent.input(kcal, { target: { value: '2200' } });
    fireEvent.input(screen.getByLabelText('protein (g)'), { target: { value: '' } });
    fireEvent.input(screen.getByLabelText('fat (g)', { exact: false }), { target: { value: 'x' } });
    click('Save');
    expect(screen.getByText('Not a positive number')).toBeTruthy();
    fireEvent.input(screen.getByLabelText('fat (g)', { exact: false }), {
      target: { value: '70' },
    });
    click('Save');

    await vi.waitFor(() =>
      expect(store.data.value.goals).toEqual([
        ...goals,
        { from: '2026-11-17', targets: { kcal: 2200, fat: 70 } },
      ]),
    );
  });

  it('lists the goals history', () => {
    start({}, '/goals');
    expect(screen.getByText('From 2026-11-01: 2000 kcal · 150 g protein')).toBeTruthy();
  });
});
