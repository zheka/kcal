import { describe, expect, it } from 'vitest';
import { appData, egg, ing, meal } from '../core/testData';
import {
  parseDocument,
  serializeBackup,
  toDocument,
  validateDocument,
  VERSION_TAG,
  versionProblem,
} from './backup';

const data = appData({
  goals: [{ from: '2026-11-01', targets: { kcal: 2000 } }],
  products: [egg],
  meals: [meal('2026-11-17T08:30', [ing(egg, 2, 'u1')])],
});

describe('versions', () => {
  it('accepts its own version and older patches of the same minor', () => {
    expect(VERSION_TAG).toBe('kcal 0.1.0');
    expect(versionProblem('kcal 0.1.0')).toBeNull();
  });

  it('refuses newer versions: the app must be updated', () => {
    expect(versionProblem('kcal 0.1.1')).toMatch(/newer than this app .*update the app/);
    expect(versionProblem('kcal 0.2.0')).toMatch(/update the app/);
    expect(versionProblem('kcal 1.0.0')).toMatch(/update the app/);
  });

  it('refuses older minors: they need an upgrade', () => {
    expect(versionProblem('kcal 0.0.9')).toMatch(/older than this app .*needs an upgrade/);
  });

  it('refuses files that are not Kcal files', () => {
    expect(versionProblem(undefined)).toBe('no version: this is not a Kcal file');
    expect(versionProblem('clog 0.1.0')).toMatch(/not a Kcal file/);
    expect(versionProblem(1)).toMatch(/not a Kcal file/);
  });
});

describe('backup', () => {
  it('round-trips: what is exported imports unchanged', () => {
    const text = serializeBackup(data, new Date('2026-11-17T09:00:00Z'));
    expect(JSON.parse(text)).toMatchObject({
      version: VERSION_TAG,
      exportedAt: '2026-11-17T09:00:00.000Z',
    });
    expect(parseDocument(text)).toEqual({ ok: true, data });
  });

  it('reads saved data, which has no exportedAt', () => {
    expect(parseDocument(JSON.stringify(toDocument(data)))).toEqual({ ok: true, data });
  });

  it('refuses the whole file on any problem, listing all of them', () => {
    const doc = { ...toDocument(data), extra: 1, products: [{ ...egg, per100g: {} }] };
    expect(parseDocument(JSON.stringify(doc))).toEqual({
      ok: false,
      problems: ['unknown field "extra"', 'product #1 "egg", per100g: missing kcal'],
    });
  });

  it('reports a dangling reference only once the data is well-formed', () => {
    const doc = { ...toDocument(data), products: [] };
    expect(validateDocument(doc)).toEqual([
      'meal #1 (2026-11-17T08:30), ingredient #1: refers to food p:egg, which does not exist',
    ]);
  });

  it('checks only the version of a file of another version', () => {
    expect(validateDocument({ version: 'kcal 0.2.0', meals: 'whatever' })).toEqual([
      'version "kcal 0.2.0" is newer than this app (kcal 0.1.0): update the app',
    ]);
  });

  it('refuses text that is not JSON or not an object', () => {
    const result = parseDocument('{ nope');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems[0]).toMatch(/^not valid JSON/);
    expect(parseDocument('[]')).toEqual({
      ok: false,
      problems: ['the file must contain a JSON object'],
    });
  });

  it('checks exportedAt', () => {
    expect(validateDocument({ ...toDocument(data), exportedAt: 'yesterday' })).toEqual([
      'exportedAt must be a timestamp',
    ]);
  });
});
