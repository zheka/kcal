import { useState } from 'preact/hooks';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { GeminiKeys } from '../../ui/GeminiKeys';
import { CloseIcon } from '../../ui/icons';
import { SETTINGS } from '../meal/settings';

/**
 * The lab's menu: the Gemini keys (the app's, the same section as its Settings: the lab asks
 * with Key); the composer's settings (the answer language), kept by the caller; how the model
 * is asked, as src/lab/meal/settings.ts says (the tool's too); the meals as tests (export.ts),
 * the lab's logs and data.
 */

interface LabActions {
  downloadLogs: () => void;
  downloadMeals: () => void;
  clearLogs: () => void;
  clearAll: () => void;
  close: () => void;
}

export function Menu(props: Parameters<typeof Settings>[0] & LabActions) {
  const { downloadLogs, downloadMeals, clearLogs, clearAll, close, ...settings } = props;
  return (
    <div class="app lab-composer">
      <header class="topbar">
        <h1 class="grow">Menu</h1>
        <button type="button" class="icon-button push-right" aria-label="Close" onClick={close}>
          <CloseIcon />
        </button>
      </header>
      <main class="form">
        <GeminiKeys />
        <Settings {...settings} />
        <section class="section">
          <h2 class="label">Lab</h2>
          <div class="actions column">
            <button type="button" class="button" onClick={downloadMeals}>
              Download meals
            </button>
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
  language,
  setLanguage,
}: {
  language: string;
  setLanguage: (language: string) => void;
}) {
  const [languageText, setLanguageText] = useState(language);

  return (
    <section class="section">
      <h2 class="label">Settings</h2>
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
        {SETTINGS.model}, thinking {SETTINGS.thinking}; Key, or Key 2 if Key can’t answer within{' '}
        {SETTINGS.urgency.targetMs / 1000} s; given up after {SETTINGS.urgency.limitMs / 1000} s
        (src/lab/meal/settings.ts)
      </p>
    </section>
  );
}
