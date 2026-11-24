import { describe, expect, it } from 'vitest';
import { applyChange, mergeChanges, tombstone } from './change';
import { appData, egg, ing, meal, milk, oatFlakes, water } from './testData';

const breakfast = meal('2026-11-17T07:30:41.512Z', [ing(egg, 2, 'u:piece')]);
const data = appData({ products: [egg, oatFlakes], meals: [breakfast] });

describe('applyChange', () => {
  it('replaces a record in place, adds new ones, keeps the rest', () => {
    const next = applyChange(data, { products: [milk, { ...egg, name: 'eggs' }] });
    expect(next.products.map((p) => p.name)).toEqual(['eggs', 'oat flakes', 'milk']);
    expect(next.meals).toBe(data.meals);
    expect(data.products[0]?.name).toBe('egg'); // pure
  });

  it('removes a record for a tombstone, and ignores one for a record that is not there', () => {
    const next = applyChange(data, {
      products: [tombstone(oatFlakes.id), tombstone('p:never')],
      meals: [tombstone(breakfast.id)],
    });
    expect(next.products).toEqual([egg]);
    expect(next.meals).toEqual([]);
  });

  it('adds goal sets and replaces the settings', () => {
    const set = { perDay: { kcal: 2000 }, setAt: '2026-11-17T07:00:00.000Z' };
    const settings = { quickButtons: [{ label: '🍽️' }] };
    const next = applyChange(data, { goals: [set], settings });
    expect(next.goals).toEqual([set]);
    expect(next.settings).toBe(settings);
    expect(applyChange(data, {})).toEqual(data);
  });
});

describe('mergeChanges', () => {
  it('lets the later change win for a record both have, and keeps everything else', () => {
    const merged = mergeChanges(
      { products: [egg, milk], goals: [{ setAt: '2026-11-17T07:00:00.000Z' }] },
      { products: [{ ...egg, name: 'eggs' }, water], meals: [tombstone('m:x')] },
    );
    expect(merged).toEqual({
      goals: [{ setAt: '2026-11-17T07:00:00.000Z' }],
      meals: [tombstone('m:x')],
      products: [{ ...egg, name: 'eggs' }, milk, water],
    });
  });
});
