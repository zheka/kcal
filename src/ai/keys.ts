import { signal } from '@preact/signals';
import { openAppDb, type Db } from '../data/db.ts';

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

/**
 * A key as stored now, read afresh (a request reads it just before sending, so a key set or
 * forgotten meanwhile, in another tab or the app, is the one used); '' when there is none or it
 * can't be read.
 */
export async function readKey(name: KeyName): Promise<string> {
  try {
    return (await (await appDb()).secret(name)) ?? '';
  } catch (err) {
    console.error(`kcal: could not read the key ${name}`, err);
    return '';
  }
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

/** The Gemini keys as stored now, for the tab's Gemini (src/ai/browser.ts). */
export async function geminiKeys(): Promise<{ key: string; key2: string }> {
  const [key, key2] = await Promise.all([readKey('gemini'), readKey('gemini-2')]);
  return { key, key2 };
}
