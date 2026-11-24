import { signal } from '@preact/signals';
import { openAppDb, type Db } from '../data/db';

/**
 * The user's API keys, by name: kept in the app's database (never in the stored data or a
 * backup), shown here as a signal so what needs a key appears once it's set. A key's name is its
 * provider's (`gemini`), and `<provider>-2` for a second one.
 */
export const KEY_NAMES = ['gemini', 'gemini-2'] as const;
export type KeyName = (typeof KEY_NAMES)[number];

/** Each key, '' when there is none; undefined until they have been read. */
export const keys = signal<Record<KeyName, string> | undefined>(undefined);

let db: Promise<Db> | undefined;
const appDb = () => (db ??= openAppDb());
let loading: Promise<void> | undefined;

const none = (): Record<KeyName, string> =>
  Object.fromEntries(KEY_NAMES.map((n) => [n, ''])) as Record<KeyName, string>;

/** Reads the keys, once. A database that can't be opened reads as no keys. */
export function loadKeys(): Promise<void> {
  return (loading ??= (async () => {
    try {
      const d = await appDb();
      const read = none();
      for (const name of KEY_NAMES) read[name] = (await d.secret(name)) ?? '';
      keys.value = read;
    } catch (err) {
      console.error('kcal: could not read the keys', err);
      keys.value = none();
    }
  })());
}

/** Keeps a key (trimmed); an empty one forgets it. Throws when it can't be kept. */
export async function setKey(name: KeyName, value: string): Promise<void> {
  const key = value.trim();
  await (await appDb()).setSecret(name, key);
  keys.value = { ...(keys.value ?? none()), [name]: key };
}

/** Forgets what was read and the open database (tests). */
export function resetKeys(): void {
  void db?.then((d) => d.close()).catch(() => {});
  db = undefined;
  loading = undefined;
  keys.value = undefined;
}
