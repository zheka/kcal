import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS } from '../ai/model';
import { EMPTY, fromStored, withMeal } from './data';
import type { ComposedMeal } from './types';

const meal = (id: string, at: string): ComposedMeal => ({
  id,
  title: id,
  at,
  context: [],
  items: [],
  changed: false,
});

describe('composer data', () => {
  it('fills in what a kept object lacks, leaving out meals of an older shape', () => {
    expect(fromStored(undefined)).toEqual(EMPTY);
    const old = { id: 'o', title: '', at: '', items: [], inputs: [], calls: [] };
    const now = meal('n', '2026-11-21T08:00:00Z');
    expect(fromStored({ meals: [old as never, now] }).meals).toEqual([now]);
    expect(fromStored({ model: 'm', options: { thinking: 'off' } as never })).toEqual({
      meals: [],
      model: 'm',
      options: { ...DEFAULT_OPTIONS, thinking: 'off' },
    });
  });

  it('keeps meals newest first, replacing one by id', () => {
    const a = meal('a', '2026-11-20T08:00:00Z');
    const b = meal('b', '2026-11-21T08:00:00Z');
    const meals = withMeal(withMeal([], a), b);
    expect(meals.map((m) => m.id)).toEqual(['b', 'a']);
    expect(withMeal(meals, { ...a, title: 'new' }).map((m) => m.title)).toEqual(['b', 'new']);
  });
});
