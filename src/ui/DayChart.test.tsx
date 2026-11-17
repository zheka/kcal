import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import type { Nutrient } from '../config';
import type { Nutrition } from '../core/nutrition';
import { chartScales, DayChart } from './DayChart';

function nutrition(values: Record<Nutrient, number>): Nutrition {
  return Object.fromEntries(
    Object.entries(values).map(([n, value]) => [n, { value, missing: 0 }]),
  ) as unknown as Nutrition;
}

/** Height of each bar's "taken" part, by nutrient. */
function takenHeights(container: Element): Record<string, string> {
  const heights: Record<string, string> = {};
  for (const column of container.querySelectorAll<HTMLElement>('.bar-column')) {
    const nutrient = [...column.classList].find((c) => c.startsWith('nutrient-'))!.slice(9);
    heights[nutrient] = column.querySelector<HTMLElement>('.bar-taken')!.style.height;
  }
  return heights;
}

afterEach(cleanup);

describe('chart scales', () => {
  it('shares one scale among nutrients of the same unit', () => {
    const total = nutrition({ kcal: 1500, protein: 100, fat: 40, carbs: 160 });
    const scales = chartScales({ kcal: 2000, protein: 150 }, total);
    expect(scales.get('kcal')).toBe(2000);
    // carbs (160 g, no goal) is above the protein goal (150 g)
    expect(scales.get('g')).toBe(160);
  });

  it('draws equal amounts of the same unit equally high', () => {
    const { container } = render(
      <DayChart
        goals={{ kcal: 2000, protein: 150 }}
        taken={nutrition({ kcal: 500, protein: 30, fat: 30, carbs: 75 })}
      />,
    );
    expect(takenHeights(container)).toEqual({
      kcal: '25%',
      protein: '20%',
      fat: '20%',
      carbs: '50%',
    });
  });

  it('keeps an empty day flat', () => {
    const { container } = render(
      <DayChart goals={null} taken={nutrition({ kcal: 0, protein: 0, fat: 0, carbs: 0 })} />,
    );
    expect(Object.values(takenHeights(container))).toEqual(['0%', '0%', '0%', '0%']);
  });
});
