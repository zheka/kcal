import { describe, expect, it } from 'vitest';
import { appData, egg, ing, makes, meal, oatFlakes, recipe, water } from '../core/testData';
import {
  documentJson,
  parseDocument,
  serializeBackup,
  validateDocument,
  VERSION_TAG,
  versionProblem,
} from './backup';

const oats = recipe('oats', [ing(oatFlakes, 60)], [makes(1, 'bowl')]);
const data = appData({
  goals: [{ perDay: { kcal: 2000, water: 2000 }, setAt: '2026-11-01T18:20:05.114Z' }],
  meals: [meal('2026-11-17T07:30:41.512Z', [ing(egg, 2, 'u:piece'), ing(water, 330, 'ml')])],
  products: [egg, oatFlakes, water],
  recipes: [oats],
  settings: { ai: {}, quickButtons: [{ label: '🍽️' }] },
});
const now = new Date('2026-11-17T19:45:03.207Z');

describe('versions', () => {
  it('accepts its own version, and an older patch (its fields are all still read)', () => {
    expect(VERSION_TAG).toBe('kcal 0.2.1');
    expect(versionProblem('kcal 0.2.1')).toBeNull();
    expect(versionProblem('kcal 0.2.0')).toBeNull();
  });

  it('refuses newer versions, older minors and non-kcal files', () => {
    expect(versionProblem('kcal 0.2.2')).toMatch(/newer than this app .*update the app/);
    expect(versionProblem('kcal 0.1.1')).toBe(
      'version "kcal 0.1.1" is from an older kcal (this app reads kcal 0.2.1) and can no longer be read',
    );
    expect(versionProblem(undefined)).toBe('no version: this is not a kcal file');
    expect(versionProblem('other 0.1.0')).toMatch(/not a kcal file/);
  });
});

describe('backup', () => {
  it('is deterministic: alphabetical fields, canonical order, exportedAt the only difference', () => {
    const text = serializeBackup(data, now);
    expect(Object.keys(JSON.parse(text))).toEqual([
      'exportedAt',
      'goals',
      'meals',
      'products',
      'recipes',
      'settings',
      'version',
    ]);
    expect(text.endsWith('\n')).toBe(true);
    const shuffled = { ...data, products: [water, oatFlakes, egg] };
    expect(serializeBackup(shuffled, now)).toBe(text);
    expect(text).toContain('"exportedAt": "2026-11-17T19:45:03.207Z"');
    expect(text).toContain('"perG": {\n        "carbs": 0.007,\n        "fat": 0.095,');
  });

  it('omits empty lists and objects, and reads them back as empty', () => {
    const text = serializeBackup(appData({ products: [oatFlakes] }), now);
    expect(JSON.parse(text)).toEqual({
      exportedAt: '2026-11-17T19:45:03.207Z',
      products: [{ id: oatFlakes.id, name: 'oat flakes', perG: oatFlakes.perG }],
      version: 'kcal 0.2.1',
    });
    const parsed = parseDocument(text);
    expect(parsed.ok && parsed.data).toEqual(appData({ products: [oatFlakes] }));
  });

  it('accepts explicit empty lists and objects, written back omitted', () => {
    const doc = {
      goals: [{ perDay: {}, setAt: '2026-11-01T18:20:05.114Z' }],
      meals: [],
      products: [{ ...oatFlakes, units: [] }],
      settings: { ai: { product: {} }, quickButtons: [] },
      version: 'kcal 0.2.0',
    };
    const parsed = parseDocument(JSON.stringify(doc));
    expect(parsed.ok && JSON.parse(documentJson(parsed.data))).toEqual({
      goals: [{ setAt: '2026-11-01T18:20:05.114Z' }],
      products: [{ id: oatFlakes.id, name: 'oat flakes', perG: oatFlakes.perG }],
      version: 'kcal 0.2.1',
    });
  });

  it('keeps model settings per task, only what they override', () => {
    const doc = {
      settings: { ai: { product: { model: 'gemini-3.5-flash', temperature: null } } },
      version: 'kcal 0.2.1',
    };
    const parsed = parseDocument(JSON.stringify(doc));
    expect(parsed.ok && parsed.data.settings.ai).toEqual(doc.settings.ai);
    expect(parsed.ok && JSON.parse(documentJson(parsed.data))).toEqual(doc);
  });

  it('round-trips byte for byte', () => {
    const text = serializeBackup(data, now);
    const parsed = parseDocument(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && serializeBackup(parsed.data, now)).toBe(text);
    expect(parsed.ok && documentJson(parsed.data)).toBe(documentJson(data));
  });

  it('accepts another order and stores it canonically', () => {
    const doc = JSON.parse(documentJson(data));
    doc.products.reverse();
    const parsed = parseDocument(JSON.stringify(doc));
    expect(parsed.ok && parsed.data.products.map((p) => p.id)).toEqual([
      egg.id,
      oatFlakes.id,
      water.id,
    ]);
  });

  it('refuses the whole file on any problem, listing all of them', () => {
    const doc = JSON.parse(documentJson(data));
    doc.extra = 1;
    doc.products[0].perG.kcal = -1;
    expect(parseDocument(JSON.stringify(doc))).toEqual({
      ok: false,
      problems: [
        'unknown field "extra"',
        'product #1 "egg", perG: kcal must be a non-negative number',
      ],
    });
  });

  it('checks exportedAt, and only the version of a file of another version', () => {
    expect(
      validateDocument({ ...JSON.parse(documentJson(data)), exportedAt: 'yesterday' }),
    ).toEqual(['exportedAt must be a UTC timestamp like 2026-11-17T07:30:41.512Z']);
    expect(validateDocument({ version: 'kcal 0.3.0', meals: 'whatever' })).toEqual([
      'version "kcal 0.3.0" is newer than this app (kcal 0.2.1): update the app',
    ]);
  });

  it('refuses text that is not JSON or not an object', () => {
    const result = parseDocument('{ nope');
    expect(!result.ok && result.problems[0]).toMatch(/^not valid JSON/);
    expect(parseDocument('[]')).toEqual({
      ok: false,
      problems: ['the file must contain a JSON object'],
    });
  });
});
