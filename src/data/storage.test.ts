import { beforeEach, describe, expect, it } from 'vitest';
import { appData, egg } from '../core/testData';
import { documentJson } from './backup';
import { clearSaved, loadSaved, saveData, savedSize, STORAGE_KEY } from './storage';

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('starts fresh when nothing is saved: water and two quick buttons, saved at once', () => {
    const loaded = loadSaved();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const [water] = loaded.data.products;
    expect(loaded.data.products).toEqual([
      {
        id: water!.id,
        name: 'water',
        perG: { carbs: 0, fat: 0, kcal: 0, protein: 0, water: 1 },
        perMl: { carbs: 0, fat: 0, kcal: 0, protein: 0, water: 1 },
        units: [],
      },
    ]);
    expect(loaded.data.settings.quickButtons).toEqual([
      { amount: 250, food: water!.id, label: '💧', unit: 'ml' },
      { label: '🍽️' },
    ]);
    expect(savedSize()).toBeGreaterThan(0);
    // the same ids on the next load
    expect(loadSaved()).toEqual(loaded);
  });

  it('saves the canonical document under one key, and loads it back', () => {
    const data = appData({ products: [egg] });
    saveData(data);
    expect(Object.keys(localStorage)).toEqual([STORAGE_KEY]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(documentJson(data));
    expect(loadSaved()).toEqual({ ok: true, data });
  });

  it('refuses saved data that fails the check, keeping it unchanged', () => {
    const raw = JSON.stringify({ version: 'kcal 0.2.0', goals: {}, products: [{}] });
    localStorage.setItem(STORAGE_KEY, raw);
    const result = loadSaved();
    expect(!result.ok && result.raw).toBe(raw);
    expect(!result.ok && result.problems).toContain('goals: must be a list');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('clears the saved data', () => {
    saveData(appData());
    clearSaved();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
