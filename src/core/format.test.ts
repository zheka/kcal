import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatNumber,
  formatNutrientValue,
  parseNumber,
  roundStored,
} from './format';

describe('parseNumber', () => {
  it('reads decimals with a point or a comma', () => {
    expect(parseNumber('2.5')).toBe(2.5);
    expect(parseNumber(' 2,5 ')).toBe(2.5);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('3.')).toBe(3);
    expect(parseNumber('0')).toBe(0);
  });

  it('refuses empty, negative and other text', () => {
    for (const text of ['', ' ', '-1', '1e3', 'abc', '1.2.3', '1,5,0']) {
      expect(parseNumber(text)).toBeNull();
    }
  });
});

describe('formatting', () => {
  it('drops trailing zeros', () => {
    expect(formatNumber(2.5, 2)).toBe('2.5');
    expect(formatNumber(3, 1)).toBe('3');
    expect(formatNumber(0.06, 1)).toBe('0.1');
  });

  it('shows kcal whole and grams with a decimal below 10', () => {
    expect(formatNutrientValue(171.6, 'kcal')).toBe('172');
    expect(formatNutrientValue(7.84, 'protein')).toBe('7.8');
    expect(formatNutrientValue(15.12, 'protein')).toBe('15');
  });

  it('marks totals with unknowns as a lower bound', () => {
    expect(formatAmount({ value: 102.4, missing: 1 }, 'protein')).toBe('≥ 102');
    expect(formatAmount({ value: 102.4, missing: 0 }, 'protein')).toBe('102');
  });

  it('rounds stored values', () => {
    expect(roundStored(422.2222222)).toBe(422.222);
  });
});
