import { describe, expect, it } from 'vitest';
import { EMPTY, fromStored, withMeal } from './data';
import type { ComposedMeal } from './types';

const meal = (id: string, at: string): ComposedMeal => ({
  id,
  title: id,
  at,
  context: [],
  answers: {},
  changed: false,
});

describe('composer data', () => {
  it('fills in what a kept object lacks, leaving out meals of the oldest shape', () => {
    expect(fromStored(undefined)).toEqual(EMPTY);
    const oldest = { id: 'o', title: '', at: '', items: [], inputs: [], calls: [] };
    const now = meal('n', '2026-11-21T08:00:00Z');
    expect(fromStored({ meals: [oldest as never, now] }).meals).toEqual([now]);
    // settings of before (model, thinking, temperature) are settings.ts now
    expect(fromStored({ model: 'm', options: {} } as never)).toEqual(EMPTY);
  });

  it('keeps a meal answered by prompt v3 by what it is composed from, to update again', () => {
    const context = [{ id: 'a', kind: 'text' as const, text: 'lunch' }];
    const v3 = {
      id: 'v',
      title: 'Lunch',
      at: 'T',
      context,
      items: [{ name: 'x' }],
      changed: false,
    };
    expect(fromStored({ meals: [v3 as never] }).meals).toEqual([
      { id: 'v', title: 'Lunch', at: 'T', context, answers: {}, changed: true },
    ]);
  });

  it('drops an answer read in an older shape, and the user’s answers to it, to update again', () => {
    const context = [{ id: 'a', kind: 'text' as const, text: 'lunch' }];
    const stale = {
      ...meal('s', 'T'),
      context,
      meal: { title: 'Lunch', dishes: [{ name: 'x', items: [{ name: 'x', alternatives: [] }] }] },
      answers: { '0.0': { kind: 'y' } },
    };
    expect(fromStored({ meals: [stale as never] }).meals).toEqual([
      { id: 's', title: 's', at: 'T', context, answers: {}, changed: true },
    ]);
  });

  it('keeps meals newest first, replacing one by id', () => {
    const a = meal('a', '2026-11-20T08:00:00Z');
    const b = meal('b', '2026-11-21T08:00:00Z');
    const meals = withMeal(withMeal([], a), b);
    expect(meals.map((m) => m.id)).toEqual(['b', 'a']);
    expect(withMeal(meals, { ...a, title: 'new' }).map((m) => m.title)).toEqual(['b', 'new']);
  });
});
