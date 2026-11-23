import { useState } from 'preact/hooks';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { CloseIcon } from '../../ui/icons';
import { SETTINGS } from '../meal/settings';

/**
 * The lab's menu: the composer's settings (the Gemini key, a lab secret; the answer language),
 * kept by the caller; how the model is asked, as src/lab/meal/settings.ts says (the tool's too);
 * and the lab's logs and data.
 */

interface LabActions {
  downloadLogs: () => void;
  clearLogs: () => void;
  clearAll: () => void;
  close: () => void;
}

export function Menu(props: Parameters<typeof Settings>[0] & LabActions) {
  const { downloadLogs, clearLogs, clearAll, close, ...settings } = props;
  return (
    <div class="app lab-composer">
      <header class="topbar">
        <h1 class="grow">Menu</h1>
        <button type="button" class="icon-button push-right" aria-label="Close" onClick={close}>
          <CloseIcon />
        </button>
      </header>
      <main class="form">
        <Settings {...settings} />
        <section class="section">
          <h2 class="label">Lab</h2>
          <div class="actions column">
            <button type="button" class="button" onClick={downloadLogs}>
              Download logs
            </button>
            <ConfirmButton
              label="Clear logs"
              confirmLabel="Tap again to clear the logs"
              onConfirm={clearLogs}
            />
            <ConfirmButton
              label="Clear all lab data"
              confirmLabel="Tap again to clear everything"
              onConfirm={clearAll}
            />
          </div>
          <p class="hint">{__APP_VERSION__}</p>
        </section>
      </main>
    </div>
  );
}

function Settings({
  keyValue,
  setKey,
  language,
  setLanguage,
}: {
  keyValue: string;
  setKey: (k: string) => void;
  language: string;
  setLanguage: (language: string) => void;
}) {
  const [languageText, setLanguageText] = useState(language);
  const [text, setText] = useState('');

  return (
    <section class="section">
      <h2 class="label">Settings</h2>
      {keyValue ? (
        <div class="actions">
          <span class="grow muted">Gemini key saved on this device (…{keyValue.slice(-4)})</span>
          <button type="button" class="button" onClick={() => setKey('')}>
            Forget
          </button>
        </div>
      ) : (
        <form
          class="actions"
          onSubmit={(e) => {
            e.preventDefault();
            const k = text.trim();
            if (!k) return;
            setKey(k);
            setText('');
          }}
        >
          <input
            id="composer-key"
            class="input grow"
            type="password"
            autoComplete="off"
            aria-label="Gemini key"
            placeholder="Paste your key from Google AI Studio"
            value={text}
            onInput={(e) => setText(e.currentTarget.value)}
          />
          <button type="submit" class="button primary">
            Save
          </button>
        </form>
      )}
      <label class="field">
        <span class="label">Answer language</span>
        <input
          id="composer-language"
          class="input"
          autoComplete="off"
          placeholder="a code: ru, en, de…"
          value={languageText}
          onInput={(e) => {
            const text = e.currentTarget.value;
            setLanguageText(text);
            // a language code: two or three letters
            const code = text.trim().toLowerCase();
            if (/^[a-z]{2,3}$/.test(code)) setLanguage(code);
          }}
        />
      </label>
      <p class="hint">
        {SETTINGS.model}, thinking {SETTINGS.thinking}; up to {SETTINGS.retryDelaysMs.length} more
        tries when it’s busy (src/lab/meal/settings.ts)
      </p>
    </section>
  );
}
