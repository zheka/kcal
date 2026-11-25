// @vitest-environment node
// Node's own Blob (jsdom's can't be read back), and fflate's unzip to check the download.
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { ScannedProductData } from '../../data/openFoodFacts';
import { itemKey } from '../meal/process';
import testAnswer from '../meal/testAnswer.json';
import type { LogRecord } from '../storage/lab';
import { applyUpdate, withContext } from './compose';
import { mealsZip, mealTest, SECTION } from './export';
import type { Attached, ComposedMeal } from './types';

// Tests run in Europe/Berlin (vite.config.ts).
const SENT = new Date('2026-11-21T07:10:31.250Z');
const SKYR: ScannedProductData = {
  code: '4006040',
  language: 'de',
  names: { de: 'Skyr Natur' },
  brands: ['Arla'],
  categories: ['en:skyrs'],
  serving: 150,
  liquid: false,
  per100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4 },
};
const CONTEXT: Attached[] = [
  { id: 'a1', kind: 'photo', file: 'f1' },
  { id: 'a2', kind: 'text', text: 'вареники' },
  { id: 'a3', kind: 'product', product: SKYR },
];
const meal = (context = CONTEXT, more: Partial<ComposedMeal> = {}): ComposedMeal => ({
  id: 'm1',
  title: '',
  at: '2026-11-21T07:00:00.000Z',
  context,
  answers: {},
  changed: context.length > 0,
  ...more,
});
const answered = (m = meal()) => applyUpdate(m, m.context, SENT, { ms: 900, answer: testAnswer });
const log = (m: ComposedMeal, more: Partial<LogRecord> = {}): LogRecord => ({
  time: SENT.toISOString(),
  build: 'abc1234',
  meal: m.id,
  request: {},
  response: { ms: 900, answer: testAnswer },
  ...more,
});
const all = () => true;

describe('a meal as a test', () => {
  it('is the inputs as attached, the time it was asked, the answer and the choices by name', () => {
    const m = { ...answered(), answers: { [itemKey(0, 0)]: { count: '14', food: 'с творогом' } } };
    const d = mealTest(m, [log(m)], 'ru', all)!;
    expect(d.name).toBe('m1.json');
    expect(d.test).toEqual({
      description: 'Обед',
      time: '2026-11-21T08:10:31+01:00',
      language: 'ru',
      inputs: [{ photo: 'data/f1.jpg' }, { text: 'вареники' }, { product: 'data/a3.json' }],
      [SECTION]: {
        meal: 'm1',
        build: 'abc1234',
        answer: testAnswer,
        answers: [
          {
            dish: 'Вареники',
            product: 'Вареники с картошкой',
            base: 'g',
            food: 'с творогом',
            count: 14,
          },
        ],
      },
    });
    expect(d.photos).toEqual([{ path: 'data/f1.jpg', file: 'f1' }]);
    expect(JSON.parse(d.products[0]!.json)).toEqual(SKYR);
  });

  it('is its inputs only when never answered, or attached to since', () => {
    const inputsOnly = { description: '', language: 'ru', [SECTION]: { meal: 'm1' } };
    expect(mealTest(meal(), [], 'ru', all)!.test).toMatchObject(inputsOnly);
    expect(mealTest(meal(), [], 'ru', all)!.test).not.toHaveProperty('time');
    const m = answered();
    const more = withContext(m, [...m.context, { id: 'a4', kind: 'text', text: 'и чай' }]);
    const d = mealTest(more, [log(m)], 'ru', all)!;
    expect(d.test).not.toHaveProperty('time');
    expect(d.test[SECTION]).toEqual({ meal: 'm1' });
    expect(d.test.inputs).toHaveLength(4);
  });

  it('takes an answer kept before 2026-11-25 from the log, if it is the one shown', () => {
    const m = answered();
    const old = { ...m };
    delete old.answer;
    delete old.answeredAt;
    const failed = log(m, { time: '2026-11-21T09:00:00.000Z', response: { ms: 1, error: 'x' } });
    const d = mealTest(old, [log(m), failed], 'ru', all)!;
    expect(d.test.time).toBe('2026-11-21T08:10:31+01:00');
    expect(d.test[SECTION]).toEqual({ meal: 'm1', build: 'abc1234', answer: testAnswer });
    // a logged answer that isn't the meal's: inputs only
    const other = log(m, { response: { ms: 9, answer: { title: 'x', dishes: [] } } });
    expect(mealTest(old, [other], 'ru', all)!.test).not.toHaveProperty('time');
    expect(mealTest(old, [], 'ru', all)!.test[SECTION]).toEqual({ meal: 'm1' });
  });

  it('leaves out a photo no longer kept, saying so; a meal with nothing attached is none', () => {
    const d = mealTest(answered(), [], 'ru', (id) => id !== 'f1')!;
    expect(d.test.inputs).toEqual([{ text: 'вареники' }, { product: 'data/a3.json' }]);
    expect(d.test[SECTION].missing).toEqual(['f1']);
    expect(d.test[SECTION]).not.toHaveProperty('build'); // no log
    expect(mealTest(meal([]), [], 'ru', all)).toBeNull();
  });
});

describe('the meals download', () => {
  it('is a zip of a test per meal, its photos as kept and its products', async () => {
    const photo = new Uint8Array([0xff, 0xd8, 1, 2, 3]);
    const empty = meal([], { id: 'm2' });
    const zip = await mealsZip([answered(), empty], [], 'ru', async (id) =>
      id === 'f1' ? new Blob([photo], { type: 'image/jpeg' }) : undefined,
    );
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['data/a3.json', 'data/f1.jpg', 'm1.json']);
    expect(files['data/f1.jpg']).toEqual(photo);
    expect(JSON.parse(strFromU8(files['data/a3.json']!))).toEqual(SKYR);
    const test = JSON.parse(strFromU8(files['m1.json']!)) as Record<string, unknown>;
    expect(test.inputs).toEqual([
      { photo: 'data/f1.jpg' },
      { text: 'вареники' },
      { product: 'data/a3.json' },
    ]);
  });
});
