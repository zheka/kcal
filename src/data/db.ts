import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * The app's IndexedDB database, `kcal`: what doesn't belong in the stored data (localStorage,
 * the backup) because it must never leave the device. Kept apart from the lab's `kcal-lab-*`
 * databases, which the lab's "Clear all lab data" deletes and this never is; "Start fresh" and
 * importing a backup replace the stored data only, so they leave this as it is.
 *
 * - `secrets`: API keys, by name (`gemini`); never in a backup.
 */

export const DB_NAME = 'kcal';

interface Schema extends DBSchema {
  secrets: { key: string; value: string };
}

export interface Db {
  secret(name: string): Promise<string | undefined>;
  /** Keeps a secret; an empty value forgets it. */
  setSecret(name: string, value: string): Promise<void>;
  close(): void;
}

/** Opens (creating it the first time) the app's database. */
export async function openAppDb(): Promise<Db> {
  const db: IDBPDatabase<Schema> = await openDB<Schema>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('secrets');
    },
    // Another tab of a newer build wants to upgrade it: let it, this one reopens on reload.
    blocking() {
      db.close();
    },
  });
  return {
    secret: (name) => db.get('secrets', name),
    setSecret: async (name, value) => {
      if (value) await db.put('secrets', value, name);
      else await db.delete('secrets', name);
    },
    close: () => db.close(),
  };
}
