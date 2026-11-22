import { newId } from '../core/foods';
import type { AppData } from '../core/types';
import { documentJson, parseDocument } from './backup';

/** All data lives under one key, as one document shaped like a backup (without `exportedAt`). */
export const STORAGE_KEY = 'kcal';

/**
 * Saved data beyond this many characters gets a warning. `localStorage` holds about 5 million,
 * shared with the other projects on zheka.github.io, which recommend staying under 1 million
 * each (see README, Deployment).
 */
export const SIZE_WARNING_CHARS = 1_000_000;

/**
 * What the app starts with: a water product and two quick buttons, 💧 (250 ml of water) and
 * 🍽️ (an empty meal). Ordinary data: nothing depends on it, and all of it can be changed.
 */
export function freshData(): AppData {
  // Water's nutrients are known: zeros, and 1 ml of water per g and per ml.
  const values = { carbs: 0, fat: 0, kcal: 0, protein: 0, water: 1 };
  const water = { id: newId(), name: 'water', perG: values, perMl: values, units: [] };
  return {
    goals: [],
    meals: [],
    products: [water],
    recipes: [],
    settings: {
      quickButtons: [{ amount: 250, food: water.id, label: '💧', unit: 'ml' }, { label: '🍽️' }],
    },
  };
}

export type LoadResult =
  | { ok: true; data: AppData }
  /** The saved data can't be used: `raw` is the saved text, unchanged. */
  | { ok: false; problems: string[]; raw: string };

/**
 * Reads the saved data, checked exactly like an import. When there is none, starts fresh and
 * saves that at once, so the fresh data's ids stay the same. When the check fails nothing is
 * changed, so the data can be downloaded as it is.
 */
export function loadSaved(storage: Storage = localStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    const data = freshData();
    saveData(data, storage);
    return { ok: true, data };
  }
  const result = parseDocument(raw);
  return result.ok ? result : { ok: false, problems: result.problems, raw };
}

/** Saves all data. Throws when the browser refuses (e.g. storage full); nothing is changed then. */
export function saveData(data: AppData, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, documentJson(data));
}

/** Deletes the saved data (start fresh). */
export function clearSaved(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
}

/** Size of the saved data, in characters (what `localStorage` counts). */
export function savedSize(storage: Storage = localStorage): number {
  return storage.getItem(STORAGE_KEY)?.length ?? 0;
}
