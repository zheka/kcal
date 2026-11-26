import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { localDate } from '../../core/time';
import { downloadBlob } from '../../ui/download';

/**
 * An experiment's storage: one IndexedDB database, `kcal-lab-<id>`, apart from the app's data
 * (which no lab code writes). Every experiment gets the same four stores:
 *
 * - `data`: one JSON-like object, the experiment's own (settings, records, anything), replaced
 *   whole on every save;
 * - `files`: blobs (photos), by id, kept out of `data` so saving it stays cheap;
 * - `secrets`: API keys and the like, by name, never downloaded;
 * - `logs`: debug records, appended, each with its time and build.
 *
 * The download is the logs and the files (the data is the experiment's working state, the logs
 * what happened); `clearLab()` (clear.ts) deletes it all, with every other experiment's.
 * Files are kept until then, so whatever a log names is there to download.
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
  /**
   * The logs and the files, as one zip (fflate, loaded only when asked): `log.json`, the logs
   * oldest first as a pretty-printed array, and `files/<id>.<ext>`, every file as kept. Never
   * the secrets or the data.
   */
  exportZip(): Promise<Uint8Array>;
  /** Saves exportZip() as a file, `kcal-lab-<id>-<date>.zip`. */
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
    exportZip: async () => {
      const { zipSync, strToU8 } = await import('fflate');
      const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
        'log.json': strToU8(`${JSON.stringify(await db.getAll('logs'), null, 2)}\n`),
      };
      const tx = db.transaction('files');
      const files: [string, Blob][] = [];
      for (let c = await tx.store.openCursor(); c; c = await c.continue()) {
        files.push([c.key, c.value]);
      }
      await tx.done;
      for (const [id, blob] of files) {
        // stored as they are: photos don't shrink
        entries[`files/${id}.${extension(blob.type)}`] = [
          new Uint8Array(await blob.arrayBuffer()),
          { level: 0 },
        ];
      }
      return zipSync(entries);
    },
    download: async () => {
      const zip = await lab.exportZip();
      downloadBlob(
        `${name}-${localDate(new Date())}.zip`,
        new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }),
      );
    },
    close: () => db.close(),
  };
  return lab;
}

/** A file's extension by its type: `jpg` for a JPEG; `bin` for what isn't known. */
function extension(type: string): string {
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/json': 'json',
  };
  return known[type] ?? 'bin';
}
