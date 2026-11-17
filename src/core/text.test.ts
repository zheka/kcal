import { describe, expect, it } from 'vitest';
import { cleanText, isClean, nameKey } from './text';

describe('cleanText', () => {
  it('trims, collapses whitespace and keeps case', () => {
    expect(cleanText('  Barilla \t Penne\n')).toBe('Barilla Penne');
  });

  it('normalises to NFC, so an accent typed two ways is one text', () => {
    expect(cleanText('Créme')).toBe('Créme');
  });

  it('empty stays empty', () => {
    expect(cleanText('   ')).toBe('');
  });
});

describe('isClean', () => {
  it('accepts cleaned text only', () => {
    expect(isClean('oat flakes')).toBe(true);
    expect(isClean('oat  flakes')).toBe(false);
    expect(isClean(' oat flakes')).toBe(false);
  });
});

describe('nameKey', () => {
  it('compares names ignoring case and spacing', () => {
    expect(nameKey(' Skyr ')).toBe(nameKey('skyr'));
    expect(nameKey('Skyr')).not.toBe(nameKey('Skyr natural'));
  });
});
