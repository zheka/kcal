// @vitest-environment node
// IndexedDB (jsdom has none) from fake-indexeddb.
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { DB_NAME, openAppDb, type Db } from './db';

let db: Db | undefined;
afterEach(async () => {
  db?.close();
  db = undefined;
  await deleteDB(DB_NAME);
});

describe('the app database', () => {
  it('keeps a secret across openings, and forgets it on an empty value', async () => {
    db = await openAppDb();
    expect(await db.secret('gemini')).toBeUndefined();
    await db.setSecret('gemini', 'k1');
    db.close();
    db = await openAppDb();
    expect(await db.secret('gemini')).toBe('k1');
    await db.setSecret('gemini', '');
    expect(await db.secret('gemini')).toBeUndefined();
  });
});
