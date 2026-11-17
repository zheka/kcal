import type { AppData } from '../core/types';
import { validateAppData } from '../core/validate';

/**
 * Version of the stored data's schema, independent of app releases. While 0.x, a minor bump
 * may break (needs a migration) and a patch only adds optional fields.
 */
export const SCHEMA_VERSION = '0.1.0';
/** `version` of every Kcal file: marks it as Kcal data and versions it. */
export const VERSION_TAG = `kcal ${SCHEMA_VERSION}`;

const DOCUMENT_FIELDS = ['version', 'exportedAt', 'goals', 'products', 'recipes', 'meals'];

/** A problem with the version, or null when this app can read it as it is. */
export function versionProblem(version: unknown): string | null {
  if (version === undefined) return 'no version: this is not a Kcal file';
  const match = typeof version === 'string' ? /^kcal (\d+)\.(\d+)\.(\d+)$/.exec(version) : null;
  if (!match) return `version ${JSON.stringify(version)}: this is not a Kcal file`;
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
  const [ownMajor, ownMinor, ownPatch] = SCHEMA_VERSION.split('.').map(Number) as [
    number,
    number,
    number,
  ];
  const newer =
    major > ownMajor ||
    (major === ownMajor && minor > ownMinor) ||
    (major === ownMajor && minor === ownMinor && patch > ownPatch);
  if (newer) return `version "${version}" is newer than this app (${VERSION_TAG}): update the app`;
  if (major !== ownMajor || minor !== ownMinor) {
    return `version "${version}" is older than this app (${VERSION_TAG}) and needs an upgrade`;
  }
  return null;
}

/**
 * Checks a whole document (a backup, or the saved data): its version, its fields and all its
 * data. Returns every problem; empty means it can be used as it is.
 */
export function validateDocument(doc: unknown): string[] {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return ['the file must contain a JSON object'];
  }
  const record = doc as Record<string, unknown>;
  const version = versionProblem(record.version);
  // A file of another version can't be checked against this version's rules.
  if (version) return [version];
  const problems: string[] = [];
  for (const key of Object.keys(record)) {
    if (!DOCUMENT_FIELDS.includes(key)) problems.push(`unknown field "${key}"`);
  }
  if (
    'exportedAt' in record &&
    (typeof record.exportedAt !== 'string' || Number.isNaN(Date.parse(record.exportedAt)))
  ) {
    problems.push('exportedAt must be a timestamp');
  }
  return [...problems, ...validateAppData(record)];
}

export type ParseResult = { ok: true; data: AppData } | { ok: false; problems: string[] };

/** Reads a backup file or the saved data. All-or-nothing: any problem refuses the whole file. */
export function parseDocument(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    return { ok: false, problems: [`not valid JSON: ${(err as Error).message}`] };
  }
  const problems = validateDocument(doc);
  if (problems.length > 0) return { ok: false, problems };
  const { goals, products, recipes, meals } = doc as AppData;
  return { ok: true, data: { goals, products, recipes, meals } };
}

/** The document as saved by the app: the data with its version. */
export function toDocument(data: AppData): object {
  const { goals, products, recipes, meals } = data;
  return { version: VERSION_TAG, goals, products, recipes, meals };
}

/** A backup file's contents: the document plus when it was written, readable by people. */
export function serializeBackup(data: AppData, now: Date): string {
  const { goals, products, recipes, meals } = data;
  const backup = {
    version: VERSION_TAG,
    exportedAt: now.toISOString(),
    goals,
    products,
    recipes,
    meals,
  };
  return `${JSON.stringify(backup, null, 2)}\n`;
}
