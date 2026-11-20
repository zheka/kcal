import { describe, expect, it } from 'vitest';
import { addUnit, noPending, pendingFor, putProduct, whatsNew, withPending } from './pending';
import { appData, egg, oatFlakes, product } from './testData';

const data = appData({ products: [egg, oatFlakes] });
const cup = { g: 80, id: 'u:cup', name: 'cup' };
const skyr = product('Skyr', { kcal: 0.63 });

describe('pending foods', () => {
  it('show in the draft’s view of the data, and are not stored', () => {
    const pending = addUnit(putProduct(noPending, skyr), data, oatFlakes.id, cup);
    const view = withPending(data, pending);
    expect(view.products.map((p) => p.name)).toEqual(['egg', 'oat flakes', 'Skyr']);
    expect(view.products[1]!.units).toEqual([cup]);
    expect(data.products[1]!.units).toEqual([]);
  });

  it('keep only the units they added on a food edited meanwhile, and drop deleted foods', () => {
    const pending = addUnit(noPending, data, oatFlakes.id, cup);
    const renamed = appData({ products: [egg, { ...oatFlakes, name: 'rolled oats' }] });
    expect(withPending(renamed, pending).products[1]).toEqual({
      ...oatFlakes,
      name: 'rolled oats',
      units: [cup],
    });
    expect(withPending(appData({ products: [egg] }), pending).products).toEqual([egg]);
  });

  it('are saved only when the ingredients use them, counted as new foods and new units', () => {
    const pending = addUnit(putProduct(noPending, skyr), data, oatFlakes.id, cup);
    expect(pendingFor(pending, data, [{ food: egg.id }])).toEqual({});
    const both = pendingFor(pending, data, [{ food: skyr.id }, { food: oatFlakes.id }]);
    expect(both.products?.map((p) => p.id)).toEqual([skyr.id, oatFlakes.id]);
    expect(whatsNew(both, data)).toEqual({ foods: new Set([skyr.id]), units: new Set([cup.id]) });
  });

  it('add a unit to a new product to the product itself', () => {
    const pending = addUnit(putProduct(noPending, skyr), data, skyr.id, cup);
    expect(pending.products).toEqual([{ ...skyr, units: [cup] }]);
    expect(pending.bases).toEqual({});
  });
});
