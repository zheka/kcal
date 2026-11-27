import { useState } from 'preact/hooks';
import { localDate } from '../core/time';
import type { AppData } from '../core/types';
import { parseDocument, serializeBackup, VERSION_TAG } from '../data/backup';
import { savedSize, SIZE_WARNING_CHARS } from '../data/storage';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { downloadText } from './download';
import { GeminiKeys } from './GeminiKeys';
import { plural } from './ProductForm';

/**
 * The app itself: its data as a whole (backup: export, import, how much is saved, the format),
 * and the keys of the providers the app asks (each the user's own, kept on this device only,
 * never in a backup). Which model a task asks is built in (src/ai/tasks.ts), not a setting.
 */
export function SettingsScreen({ store }: { store: Store }) {
  return (
    <div class="form">
      <Backup store={store} />
      <GeminiKeys />
    </div>
  );
}

type ImportState =
  | { step: 'idle' }
  | { step: 'refused'; problems: string[] }
  /** `error`: replacing the data was refused (e.g. storage full); nothing was changed. */
  | { step: 'confirm'; data: AppData; fileName: string; error?: string }
  | { step: 'done' };

/** Export and import, and what is saved: how much of what, its size, its format. */
function Backup({ store }: { store: Store }) {
  const [importing, setImporting] = useState<ImportState>({ step: 'idle' });
  /** Why the last export didn't happen. */
  const [exportError, setExportError] = useState<string>();
  const data = store.data.value;
  const size = savedSize();

  async function readFile(file: File) {
    const result = parseDocument(await file.text());
    setImporting(
      result.ok
        ? { step: 'confirm', data: result.data, fileName: file.name }
        : { step: 'refused', problems: result.problems },
    );
  }

  return (
    <section class="section">
      <h2 class="label">Backup</h2>
      <div class="actions backup-actions">
        <button
          type="button"
          class="button"
          onClick={() => {
            // What is saved now, with what another window saved since.
            try {
              store.refresh();
            } catch (err) {
              setExportError((err as Error).message);
              return;
            }
            setExportError(undefined);
            downloadText(
              `kcal-backup-${localDate(new Date())}.json`,
              serializeBackup(store.data.peek(), new Date()),
            );
          }}
        >
          Export
        </button>
        <label class="button file">
          Import
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Import backup"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) void readFile(file);
            }}
          />
        </label>
      </div>
      {exportError && <p class="error">Could not export: {exportError}.</p>}
      {importing.step === 'refused' && (
        <div class="notice">
          <p>Import refused: {plural(importing.problems.length, 'problem')}</p>
          <ul class="problems">
            {importing.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {importing.step === 'confirm' && (
        <div class="notice">
          <p>
            {importing.fileName}: {summary(importing.data)}. Importing replaces all data in this app
            ({summary(data)}).
          </p>
          {importing.error && (
            <p class="error">Could not import: {importing.error}. Your data is unchanged.</p>
          )}
          <div class="actions">
            <ConfirmButton
              label="Replace my data"
              confirmLabel="Tap again to replace"
              onConfirm={() => {
                try {
                  store.replaceAll(importing.data);
                } catch (err) {
                  setImporting({ ...importing, error: (err as Error).message });
                  return;
                }
                setImporting({ step: 'done' });
              }}
            />
            <button type="button" class="button" onClick={() => setImporting({ step: 'idle' })}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {importing.step === 'done' && <p class="notice">Imported.</p>}
      <div class="about">
        <p>Saved: {summary(data)}</p>
        <p>
          {(size / 1_000_000).toFixed(2)} MB
          {size > SIZE_WARNING_CHARS && ' (over 1\u00a0MB: time to move the data to IndexedDB)'}
          {' · '}data format {VERSION_TAG}
        </p>
      </div>
    </section>
  );
}

function summary(data: AppData): string {
  return [
    plural(data.products.length, 'product'),
    plural(data.recipes.length, 'recipe'),
    plural(data.meals.length, 'meal'),
  ].join(', ');
}
