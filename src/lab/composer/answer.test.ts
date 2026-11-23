import { describe, expect, it } from 'vitest';
import { parseAnswer } from './answer';
import { amounts, choose, setCount, total } from './recompute';
import testAnswer from './testAnswer.json';

const read = (json: object) => parseAnswer(JSON.stringify(json));

describe('a well-formed answer', () => {
  it('is read without problems, every item kept', () => {
    const { answer, problems } = read(testAnswer);
    expect(problems).toEqual([]);
    expect(answer.items).toHaveLength(testAnswer.items.length);
  });

  it('adds up at its defaults', () => {
    const items = read(testAnswer).answer.items;
    // meatballs 320 + bread 114 + cheese 111 + sausage 93 (from history)
    const known = items.filter((i) => i.source === 'history');
    expect(Math.round(total(known).kcal)).toBe(638);
  });
});

describe('local recompute', () => {
  const meatballs = read(testAnswer).answer.items[0]!;

  it('is count × grams per unit × values per 100 g', () => {
    expect(amounts(meatballs)).toMatchObject({ grams: 200, kcal: 320, protein: 28 });
    expect(amounts(setCount(meatballs, 6)).kcal).toBe(240);
  });

  it('uses the chosen variant’s values and size', () => {
    const mixed = choose(meatballs, 'mince', 'pork and beef');
    // 8 × 35 g of 215 kcal / 100 g
    expect(amounts(mixed)).toMatchObject({ grams: 280, kcal: 602 });
    expect(meatballs.parameters[0]!.default).toBe('chicken');
  });
});

describe('parseAnswer', () => {
  it('leaves out what isn’t of the expected shape, and says why', () => {
    const { answer, problems } = parseAnswer(
      JSON.stringify({
        meal_label: 'lunch',
        items: [
          { name: 'soup', count: 0, grams_per_unit: 300, per_100g: {} },
          { name: 'bread', count: 1, unit: 'slice', grams_per_unit: 40 },
          {
            name: 'salad',
            count: 1,
            unit: 'bowl',
            grams_per_unit: 250,
            per_100g: { kcal: 120, protein: 6, fat: 9, carbs: 4, water_ml: null },
            source: 'visual',
            amount_flag: false,
            likely_counts: [1, 2],
            parameters: [
              {
                name: 'dressing',
                variants: [
                  { label: 'light', per_100g: null, grams_per_unit: null },
                  { label: 'heavy', per_100g: null, grams_per_unit: null },
                ],
                default: 'normal',
                surfaced: true,
                why: '',
              },
            ],
          },
        ],
      }),
    );
    expect(answer.items.map((i) => i.name)).toEqual(['salad']);
    // likely values only with a flag; an unknown default falls back to the first variant
    expect(answer.items[0]!.likely_counts).toEqual([]);
    expect(answer.items[0]!.parameters[0]!.default).toBe('light');
    expect(problems).toEqual([
      'item #1 "soup": no positive count',
      'item #2 "bread": per_100g is missing or not numbers',
      'item #3 "salad", "dressing": default "normal" isn\'t a variant',
    ]);
  });

  it('refuses an answer that isn’t JSON or has no items', () => {
    expect(parseAnswer('Sure!').problems).toEqual(['the answer is not JSON']);
    expect(parseAnswer('{"foods": []}').problems).toEqual(['the answer has no list of items']);
  });
});
