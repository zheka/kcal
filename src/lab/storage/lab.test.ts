// @vitest-environment node
// IndexedDB (jsdom has none) from fake-indexeddb; Node's own Blob, which it can store.
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { openLab, type Lab } from './lab';
import { clearLab, labTraces } from './clear';

const opened: Lab<unknown>[] = [];
async function open<T>(id = 'test'): Promise<Lab<T>> {
  const lab = await openLab<T>(id);
  opened.push(lab as Lab<unknown>);
  return lab;
}

/** A localStorage stand-in (Node has none). */
function fakeLocalStorage(entries: Record<string, string>): Storage {
  const store = new Map(Object.entries(entries));
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  // Object.keys(localStorage) lists the stored keys, as in a browser.
  return new Proxy(storage, {
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: (_, k) =>
      typeof k === 'string' && store.has(k)
        ? { enumerable: true, configurable: true, value: store.get(k) }
        : undefined,
  }) as Storage;
}

afterEach(async () => {
  for (const lab of opened.splice(0)) lab.close();
  for (const { name } of await indexedDB.databases()) if (name) indexedDB.deleteDatabase(name);
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('openLab', () => {
  it('names the database after the experiment, and refuses odd ids', async () => {
    await open('meal-composer');
    expect((await indexedDB.databases()).map((d) => d.name)).toEqual(['kcal-lab-meal-composer']);
    await expect(openLab('')).rejects.toThrow('bad experiment id');
    await expect(openLab('Composer')).rejects.toThrow('bad experiment id');
    await expect(openLab('a/b')).rejects.toThrow('bad experiment id');
  });

  it('keeps one data object, replaced whole, across openings', async () => {
    const lab = await open<{ meals: string[]; model?: string }>();
    expect(await lab.data.get()).toBeUndefined();
    await lab.data.set({ meals: ['a'], model: 'm' });
    await lab.data.set({ meals: ['a', 'b'] });
    lab.close();
    const again = await open<{ meals: string[] }>();
    expect(await again.data.get()).toEqual({ meals: ['a', 'b'] });
  });

  it('keeps files by id', async () => {
    const lab = await open();
    const id = await lab.files.put(new Blob(['photo'], { type: 'image/jpeg' }));
    const blob = await lab.files.get(id);
    expect(blob?.type).toBe('image/jpeg');
    expect(await blob?.text()).toBe('photo');
    await lab.files.delete(id);
    expect(await lab.files.get(id)).toBeUndefined();
  });

  it('keeps secrets; an empty value forgets one', async () => {
    const lab = await open();
    await lab.setSecret('gemini', 'key-1234');
    expect(await lab.secret('gemini')).toBe('key-1234');
    await lab.setSecret('gemini', '');
    expect(await lab.secret('gemini')).toBeUndefined();
  });

  it('appends log records as JSON, with their time and build, in order', async () => {
    const lab = await open();
    await lab.log({ event: 'ask', model: 'm', fn: () => 1, at: undefined });
    await lab.log({ time: '2026-11-22T13:48:05.120Z', event: 'answer', ms: 1200 });
    expect(await lab.logs()).toEqual([
      {
        time: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/),
        build: expect.stringMatching(/^\S+$/),
        event: 'ask',
        model: 'm',
      },
      { time: '2026-11-22T13:48:05.120Z', build: expect.any(String), event: 'answer', ms: 1200 },
    ]);
  });

  it('never fails to log: what JSON can’t hold goes to the console', async () => {
    const lab = await open();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      await expect(lab.log({ cyclic })).resolves.toBeUndefined();
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(1);
    expect(await lab.logs()).toEqual([]);
  });

  it('exports only the logs, oldest first, as a pretty-printed array; clears them', async () => {
    const lab = await open<{ n: number }>();
    await lab.data.set({ n: 1 });
    await lab.files.put(new Blob(['12345'], { type: 'image/png' }));
    await lab.setSecret('gemini', 'key-1234');
    await lab.log({ event: 'x' });
    await lab.log({ event: 'y' });
    const json = await lab.exportJson();
    expect(json).toMatch(/^\[\n {2}\{\n {4}"time"/);
    expect(JSON.parse(json)).toEqual([
      { time: expect.any(String), build: expect.any(String), event: 'x' },
      { time: expect.any(String), build: expect.any(String), event: 'y' },
    ]);
    expect(json).not.toContain('key-1234');
    await lab.clearLogs();
    expect(await lab.logs()).toEqual([]);
    expect(await lab.data.get()).toEqual({ n: 1 });
  });
});

describe('clearLab', () => {
  it('deletes every lab database and the prototype’s leftovers, nothing else', async () => {
    globalThis.localStorage = fakeLocalStorage({
      kcal: '{"real":"data"}',
      'kcal-proto-gemini-key': 'k',
      'kcal-composer-options': '{}',
      'other-project-settings': 'x',
    });
    const a = await open('one');
    await a.data.set({ x: 1 });
    await open('two'); // left open: clearLab closes it
    for (const name of ['kcal-composer', 'kcal', 'kcal-labrador', 'other-project'])
      (await rawOpen(name)).close();

    expect(await labTraces()).toEqual({
      databases: ['kcal-composer', 'kcal-lab-one', 'kcal-lab-two'],
      keys: ['kcal-composer-options', 'kcal-proto-gemini-key'],
    });
    await clearLab();
    expect(await labTraces()).toEqual({ databases: [], keys: [] });
    expect((await indexedDB.databases()).map((d) => d.name).sort()).toEqual([
      'kcal',
      'kcal-labrador',
      'other-project',
    ]);
    expect(Object.keys(localStorage).sort()).toEqual(['kcal', 'other-project-settings']);
    expect(localStorage.getItem('kcal')).toBe('{"real":"data"}');
  });

  it('waits for a tab that holds a database open (the prototype’s), saying so', async () => {
    globalThis.localStorage = fakeLocalStorage({});
    const held = await rawOpen('kcal-composer');
    const blocked: string[] = [];
    const done = clearLab((name) => blocked.push(name));
    await expect.poll(() => blocked).toEqual(['kcal-composer']);
    held.close();
    await done;
    expect(await labTraces()).toEqual({ databases: [], keys: [] });
  });
});

/** Opens a database the way the prototype does: no handling of other tabs' requests. */
function rawOpen(name: string): Promise<IDBDatabase> {
  return new Promise((resolve) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
  });
}
