import { describe, expect, it, vi } from 'vitest';
import { appData, egg, honey, ing, makes, meal, oatFlakes, recipe } from '../core/testData';
import type { AppData } from '../core/types';
import { createStore, InvalidChangeError } from './store';

function setup(initial: AppData = appData()) {
  const persist = vi.fn();
  return { store: createStore(initial, persist), persist };
}

describe('store', () => {
  it('adds and replaces products, saving every change in canonical order', () => {
    const { store, persist } = setup();
    store.saveProduct(oatFlakes);
    store.saveProduct(egg);
    store.saveProduct({ ...egg, name: 'eggs' });
    expect(store.data.value.products.map((p) => p.name)).toEqual(['eggs', 'oat flakes']);
    expect(persist).toHaveBeenCalledTimes(3);
    expect(store.foods.value.get(egg.id)?.name).toBe('eggs');
  });

  it('refuses invalid changes: nothing is saved or changed', () => {
    const { store, persist } = setup(appData({ products: [egg] }));
    expect(() => store.saveProduct({ ...oatFlakes, name: 'Egg' })).toThrow(InvalidChangeError);
    expect(() => store.saveRecipe(recipe('r', [ing(oatFlakes, 1)], [makes(1)]))).toThrow(
      /does not exist/,
    );
    expect(persist).not.toHaveBeenCalled();
    expect(store.data.value.products).toEqual([egg]);
  });

  it('applies a change all or nothing', () => {
    const { store, persist } = setup(appData({ products: [egg] }));
    const breakfast = meal('2026-11-17T07:30:41.512Z', [ing(oatFlakes, 60)]);
    // the meal needs oat flakes: alone it is refused, together with them it is saved
    expect(() => store.apply({ meals: [breakfast] })).toThrow(/does not exist/);
    expect(() =>
      store.apply({ products: [{ ...oatFlakes, name: 'Egg' }], meals: [breakfast] }),
    ).toThrow(InvalidChangeError);
    expect(persist).not.toHaveBeenCalled();
    store.apply({ products: [oatFlakes], meals: [breakfast] });
    expect(store.data.value.meals).toEqual([breakfast]);
    expect(persist).toHaveBeenCalledTimes(1);
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
      appData({
        products: [egg, oatFlakes, honey],
        meals: [meal('2026-11-17T07:00:00.000Z', [ing(egg, 1)])],
        settings: {
          ai: {},
          quickButtons: [{ amount: 1, food: honey.id, label: '🍯', unit: 'u:tsp' }],
        },
      }),
    );
    expect(() => store.deleteFood(egg.id)).toThrow('in use');
    expect(() => store.deleteFood(honey.id)).toThrow('in use');
    store.deleteFood(oatFlakes.id);
    expect(store.data.value.products).toEqual([egg, honey]);
  });

  it('adds, replaces and deletes meals, kept in time order', () => {
    const { store } = setup(appData({ products: [egg] }));
    const late = meal('2026-11-17T12:00:00.000Z', [ing(egg, 1)], 'm:late');
    const early = meal('2026-11-17T08:00:00.000Z', [ing(egg, 2)], 'm:early');
    store.saveMeal(late);
    store.saveMeal(early);
    expect(store.data.value.meals.map((m) => m.id)).toEqual(['m:early', 'm:late']);
    store.deleteMeal(late.id);
    expect(store.data.value.meals).toEqual([early]);
    expect(() => store.saveMeal(meal('2026-11-17T09:00:00.000Z', []))).toThrow(/non-empty list/);
  });

  it('saves goals now, only ever adding sets', () => {
    const { store } = setup();
    store.saveGoals({ kcal: 2000 }, new Date('2026-11-17T07:00:00.000Z'));
    store.saveGoals({ kcal: 2100 }, new Date('2026-11-17T15:00:00.000Z'));
    store.saveGoals({ kcal: 2200 }, new Date('2026-11-18T07:00:00.000Z'));
    expect(store.data.value.goals.map((g) => g.perDay?.kcal)).toEqual([2000, 2100, 2200]);
  });

  it('rebuilds the food table only when foods change', () => {
    const { store } = setup(appData({ products: [egg] }));
    const before = store.foods.value;
    store.saveGoals({ kcal: 1 }, new Date('2026-11-17T07:00:00.000Z'));
    expect(store.foods.value).toBe(before);
    store.saveProduct(oatFlakes);
    expect(store.foods.value).not.toBe(before);
  });
});
