import { localDate } from '../core/time';
import { ConfirmButton } from './ConfirmButton';
import { downloadText } from './download';

interface Props {
  problems: string[];
  /** The saved data, unchanged. */
  raw: string;
  onStartFresh: () => void;
}

/** Shown instead of the app when the saved data fails the check on load. */
export function ProblemScreen({ problems, raw, onStartFresh }: Props) {
  return (
    <main class="app problem-screen">
      <h1>Saved data can’t be used</h1>
      <p>
        The data saved in this browser failed its check, so the app did not start. Nothing has been
        changed.
      </p>
      <ul class="problems">
        {problems.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <div class="actions column">
        <button
          type="button"
          class="button primary"
          onClick={() => downloadText(`kcal-saved-data-${localDate(new Date())}.json`, raw)}
        >
          Download saved data
        </button>
        <ConfirmButton
          label="Start fresh"
          confirmLabel="Tap again to delete saved data"
          onConfirm={onStartFresh}
        />
      </div>
      <p class="hint">
        Download the data to fix it at a computer, then import it. Starting fresh deletes it from
        this browser.
      </p>
    </main>
  );
}
