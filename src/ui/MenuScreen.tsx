import { checkForUpdate, installUpdate, updateState, type UpdateState } from '../pwa';
import { useEffect, useState } from 'preact/hooks';
import { taskSettings } from '../ai/tasks';
import type { AppData } from '../core/types';
import { localDate } from '../core/time';
import { parseDocument, serializeBackup, VERSION_TAG } from '../data/backup';
import { savedSize, SIZE_WARNING_CHARS } from '../data/storage';
import { geminiKey, loadGeminiKey, setGeminiKey } from '../state/aiKey';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { downloadText } from './download';
import { plural } from './ProductForm';
import { navigate } from './router';

type ImportState =
  | { step: 'idle' }
  | { step: 'refused'; problems: string[] }
  /** `error`: replacing the data was refused (e.g. storage full); nothing was changed. */
  | { step: 'confirm'; data: AppData; fileName: string; error?: string }
  | { step: 'done' };

export function MenuScreen({ store }: { store: Store }) {
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
    <div class="menu">
      <button type="button" class="menu-item" onClick={() => navigate('/library')}>
        Library
      </button>
      <button type="button" class="menu-item" onClick={() => navigate('/goals')}>
        Goals
      </button>

      <section class="section">
        <h2 class="label">Backup</h2>
        <button
          type="button"
          class="menu-item"
          onClick={() =>
            downloadText(
              `kcal-backup-${localDate(new Date())}.json`,
              serializeBackup(data, new Date()),
            )
          }
        >
          Export backup
        </button>
        <label class="menu-item file">
          Import backup
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
              {importing.fileName}: {summary(importing.data)}. Importing replaces all data in this
              app ({summary(data)}).
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
      </section>

      <AiSection data={data} />

      <AppVersion />

      <section class="section about">
        <p>
          Saved data: {(size / 1_000_000).toFixed(2)} MB
          {size > SIZE_WARNING_CHARS && ' (over 1\u00a0MB: time to move the data to IndexedDB)'}
        </p>
        <p>Data format: {VERSION_TAG}</p>
      </section>
    </div>
  );
}

/**
 * The Gemini key (the user's own, kept on this device only) and how each task asks the model:
 * built in, or as the settings in a backup changed it.
 */
function AiSection({ data }: { data: AppData }) {
  const key = geminiKey.value;
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  useEffect(() => void loadGeminiKey(), []);
  const product = taskSettings(data.settings, 'product');

  async function keep(value: string) {
    setError('');
    try {
      await setGeminiKey(value);
      setText('');
    } catch (err) {
      setError(`Could not ${value ? 'save' : 'forget'} the key: ${(err as Error).message}`);
    }
  }

  return (
    <section class="section">
      <h2 class="label">AI</h2>
      {key === undefined ? null : key ? (
        <div class="actions ai-key">
          <span class="ai-key-saved">Gemini key saved on this device (…{key.slice(-4)})</span>
          <button type="button" class="button" onClick={() => void keep('')}>
            Forget
          </button>
        </div>
      ) : (
        <form
          class="actions ai-key"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void keep(text);
          }}
        >
          <input
            class="input"
            type="password"
            autoComplete="off"
            aria-label="Gemini key"
            placeholder="Paste your Gemini key"
            value={text}
            onInput={(e) => setText(e.currentTarget.value)}
          />
          <button type="submit" class="button primary">
            Save
          </button>
        </form>
      )}
      {error && <p class="error">{error}</p>}
      <p class="hint">
        Your own key from{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>
        : kept on this device only, never in a backup, and sent only to Gemini. Products:{' '}
        {product.model}, thinking {product.thinking}.
      </p>
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

const STATUS: Record<UpdateState, string> = {
  unavailable: import.meta.env.DEV
    ? 'Updates work in the built app (npm run preview)'
    : 'Updates are not available in this browser',
  idle: 'Tap to check for updates',
  checking: 'Checking for updates…',
  'up-to-date': 'Up to date. Tap to check again',
  available: 'Update available: tap to install',
  installing: 'Installing the update…',
  offline: 'Offline: connect to check for updates',
  failed: 'Could not check for updates. Tap to try again',
};

/** The app's version and build; a tap checks for an update, or installs one that is ready. */
function AppVersion() {
  const state = updateState.value;
  const busy = state === 'checking' || state === 'installing' || state === 'unavailable';
  return (
    <button
      type="button"
      class={`menu-item version ${state === 'available' ? 'update' : ''}`}
      disabled={busy}
      onClick={() => void (state === 'available' ? installUpdate() : checkForUpdate())}
    >
      <span class="menu-item-title">App version</span>
      <span class="menu-item-detail">{__APP_VERSION__}</span>
      <span class="menu-item-status" aria-live="polite">
        {STATUS[state]}
      </span>
    </button>
  );
}
