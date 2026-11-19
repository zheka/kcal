import type { AppData } from '../core/types';
import { documentJson, parseDocument } from './backup';

/** All data lives under one key, as one document shaped like a backup (without `exportedAt`). */
export const STORAGE_KEY = 'kcal';

/** Saved data beyond this many characters gets a warning: `localStorage` holds about 5 million. */
export const SIZE_WARNING_CHARS = 3_000_000;

export const EMPTY_DATA: AppData = { goals: [], meals: [], products: [], recipes: [] };

export type LoadResult =
  | { ok: true; data: AppData }
  /** The saved data can't be used: `raw` is the saved text, unchanged. */
  | { ok: false; problems: string[]; raw: string };

/**
 * Reads the saved data, checked exactly like an import; starts empty when there is none.
 * When the check fails nothing is changed, so the data can be downloaded as it is.
 */
export function loadSaved(storage: Storage = localStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return { ok: true, data: EMPTY_DATA };
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
