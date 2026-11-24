import { useEffect, useState } from 'preact/hooks';
import { TASKS } from '../ai/tasks';
import { localDate } from '../core/time';
import type { AppData } from '../core/types';
import { parseDocument, serializeBackup, VERSION_TAG } from '../data/backup';
import { savedSize, SIZE_WARNING_CHARS } from '../data/storage';
import { type KeyName, keys, loadKeys, setKey } from '../state/keys';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { downloadText } from './download';
import { plural } from './ProductForm';

/**
 * The app itself: its data as a whole (backup: export, import, how much is saved, the format),
 * and the keys of the providers the app asks (each the user's own, kept on this device only,
 * never in a backup). Which model a task asks is built in (src/ai/tasks.ts), so it is only shown.
 */
export function SettingsScreen({ store }: { store: Store }) {
  useEffect(() => void loadKeys(), []);
  const product = TASKS.product;
  return (
    <div class="form">
      <Backup store={store} />
      <section class="section">
        <h2 class="label">Gemini</h2>
        <KeyField name="gemini" label="Key" />
        <KeyField name="gemini-2" label="Key 2" />
        <p class="hint">
          Your own keys from{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>
          : kept on this device only, never in a backup, and sent only to Gemini. Products:{' '}
          {product.model}, thinking {product.thinking}.
        </p>
      </section>
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
          onClick={() =>
            downloadText(
              `kcal-backup-${localDate(new Date())}.json`,
              serializeBackup(data, new Date()),
            )
          }
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

/** One key: a field to paste it into, or its last four characters and Forget. */
function KeyField({ name, label }: { name: KeyName; label: string }) {
  const key = keys.value?.[name];
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const id = `key-${name}`;

  async function keep(value: string) {
    setError('');
    try {
      await setKey(name, value);
      setText('');
    } catch (err) {
      setError(`Could not ${value ? 'save' : 'forget'} the key: ${(err as Error).message}`);
    }
  }

  if (key === undefined) return null;
  return (
    <div class="field">
      {/* A label names the field; a saved key is plain text under its name. */}
      {key ? (
        <span class="label">{label}</span>
      ) : (
        <label class="label" for={id}>
          {label}
        </label>
      )}
      {key ? (
        <div class="actions key-field">
          <span class="key-saved">Saved on this device (…{key.slice(-4)})</span>
          <button
            type="button"
            class="button"
            aria-label={`Forget ${label.toLowerCase()}`}
            onClick={() => void keep('')}
          >
            Forget
          </button>
        </div>
      ) : (
        <form
          class="actions key-field"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void keep(text);
          }}
        >
          <input
            id={id}
            class="input"
            type="password"
            autoComplete="off"
            placeholder="Paste a key"
            value={text}
            onInput={(e) => setText(e.currentTarget.value)}
          />
          <button type="submit" class="button primary" aria-label={`Save ${label.toLowerCase()}`}>
            Save
          </button>
        </form>
      )}
      {error && <p class="error">{error}</p>}
    </div>
  );
}
