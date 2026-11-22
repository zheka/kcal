import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * An experiment's storage: one IndexedDB database, `kcal-lab-<id>`, apart from the app's data
 * (which no lab code writes). Every experiment gets the same four stores:
 *
 * - `data`: one JSON-like object, the experiment's own (settings, records, anything), replaced
 *   whole on every save;
 * - `files`: blobs (photos), by id, kept out of `data` so saving it stays cheap;
 * - `secrets`: API keys and the like, by name, never downloaded;
 * - `logs`: debug records, appended, each with its time and build: what the download holds.
 *
 * `clearLab()` (clear.ts) deletes it all, with every other experiment's.
 */

/** The build's commit (__APP_VERSION__ is `<commit> · <date>`). */
const BUILD = __APP_VERSION__.split(' ')[0]!;

/** Every lab database's name starts with this (see zheka.github.io's SHARED-ORIGIN.md). */
export const LAB_PREFIX = 'kcal-lab-';

export interface LogRecord {
  /** When it happened (by default, when it was logged), ISO 8601 (UTC). */
  time: string;
  /** The commit of the build that logged it. */
  build: string;
  [field: string]: unknown;
}

interface LabSchema<T> extends DBSchema {
  data: { key: 'data'; value: T };
  files: { key: string; value: Blob };
  secrets: { key: string; value: string };
  logs: { key: number; value: LogRecord };
}

export interface Lab<T> {
  readonly id: string;
  readonly data: {
    /** The experiment's object, or undefined before its first save. */
    get(): Promise<T | undefined>;
    set(value: T): Promise<void>;
  };
  readonly files: {
    /** Keeps the blob; returns its new id. */
    put(blob: Blob): Promise<string>;
    get(id: string): Promise<Blob | undefined>;
    delete(id: string): Promise<void>;
  };
  secret(name: string): Promise<string | undefined>;
  /** Keeps a secret; an empty value forgets it. */
  setSecret(name: string, value: string): Promise<void>;
  /**
   * Appends a debug record, stored as JSON (what JSON can't hold is dropped), with the time (now,
   * unless it has its own) and the build added. Never fails: a record that can't be kept goes to
   * the console instead.
   */
  log(record: Record<string, unknown> & { time?: string; build?: never }): Promise<void>;
  logs(): Promise<LogRecord[]>;
  clearLogs(): Promise<void>;
  /** The logs, oldest first, as a pretty-printed JSON array. */
  exportJson(): Promise<string>;
  /** Saves exportJson() as a file, `kcal-lab-<id>-<date>.json`. */
  download(): Promise<void>;
  close(): void;
}

/** Opens (creating it the first time) the experiment's database. `id`: lowercase, digits, -. */
export async function openLab<T>(id: string): Promise<Lab<T>> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error(`bad experiment id: "${id}"`);
  const name = LAB_PREFIX + id;
  const db: IDBPDatabase<LabSchema<T>> = await openDB<LabSchema<T>>(name, 1, {
    upgrade(db) {
      db.createObjectStore('data');
      db.createObjectStore('files');
      db.createObjectStore('secrets');
      db.createObjectStore('logs', { autoIncrement: true });
    },
    // Another tab (or clearLab) wants to delete or upgrade the database: let it.
    blocking() {
      db.close();
    },
  });

  const lab: Lab<T> = {
    id,
    data: {
      get: () => db.get('data', 'data'),
      set: async (value) => {
        await db.put('data', value, 'data');
      },
    },
    files: {
      put: async (blob) => {
        const fileId = crypto.randomUUID();
        await db.put('files', blob, fileId);
        return fileId;
      },
      get: (fileId) => db.get('files', fileId),
      delete: (fileId) => db.delete('files', fileId),
    },
    secret: (key) => db.get('secrets', key),
    setSecret: async (key, value) => {
      if (value) await db.put('secrets', value, key);
      else await db.delete('secrets', key);
    },
    log: async (record) => {
      try {
        const entry = JSON.parse(
          JSON.stringify({ time: new Date().toISOString(), build: BUILD, ...record }),
        ) as LogRecord;
        await db.add('logs', entry);
      } catch (err) {
        console.error('lab: could not log', record, err);
      }
    },
    logs: () => db.getAll('logs'),
    clearLogs: () => db.clear('logs'),
    exportJson: async () => JSON.stringify(await db.getAll('logs'), null, 2),
    download: async () => {
      const json = await lab.exportJson();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    close: () => db.close(),
  };
  return lab;
}
