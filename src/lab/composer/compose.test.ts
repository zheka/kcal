import { describe, expect, it } from 'vitest';
import type { ScannedProductData } from '../../data/openFoodFacts';
import { itemKey } from '../meal/process';
import { MEAL_SCHEMA } from '../meal/schema';
import { SETTINGS } from '../meal/settings';
import testAnswer from '../meal/testAnswer.json';
import { applyUpdate, shown, updateRequest, withContext } from './compose';
import type { Attached, ComposedMeal } from './types';

const NOW = new Date('2026-11-21T11:30:00.000Z');
const meal = (context: Attached[] = [], more: Partial<ComposedMeal> = {}): ComposedMeal => ({
  id: 'm1',
  title: '',
  at: NOW.toISOString(),
  context,
  answers: {},
  changed: context.length > 0,
  ...more,
});
const text = (id: string, t: string): Attached => ({ id, kind: 'text', text: t });
const photo = (id: string): Attached => ({ id, kind: 'photo', file: `file-${id}` });
const answered = (m: ComposedMeal) =>
  applyUpdate(m, m.context, NOW, { ms: 900, answer: testAnswer });

describe('the update request', () => {
  it('is the tool’s request: the prompt, the settings, the context as attached, in order', () => {
    const skyr: ScannedProductData = {
      code: '4006040',
      language: 'de',
      names: { de: 'Skyr Natur' },
      brands: ['Arla'],
      categories: ['en:skyrs'],
      serving: 150,
      liquid: false,
      per100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4 },
    };
    const m = meal([
      photo('a'),
      text('b', 'вареники'),
      { id: 'c', kind: 'product', product: skyr },
    ]);
    const request = updateRequest(m, NOW, 'ru');
    expect(request).toMatchObject({
      model: SETTINGS.model,
      instructions: expect.stringContaining('You recognize what was eaten'),
      config: { schema: MEAL_SCHEMA, thinking: SETTINGS.thinking },
    });
    const [context, ...rest] = request.content;
    expect((context as { text: string }).text).toContain('answer language: ru');
    expect(rest.slice(0, 3)).toEqual([
      { file: 'file-a' },
      { text: 'вареники' },
      { text: JSON.stringify(skyr) },
    ]);
    expect(rest.at(-1)).toEqual({ text: expect.stringContaining('Before answering, check') });
  });
});

describe('applying an update', () => {
  it('takes the answer as read, with no answers yet; the context is answered', () => {
    const m = meal([text('a', 'вареники')], { answers: { [itemKey(0, 0)]: { count: '14' } } });
    const next = answered(m);
    expect(next.meal?.dishes.map((d) => d.name)).toEqual(['Вареники', 'Чай']);
    expect(next.title).toBe('Обед');
    expect(next.answers).toEqual({});
    expect(next.changed).toBe(false);
  });

  it('keeps the answer as it came, and when it was asked for, local time (tests: Berlin)', () => {
    const next = answered(meal([text('a', 'вареники')]));
    expect(next.answer).toEqual(testAnswer);
    expect(next.answeredAt).toBe('2026-11-21T12:30:00+01:00');
  });

  it('shows the meal with the user’s answers, values and totals updated', () => {
    const m = answered(meal([text('a', 'вареники')]));
    expect(shown(meal(), 'ru')).toBeNull();
    expect(shown(m, 'ru')!.total.kcal).toBeCloseTo(739.3);
    const more = { ...m, answers: { [itemKey(0, 0)]: { count: '14' } } };
    expect(shown(more, 'ru')!.total.kcal).toBeCloseTo(1009.3); // + 4 × 45 g × 150 / 100
    expect(shown(more, 'ru')!.total.water).toBe(250); // the tea
  });

  it('keeps the meal as it was when it failed, saying why, until the context changes', () => {
    const m = answered(meal([text('a', 'вареники')]));
    const failed = applyUpdate(m, m.context, NOW, { ms: 300, error: 'Gemini 400: bad request' });
    expect(failed).toEqual({ ...m, failed: 'Gemini 400: bad request' });
    expect(applyUpdate(m, m.context, NOW, null, 'no API key').failed).toBe('no API key');
    const added = withContext(failed, [...failed.context, text('b', 'и чай')]);
    expect(added.failed).toBeUndefined();
    expect(added.changed).toBe(true);
  });

  it('still needs an update when the context changed while it ran', () => {
    const m = meal([text('a', 'вареники')]);
    const meanwhile = withContext(m, [...m.context, text('b', 'и чай')]);
    expect(applyUpdate(meanwhile, m.context, NOW, { ms: 900, answer: testAnswer }).changed).toBe(
      true,
    );
    // a failure for what is no longer the context isn't shown
    expect(applyUpdate(meanwhile, m.context, NOW, { ms: 9, error: 'x' })).toEqual(meanwhile);
  });
});
