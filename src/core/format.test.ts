import { describe, expect, it } from 'vitest';
import { formatNumber, formatNutrient, formatNutrientValue, parseNumber } from './format';

describe('parseNumber', () => {
  it('reads decimals with a point or a comma', () => {
    expect(parseNumber('2.5')).toBe(2.5);
    expect(parseNumber(' 2,5 ')).toBe(2.5);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('0')).toBe(0);
  });

  it('refuses empty, negative and other text', () => {
    for (const text of ['', ' ', '-1', '1e3', 'abc', '1.2.3']) expect(parseNumber(text)).toBeNull();
  });
});

describe('formatting', () => {
  it('drops trailing zeros', () => {
    expect(formatNumber(2.5, 2)).toBe('2.5');
    expect(formatNumber(3, 1)).toBe('3');
  });

  it('shows kcal and water whole, grams with a decimal below 10', () => {
    expect(formatNutrientValue(171.6, 'kcal')).toBe('172');
    expect(formatNutrientValue(297.4, 'water')).toBe('297');
    expect(formatNutrientValue(7.84, 'protein')).toBe('7.8');
    expect(formatNutrientValue(15.12, 'protein')).toBe('15');
  });

  it('names the amount', () => {
    expect(formatNutrient(690, 'kcal')).toBe('690 kcal');
    expect(formatNutrient(48, 'protein')).toBe('48 g protein');
    expect(formatNutrient(330, 'water')).toBe('330 ml water');
  });
});
