import { describe, expect, it } from 'vitest';
import { appData, egg, product } from '../../core/testData';
import { ANSWER_SCHEMA, parseAnswer } from './answer';
import { applyUpdate, checkAnswer, updateRequest, withContext } from './compose';
import food7hist from './fixtures/food7-v2-hist-gemini.json';
import { productFromFoods, productFromLookup } from './scan';
import type { Attached, ComposedMeal } from './types';

const NOW = new Date('2026-11-21T11:30:00.000Z');
const OPTIONS = { temperature: 0.2, thinking: 'default' } as const;
const meal = (context: Attached[] = [], more: Partial<ComposedMeal> = {}): ComposedMeal => ({
  id: 'm1',
  title: '',
  at: NOW.toISOString(),
  context,
  items: [],
  changed: context.length > 0,
  ...more,
});
const text = (id: string, t: string): Attached => ({ id, kind: 'text', text: t });
const photo = (id: string): Attached => ({ id, kind: 'photo', file: `file-${id}` });
const items = parseAnswer(JSON.stringify(food7hist)).answer.items;

describe('the update request', () => {
  it('sends the prompt, then the whole context as attached, in order', () => {
    const skyr = productFromLookup('4006040', {
      kind: 'found',
      name: 'Skyr natur, Arla',
      per100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4 },
      liquid: false,
      serving: 150,
    });
    const m = meal(
      [
        photo('a'),
        text('b', 'chicken meatballs'),
        { id: 'c', kind: 'product', product: skyr },
        text('d', 'potatoes 100 g'),
      ],
      { items: items.slice(0, 1) },
    );
    const request = updateRequest(m, null, [], NOW, 'gemini-x', OPTIONS);
    expect(request).toMatchObject({
      model: 'gemini-x',
      instructions: '',
      config: { schema: ANSWER_SCHEMA, temperature: 0.2, thinking: 'default' },
    });
    const [prompt, ...rest] = request.content;
    expect(prompt).toEqual({ text: expect.stringContaining('meal so far: [{"name":"Куриные') });
    expect(rest).toEqual([
      { image: 'file-a' },
      { text: 'chicken meatballs' },
      { text: JSON.stringify(skyr) },
      { text: 'potatoes 100 g' },
    ]);
    expect(JSON.parse((rest[2] as { text: string }).text)).toEqual({
      code: '4006040',
      from: 'Open Food Facts',
      name: 'Skyr natur, Arla',
      liquid: false,
      per_100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4, water_ml: null },
      serving: 150,
    });
  });

  it('picks history matches by all the texts', () => {
    const app = appData({ products: [egg] });
    const m = meal([text('a', 'two eggs')]);
    const { content } = updateRequest(m, app, [], NOW, 'gemini-x', OPTIONS);
    expect((content[0] as { text: string }).text).toContain('- "egg" (my product)');
  });
});

describe('scanned products', () => {
  it('come from my product with that barcode, per 100 g, with its first unit as a serving', () => {
    const bar = product('bar', { kcal: 4.5, protein: 0.2 }, [{ id: 'u', name: 'bar', g: 45 }]);
    const app = appData({ products: [{ ...bar, barcode: '123' }] });
    expect(productFromFoods('123', app)).toEqual({
      code: '123',
      from: 'my foods',
      name: 'bar',
      liquid: false,
      per_100: { kcal: 450, protein: 20, fat: 0, carbs: 0, water_ml: null },
      serving: 45,
    });
    expect(productFromFoods('999', app)).toBeNull();
  });
});

describe('applying an update', () => {
  const answer = food7hist;

  it('takes the answer’s items and label; the context is answered', () => {
    const m = meal([text('a', 'lunch')]);
    const next = applyUpdate(m, m.context, { ms: 900, answer });
    expect(next.items.map((i) => i.name)).toEqual(answer.items.map((i) => i.name));
    expect(next.title).toBe(answer.meal_label);
    expect(next.changed).toBe(false);
  });

  it('keeps the meal as it was when it failed, saying why, until the context changes', () => {
    const m = meal([text('a', 'lunch')], { items: items.slice(0, 1), title: 'Lunch' });
    const failed = applyUpdate(m, m.context, { ms: 300, error: 'Gemini 400: bad request' });
    expect(failed).toEqual({ ...m, failed: 'Gemini 400: bad request' });
    expect(applyUpdate(m, m.context, null, 'no API key').failed).toBe('no API key');
    const added = withContext(failed, [...failed.context, text('b', 'and tea')]);
    expect(added.failed).toBeUndefined();
    expect(added.changed).toBe(true);
  });

  it('still needs an update when the context changed while it ran', () => {
    const m = meal([text('a', 'lunch')]);
    const meanwhile = withContext(m, [...m.context, text('b', 'and tea')]);
    expect(applyUpdate(meanwhile, m.context, { ms: 900, answer }).changed).toBe(true);
    // a failure for what is no longer the context isn't shown
    expect(applyUpdate(meanwhile, m.context, { ms: 9, error: 'x' })).toEqual(meanwhile);
  });

  it('checks the answer strictly: any problem and it isn’t used', () => {
    expect(checkAnswer(answer)).toEqual([]);
    const broken = { ...answer, items: [{ ...answer.items[0], per_100g: null }] };
    expect(checkAnswer(broken)).toEqual([
      expect.stringContaining('per_100g is missing or not numbers'),
    ]);
  });
});
