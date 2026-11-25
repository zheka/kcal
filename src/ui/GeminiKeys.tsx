import { useEffect, useState } from 'preact/hooks';
import { ConfirmButton } from './ConfirmButton';
import { type KeyName, keys, loadKeys, setKey } from '../ai/keys';

/**
 * The Gemini keys, the user's own, kept on this device only (the app's IndexedDB, never in a
 * backup): Key, cheap (free tier), asked first, and Key 2, reliable (paid), spent only when a
 * task needs its answer sooner than Key gives it (src/ai/gemini/). In the app's
 * Settings and the lab's menu alike, both editing the same keys.
 */
export function GeminiKeys() {
  useEffect(() => void loadKeys(), []);
  return (
    <section class="section">
      <h2 class="label">Gemini</h2>
      <KeyField name="gemini" label="Key" placeholder="Cheap Gemini key" />
      <KeyField name="gemini-2" label="Key 2" placeholder="Reliable Gemini key" />
    </section>
  );
}

/** One key: a field to paste it into, or its last four characters and Forget, confirmed by a second tap. */
function KeyField(props: { name: KeyName; label: string; placeholder: string }) {
  const { name, label, placeholder } = props;
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
          <span class="key-saved">
            {/* The key's end never splits across lines, beside the wider armed Forget. */}
            Saved on this device <span class="nowrap">(…{key.slice(-4)})</span>
          </span>
          <ConfirmButton
            label="Forget"
            confirmLabel="Tap again to forget"
            ariaLabel={`Forget ${label.toLowerCase()}`}
            onConfirm={() => void keep('')}
          />
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
            placeholder={placeholder}
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
