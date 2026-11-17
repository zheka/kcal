import { beforeEach, describe, expect, it } from 'vitest';
import { appData, egg } from '../core/testData';
import { clearSaved, EMPTY_DATA, loadSaved, saveData, savedSize, STORAGE_KEY } from './storage';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty when nothing is saved', () => {
    expect(loadSaved()).toEqual({ ok: true, data: EMPTY_DATA });
    expect(savedSize()).toBe(0);
  });

  it('loads what was saved, under one key', () => {
    const data = appData({ products: [egg] });
    saveData(data);
    expect(Object.keys(localStorage)).toEqual([STORAGE_KEY]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe('kcal 0.1.0');
    expect(loadSaved()).toEqual({ ok: true, data });
    expect(savedSize()).toBeGreaterThan(0);
  });

  it('refuses saved data that fails the check, keeping it unchanged', () => {
    const raw = JSON.stringify({ version: 'kcal 0.1.0', goals: [], products: [{}] });
    localStorage.setItem(STORAGE_KEY, raw);
    const result = loadSaved();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.raw).toBe(raw);
    expect(!result.ok && result.problems).toContain('recipes: missing');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('clears the saved data', () => {
    saveData(appData());
    clearSaved();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
