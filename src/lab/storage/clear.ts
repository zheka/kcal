import { deleteDB } from 'idb';
import { LAB_PREFIX } from './lab';

/**
 * Removing every trace the lab keeps in this browser: each experiment's database, and what the
 * meal composer prototype (proto/meal-composer branch) kept before the lab existed. Only these
 * names, listed first: never anything else on the shared origin (zheka.github.io's
 * SHARED-ORIGIN.md), never the app's own `kcal`.
 */

/** The prototype's database. */
const OLD_DATABASES = ['kcal-composer'];
/** The prototype's localStorage keys (its key, model and options, its meals before IndexedDB). */
const OLD_KEY_PREFIXES = ['kcal-proto-', 'kcal-composer-'];

export interface LabTraces {
  databases: string[];
  keys: string[];
}

/** The lab's databases and localStorage keys in this browser, by name. */
export async function labTraces(): Promise<LabTraces> {
  const databases = (await indexedDB.databases())
    .map((d) => d.name ?? '')
    .filter((name) => name.startsWith(LAB_PREFIX) || OLD_DATABASES.includes(name))
    .sort();
  let keys: string[] = [];
  try {
    keys = Object.keys(localStorage)
      .filter((key) => OLD_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .sort();
  } catch {
    // no localStorage: nothing kept there
  }
  return { databases, keys };
}

/**
 * Deletes everything labTraces() finds. A database still open in another tab that doesn't let
 * go (the prototype's) is deleted once that tab closes; `blocked` is called meanwhile.
 */
export async function clearLab(blocked?: (database: string) => void): Promise<void> {
  const { databases, keys } = await labTraces();
  for (const key of keys) localStorage.removeItem(key);
  await Promise.all(databases.map((name) => deleteDB(name, { blocked: () => blocked?.(name) })));
}
