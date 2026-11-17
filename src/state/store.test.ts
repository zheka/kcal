import { describe, expect, it, vi } from 'vitest';
import { appData, egg, ing, meal, oatFlakes, recipe } from '../core/testData';
import type { AppData } from '../core/types';
import { createStore, InvalidChangeError } from './store';

function setup(initial: AppData = appData()) {
  const persist = vi.fn();
  return { store: createStore(initial, persist), persist };
}

describe('store', () => {
  it('adds and replaces products, saving every change', () => {
    const { store, persist } = setup();
    store.saveProduct(egg);
    store.saveProduct({ ...egg, name: 'eggs' });
    expect(store.data.value.products).toEqual([{ ...egg, name: 'eggs' }]);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(store.foods.value.get(egg.id)?.name).toBe('eggs');
  });

  it('refuses invalid changes: nothing is saved or changed', () => {
    const { store, persist } = setup(appData({ products: [egg] }));
    expect(() => store.saveProduct({ ...oatFlakes, name: 'Egg' })).toThrow(InvalidChangeError);
    expect(() => store.saveRecipe(recipe('r', [ing(oatFlakes, 1)]))).toThrow(/does not exist/);
    expect(persist).not.toHaveBeenCalled();
    expect(store.data.value.products).toEqual([egg]);
  });

  it('changes nothing when saving fails', () => {
    const store = createStore(appData(), () => {
      throw new Error('quota exceeded');
    });
    expect(() => store.saveProduct(egg)).toThrow('quota exceeded');
    expect(store.data.value.products).toEqual([]);
  });

  it('deletes only foods that nothing uses', () => {
    const { store } = setup(
      appData({ products: [egg, oatFlakes], meals: [meal('2026-11-17T08:00', [ing(egg, 1)])] }),
    );
    expect(() => store.deleteFood(egg.id)).toThrow('in use');
    store.deleteFood(oatFlakes.id);
    expect(store.data.value.products).toEqual([egg]);
  });

  it('rebuilds the food table only when foods change', () => {
    const { store } = setup(appData({ products: [egg] }));
    const before = store.foods.value;
    store.replaceAll({
      ...store.data.value,
      goals: [{ from: '2026-11-17', targets: { kcal: 1 } }],
    });
    expect(store.foods.value).toBe(before);
    store.saveProduct(oatFlakes);
    expect(store.foods.value).not.toBe(before);
  });
});

describe('meals and goals', () => {
  it('adds, replaces and deletes meals', () => {
    const { store } = setup(appData({ products: [egg] }));
    const breakfast = meal('2026-11-17T08:00', [ing(egg, 2, 'u1')]);
    store.saveMeal(breakfast);
    store.saveMeal({ ...breakfast, eatenAt: '2026-11-17T08:30' });
    expect(store.data.value.meals).toEqual([{ ...breakfast, eatenAt: '2026-11-17T08:30' }]);
    store.deleteMeal(breakfast.id);
    expect(store.data.value.meals).toEqual([]);
  });

  it('refuses a meal without ingredients', () => {
    const { store } = setup();
    expect(() => store.saveMeal(meal('2026-11-17T08:00', []))).toThrow(/non-empty list/);
  });

  it('saves goals effective from today', () => {
    const { store } = setup();
    store.saveGoals({ kcal: 2000, protein: 150 }, '2026-11-17');
    store.saveGoals({ kcal: 2100, protein: 150 }, '2026-11-20');
    expect(store.data.value.goals.map((g) => g.from)).toEqual(['2026-11-17', '2026-11-20']);
  });
});
