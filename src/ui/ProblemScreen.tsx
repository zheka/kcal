import { useState } from 'preact/hooks';
import { localDate } from '../core/time';
import { updateApp } from '../pwa';
import { ConfirmButton } from './ConfirmButton';
import { downloadText } from './download';

interface Props {
  problems: string[];
  /** The saved data, unchanged. */
  raw: string;
  /** A newer version of the app saved it: the data is fine, this version needs updating. */
  newer: boolean;
  onStartFresh: () => void;
  /** Gets the newest version of the app (reloads). */
  onUpdate?: () => Promise<void>;
}

/**
 * Shown instead of the app when the saved data can't be used. Saved by a newer version of the
 * app: update the app; the data is fine and is never deleted here. Otherwise the data is broken:
 * download it to fix it, or start fresh.
 */
export function ProblemScreen({ problems, raw, newer, onStartFresh, onUpdate = updateApp }: Props) {
  const [updating, setUpdating] = useState(false);
  const download = () => downloadText(`kcal-saved-data-${localDate(new Date())}.json`, raw);
  return (
    <main class="app problem-screen">
      {newer ? (
        <>
          <h1>Saved by a newer version of the app</h1>
          <p>
            The saved data is fine, but this version of the app can’t read it. Update the app to
            keep going. Updating needs a connection, unless the app was already updated in another
            window.
          </p>
        </>
      ) : (
        <>
          <h1>Saved data can’t be used</h1>
          <p>
            The data saved in this browser failed its check, so the app did not start. Nothing has
            been changed.
          </p>
        </>
      )}
      <ul class="problems">
        {problems.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      {newer ? (
        <div class="actions column">
          <button
            type="button"
            class="button primary"
            disabled={updating}
            onClick={() => {
              setUpdating(true);
              void onUpdate().finally(() => setUpdating(false));
            }}
          >
            {updating ? 'Updating…' : 'Update app'}
          </button>
          <button type="button" class="button" onClick={download}>
            Download saved data
          </button>
        </div>
      ) : (
        <>
          <div class="actions column">
            <button type="button" class="button primary" onClick={download}>
              Download saved data
            </button>
            <ConfirmButton
              label="Start fresh"
              confirmLabel="Tap again to delete saved data"
              onConfirm={onStartFresh}
            />
          </div>
          <p class="hint">
            Download the data to fix it at a computer, then import it. Starting fresh deletes it
            from this browser.
          </p>
        </>
      )}
    </main>
  );
}
