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
export const SCHEMA_VERSION = '0.2.0';
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

/** [major, minor, patch] of a kcal version, or null when it isn't one. */
function parseVersion(version: unknown): [number, number, number] | null {
  const match = typeof version === 'string' ? /^kcal (\d+)\.(\d+)\.(\d+)$/.exec(version) : null;
  return match ? (match.slice(1).map(Number) as [number, number, number]) : null;
}

const OWN = parseVersion(VERSION_TAG)!;

/** Whether a newer app wrote this version: the data is fine, and updating the app reads it. */
export function isNewerVersion(version: unknown): boolean {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  const [major, minor, patch] = parsed;
  const [ownMajor, ownMinor, ownPatch] = OWN;
  return (
    major > ownMajor ||
    (major === ownMajor && minor > ownMinor) ||
    (major === ownMajor && minor === ownMinor && patch > ownPatch)
  );
}

/** A problem with the version, or null when this app can read it as it is. */
export function versionProblem(version: unknown): string | null {
  if (version === undefined) return `no version: this is not a ${APP_NAME} file`;
  const parsed = parseVersion(version);
  if (!parsed) return `version ${JSON.stringify(version)}: this is not a ${APP_NAME} file`;
  if (isNewerVersion(version)) {
    return `version "${version}" is newer than this app (${VERSION_TAG}): update the app`;
  }
  const [major, minor] = parsed;
  if (major !== OWN[0] || minor !== OWN[1]) {
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

export type ParseResult =
  | { ok: true; data: AppData }
  /** `newer`: a newer version of the app wrote it (the data is fine; this app can't read it). */
  | { ok: false; problems: string[]; newer: boolean };

/**
 * Reads a backup file or the saved data. All-or-nothing: any problem refuses the whole file.
 * Order is not data: the data comes back in canonical order.
 */
export function parseDocument(text: string): ParseResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    return { ok: false, problems: [`not valid JSON: ${(err as Error).message}`], newer: false };
  }
  const problems = validateDocument(doc);
  if (problems.length > 0) {
    const newer = isNewerVersion((doc as { version?: unknown } | null)?.version);
    return { ok: false, problems, newer };
  }
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
