import { describe, expect, it } from 'vitest';
import { isStoredPrecision, roundStored, thousandths } from './decimal';

describe('roundStored', () => {
  it('rounds to 3 decimals, half up on the decimal value', () => {
    expect(roundStored(4.2222222)).toBe(4.222);
    expect(roundStored(1.0005)).toBe(1.001);
    expect(roundStored(1.0004999)).toBe(1);
    expect(roundStored(0.126)).toBe(0.126);
    expect(roundStored(190 / 45)).toBe(4.222);
    expect(roundStored(2 / 3)).toBe(0.667);
  });

  it('keeps whole numbers and turns -0 into 0', () => {
    expect(roundStored(60)).toBe(60);
    expect(Object.is(roundStored(-0), 0)).toBe(true);
    expect(Object.is(roundStored(-0.0001), 0)).toBe(true);
  });

  it('handles very small and large values', () => {
    expect(roundStored(0.0004)).toBe(0);
    expect(roundStored(0.0005)).toBe(0.001);
    expect(roundStored(123456.7894)).toBe(123456.789);
  });
});

describe('isStoredPrecision', () => {
  it('accepts at most 3 decimals', () => {
    expect(isStoredPrecision(1.03)).toBe(true);
    expect(isStoredPrecision(0.126)).toBe(true);
    expect(isStoredPrecision(4.2222)).toBe(false);
    expect(isStoredPrecision(Number.NaN)).toBe(false);
  });
});

describe('thousandths', () => {
  it('turns stored numbers into exact integers', () => {
    expect(thousandths(1.03)).toBe(1030);
    expect(thousandths(0.1)).toBe(100);
    expect(thousandths(25)).toBe(25000);
    expect(thousandths(0.126)).toBe(126);
  });
});
