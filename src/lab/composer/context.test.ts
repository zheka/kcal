import { describe, expect, it } from 'vitest';
import { appData, egg, ing, makes, meal, oatFlakes, product, recipe } from '../../core/testData';
import { parseAnswer } from './answer';
import { candidates, contextBlock, fillPrompt, pickMatches } from './context';
import food7hist from './fixtures/food7-v2-hist-gemini.json';
import type { ComposedMeal } from './types';

const items = parseAnswer(JSON.stringify(food7hist)).answer.items;
const composed: ComposedMeal = {
  id: 'c1',
  title: 'lunch',
  at: '2026-11-20T11:30:00.000Z',
  context: [],
  items,
  changed: false,
};

describe('history candidates', () => {
  it('describe my products, recipes and composed items as test 4 did', () => {
    const oats = recipe('oats', [ing(oatFlakes, 60)], [makes(1, 'bowl')]);
    const app = appData({
      products: [{ ...egg, barcode: '4006040002093' }, oatFlakes],
      recipes: [oats],
      meals: [meal('2026-11-19T07:30:00.000Z', [ing(egg, 2, 'u:piece')])],
    });
    const lines = candidates(app, [composed]).map((c) => `"${c.name}" (${c.kind}): ${c.details}`);
    expect(lines).toContain(
      '"Куриные тефтели" (history): 1 шт. = 25 g; per 100 g: 160 kcal, protein 14, fat 9, carbs 6; last time: 8 шт.',
    );
    expect(lines).toContain(
      '"egg" (label): 1 piece = 60 g; per 100 g: 143 kcal, protein 12.6, fat 9.5, carbs 0.7; last time: 2 piece',
    );
    expect(lines).toContain(
      '"oat flakes" (my product): per 100 g: 370 kcal, protein 13, fat 7, carbs 59',
    );
    expect(lines.some((l) => l.startsWith('"oats" (my recipe): 1 bowl: 222 kcal'))).toBe(true);
  });

  it('are picked by words of the input first, then by when last eaten', () => {
    const all = candidates(
      appData({ products: [product('chicken mortadella', { kcal: 1.86 }), oatFlakes] }),
      [composed],
    );
    const picked = pickMatches(all, '2 slices of mortadella', []).map((c) => c.name);
    expect(picked[0]).toBe('chicken mortadella');
    expect(picked).toHaveLength(all.length);
  });
});

describe('the prompt', () => {
  it('fills the context and the input into prompt v3', () => {
    const context = contextBlock(items.slice(0, 1), [], new Date(2026, 10, 21, 12, 30), 'ru');
    expect(context).toContain('language: ru');
    expect(context).toContain('time: 12:30, place: unknown');
    expect(context).toContain('meal so far: [{"name":"Куриные тефтели"');
    expect(context).toContain('history matches: none');
    const prompt = fillPrompt(context);
    expect(prompt).toContain('You are the food-recognition step');
    expect(prompt).toContain('## Context\n\nlanguage: ru');
    expect(prompt).toContain('## User input\n\nThe user input follows as separate parts');
    expect(prompt).not.toContain('{CONTEXT}');
  });
});
