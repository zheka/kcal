import { newId } from '../core/foods';
import type { AppData } from '../core/types';
import { documentJson, parseDocument } from './backup';

/** All data lives under one key, as one document shaped like a backup (without `exportedAt`). */
export const STORAGE_KEY = 'kcal';

/** Saved data beyond this many characters gets a warning. */
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

/**
 * The saved text as this window last read or wrote it: what its data is built on. Another
 * window (the installed app and a browser tab, or an old tab kept alive) may save meanwhile;
 * `savedByOtherWindow` tells, so that a save never erases what the other window saved.
 * `undefined`: this window hasn't read or written yet.
 */
let lastSeen: string | null | undefined;

/** Another window saved data that this one can't read (e.g. a newer version of the app). */
export class OtherWindowDataError extends Error {
  constructor(readonly problems: string[]) {
    super('the app saved data in another window that this one can’t read; reload the app');
    this.name = 'OtherWindowDataError';
  }
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
  lastSeen = raw;
  if (raw === null) {
    const data = freshData();
    saveData(data, storage);
    return { ok: true, data };
  }
  const result = parseDocument(raw);
  return result.ok ? result : { ok: false, problems: result.problems, raw };
}

/** Reads the saved data without ever writing: null when there is none or it fails its check. */
export function peekSaved(storage: Storage = localStorage): AppData | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const result = parseDocument(raw);
  return result.ok ? result.data : null;
}

/** Saves all data. Throws when the browser refuses (e.g. storage full); nothing is changed then. */
export function saveData(data: AppData, storage: Storage = localStorage): void {
  const text = documentJson(data);
  storage.setItem(STORAGE_KEY, text);
  lastSeen = text;
}

/** Deletes the saved data (start fresh). */
export function clearSaved(storage: Storage = localStorage): void {
  storage.removeItem(STORAGE_KEY);
  lastSeen = null;
}

/**
 * What another window saved since this one last read or wrote: the data, or null when the
 * saved text is unchanged (or was deleted, which only starting fresh does: this window's data
 * is then saved again on its next change). Throws `OtherWindowDataError` when the saved data
 * fails its check, so that nothing is saved over data this window can't read.
 */
export function savedByOtherWindow(storage: Storage = localStorage): AppData | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === lastSeen || raw === null) return null;
  const result = parseDocument(raw);
  if (!result.ok) throw new OtherWindowDataError(result.problems);
  lastSeen = raw;
  return result.data;
}

/** Size of the saved data, in characters (what `localStorage` counts). */
export function savedSize(storage: Storage = localStorage): number {
  return storage.getItem(STORAGE_KEY)?.length ?? 0;
}
