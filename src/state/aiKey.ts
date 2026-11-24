import { signal } from '@preact/signals';
import { openAppDb, type Db } from '../data/db';

/**
 * The Gemini key, the user's own from Google AI Studio: kept in the app's database (never in
 * the stored data or a backup), shown here as a signal so what needs it appears once it's set.
 * '' when there is none; undefined until it has been read.
 */
export const geminiKey = signal<string | undefined>(undefined);

const NAME = 'gemini';

let db: Promise<Db> | undefined;
const appDb = () => (db ??= openAppDb());
let loading: Promise<void> | undefined;

/** Reads the key, once. A database that can't be opened reads as no key. */
export function loadGeminiKey(): Promise<void> {
  return (loading ??= appDb()
    .then((d) => d.secret(NAME))
    .then((key) => void (geminiKey.value = key ?? ''))
    .catch((err: unknown) => {
      console.error('kcal: could not read the Gemini key', err);
      geminiKey.value = '';
    }));
}

/** Keeps the key (trimmed); an empty one forgets it. Throws when it can't be kept. */
export async function setGeminiKey(value: string): Promise<void> {
  const key = value.trim();
  await (await appDb()).setSecret(NAME, key);
  geminiKey.value = key;
}

/** Forgets what was read and the open database (tests). */
export function resetGeminiKey(): void {
  void db?.then((d) => d.close()).catch(() => {});
  db = undefined;
  loading = undefined;
  geminiKey.value = undefined;
}
