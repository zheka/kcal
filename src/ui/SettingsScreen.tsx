import { useEffect, useState } from 'preact/hooks';
import { TASKS } from '../ai/tasks';
import { type KeyName, keys, loadKeys, setKey } from '../state/keys';

/**
 * What the user sets up on this device: for now, the keys of the providers the app asks (each
 * the user's own, kept on this device only, never in a backup). Which model a task asks is built
 * in (src/ai/tasks.ts), so it is only shown.
 */
export function SettingsScreen() {
  useEffect(() => void loadKeys(), []);
  const product = TASKS.product;
  return (
    <div class="form">
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
