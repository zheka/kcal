import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { clearLab, labTraces } from '../storage/clear';
// The app's look: its font and styles.
import '@fontsource-variable/roboto/wght.css';
import '../../style.css';
import './none.css';

/**
 * The lab's page when no experiment runs (lab/index.html points here): says so, lists what
 * earlier experiments left in this browser, and clears it.
 */
function None() {
  /** The lab's databases and keys here; null while looking. */
  const [names, setNames] = useState<string[] | null>(null);
  /** What's happening, or what went wrong, instead of the list's heading. */
  const [status, setStatus] = useState('');

  const look = () =>
    labTraces()
      .then(({ databases, keys }) => (setNames([...databases, ...keys]), setStatus('')))
      .catch((err: unknown) => setStatus(`Could not look for lab data: ${String(err)}`));
  useEffect(() => void look(), []);

  const clear = () => {
    setStatus('Clearing…');
    clearLab((name) => setStatus(`Waiting for ${name}: close the other lab tabs.`))
      .then(look)
      .catch((err: unknown) => setStatus(`Could not clear: ${String(err)}`));
  };

  return (
    <main class="app lab-none">
      <h1>kcal lab</h1>
      <p>No experiment running.</p>
      <p>
        {status ||
          (names === null
            ? 'Looking for lab data…'
            : names.length
              ? 'Lab data in this browser:'
              : 'No lab data in this browser.')}
      </p>
      {!!names?.length && (
        <>
          <ul>
            {names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <div class="actions">
            <ConfirmButton
              label="Clear all lab data"
              confirmLabel="Tap again to clear"
              onConfirm={clear}
            />
          </div>
        </>
      )}
      <p class="hint">{__APP_VERSION__}</p>
    </main>
  );
}

render(<None />, document.getElementById('app')!);
