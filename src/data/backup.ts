import { APP_NAME } from '../config';
import { canonicalJson, fromDocument, toDocument } from '../core/canonical';
import { isValidUtc } from '../core/time';
import type { AppData } from '../core/types';
import { validateAppData } from '../core/validate';

/**
 * The stored data as a document: a backup file, or what the app saves in the browser (the same
 * without `exportedAt`). Format: docs/backup-format.md.
 *
 * The version of the format, independent of app releases. While 0.x, a minor bump may break
 * (needs a migration) and a patch only adds optional fields.
 */
export const SCHEMA_VERSION = '0.2.1';
/** `version` of every kcal document: marks it as kcal data and versions it. */
export const VERSION_TAG = `${APP_NAME} ${SCHEMA_VERSION}`;

const DOCUMENT_FIELDS = [
  'exportedAt',
  'goals',
  'meals',
  'products',
  'recipes',
  'settings',
  'version',
];

/** A problem with the version, or null when this app can read it as it is. */
export function versionProblem(version: unknown): string | null {
  if (version === undefined) return `no version: this is not a ${APP_NAME} file`;
  const match = typeof version === 'string' ? /^kcal (\d+)\.(\d+)\.(\d+)$/.exec(version) : null;
  if (!match) return `version ${JSON.stringify(version)}: this is not a ${APP_NAME} file`;
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
    return `version "${version}" is from an older ${APP_NAME} (this app reads ${VERSION_TAG}) and can no longer be read`;
  }
  return null;
}

/**
 * Checks a whole document: its version, its fields and all its data. Returns every problem;
 * empty means it can be used as it is.
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
    !(typeof record.exportedAt === 'string' && isValidUtc(record.exportedAt))
  ) {
    problems.push('exportedAt must be a UTC timestamp like 2026-11-17T07:30:41.512Z');
  }
  return [...problems, ...validateAppData(record)];
}

export type ParseResult = { ok: true; data: AppData } | { ok: false; problems: string[] };

/**
 * Reads a backup file or the saved data. All-or-nothing: any problem refuses the whole file.
 * Order is not data: the data comes back in canonical order.
 */
export function parseDocument(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    return { ok: false, problems: [`not valid JSON: ${(err as Error).message}`] };
  }
  const problems = validateDocument(doc);
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, data: fromDocument(doc as Record<string, unknown>) };
}

/** The document as the app saves it: the data with its version, canonical. */
export function documentJson(data: AppData): string {
  return canonicalJson({ ...toDocument(data), version: VERSION_TAG });
}

/** A backup file's contents: the saved document plus when it was written. */
export function serializeBackup(data: AppData, now: Date): string {
  return canonicalJson({
    ...toDocument(data),
    exportedAt: now.toISOString(),
    version: VERSION_TAG,
  });
}
