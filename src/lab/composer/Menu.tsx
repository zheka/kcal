import { useEffect, useState } from 'preact/hooks';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { CloseIcon } from '../../ui/icons';
import { listModels } from '../ai/gemini';
import type { Options } from '../ai/model';

/**
 * The lab's menu: the composer's settings (the Gemini key, a lab secret; the model, from the
 * key's list; how it answers), kept by the caller, and the lab's logs and data.
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

/** The newest plain Flash model, as a default. */
function pickDefault(models: string[]): string {
  const flash = models.filter((m) => /^gemini-[\d.]+-flash$/.test(m)).sort();
  return flash.at(-1) ?? models.find((m) => m.includes('flash')) ?? models[0] ?? '';
}

function Settings({
  keyValue,
  setKey,
  model,
  setModel,
  options,
  setOptions,
}: {
  keyValue: string;
  setKey: (k: string) => void;
  model: string;
  setModel: (m: string) => void;
  options: Options;
  setOptions: (o: Options) => void;
}) {
  const [temperature, setTemperature] = useState(
    options.temperature === null ? '' : String(options.temperature),
  );
  const [text, setText] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!keyValue) return;
    setError('');
    listModels(keyValue)
      .then(setModels)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, [keyValue]);
  // A model this key can't use (or none yet): the newest Flash.
  useEffect(() => {
    if (models.length > 0 && !models.includes(model)) setModel(pickDefault(models));
  }, [models, model, setModel]);

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
      {error && <p class="error">Gemini: {error}</p>}
      {keyValue && (
        <label class="field">
          <span class="label">Model</span>
          <select
            id="composer-model"
            class="input"
            value={model}
            onChange={(e) => setModel(e.currentTarget.value)}
          >
            {(models.length ? models : [model]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      )}
      {keyValue && (
        <div class="settings-row">
          <label class="field grow">
            <span class="label">Thinking</span>
            <select
              id="composer-thinking"
              class="input"
              value={options.thinking}
              onChange={(e) =>
                setOptions({ ...options, thinking: e.currentTarget.value as Options['thinking'] })
              }
            >
              <option value="default">model’s default</option>
              <option value="off">off (faster)</option>
            </select>
          </label>
          <label class="field grow">
            <span class="label">Temperature</span>
            <input
              id="composer-temperature"
              class="input number"
              inputMode="decimal"
              placeholder="model’s default"
              value={temperature}
              onInput={(e) => {
                const text = e.currentTarget.value;
                setTemperature(text);
                const t = Number(text.replace(',', '.'));
                if (text.trim() === '') setOptions({ ...options, temperature: null });
                else if (t >= 0 && t <= 2) setOptions({ ...options, temperature: t });
              }}
            />
          </label>
        </div>
      )}
    </section>
  );
}
