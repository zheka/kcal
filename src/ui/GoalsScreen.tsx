import { useState } from 'preact/hooks';
import { NUTRIENT_LABEL, NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { roundStored } from '../core/decimal';
import { formatNumber, parseNumber } from '../core/format';
import { goalHistory, goalsOn } from '../core/goals';
import type { NutrientValues } from '../core/types';
import type { Store } from '../state/store';
import { describeTargets, goalDate } from './DayScreen';
import { goBack, today } from './router';

/** Daily targets: saving makes them effective from the start of today; earlier days keep theirs. */
export function GoalsScreen({ store }: { store: Store }) {
  const goals = store.data.value.goals;
  const current = goalsOn(goals, today.value) ?? {};
  const [texts, setTexts] = useState<Record<Nutrient, string>>(() => {
    const t = {} as Record<Nutrient, string>;
    for (const n of NUTRIENTS) t[n] = current[n] === undefined ? '' : formatNumber(current[n], 3);
    return t;
  });
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');

  const perDay: NutrientValues = {};
  const errors = new Map<Nutrient, string>();
  for (const n of NUTRIENTS) {
    if (texts[n].trim() === '') continue;
    const x = parseNumber(texts[n]);
    const stored = x === null ? null : roundStored(x);
    if (stored === null || stored <= 0) errors.set(n, 'Not a positive number');
    else perDay[n] = stored;
  }

  function save() {
    setSubmitted(true);
    if (errors.size > 0) return;
    try {
      store.saveGoals(perDay, new Date());
    } catch (err) {
      setSaveError((err as Error).message);
      return;
    }
    goBack('/');
  }

  return (
    <form
      class="form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p class="hint">
        One daily target per nutrient; leave empty for no goal. New goals apply from the start of
        today; the days before keep the goals they had.
      </p>
      <div class="nutrient-grid">
        {NUTRIENTS.map((n) => (
          <label class="field" key={n}>
            <span class="label">
              {NUTRIENT_LABEL[n]}
              {n !== 'kcal' && ` (${NUTRIENT_UNIT[n]})`}
            </span>
            <input
              class="input number"
              inputMode="decimal"
              placeholder="no goal"
              value={texts[n]}
              onInput={(e) => setTexts({ ...texts, [n]: e.currentTarget.value })}
            />
            {submitted && errors.has(n) && <p class="error">{errors.get(n)}</p>}
          </label>
        ))}
      </div>
      {saveError && <p class="error">Could not save: {saveError}</p>}
      <div class="actions action-bar">
        <button type="submit" class="button primary">
          Save
        </button>
      </div>
      {goals.length > 0 && (
        <section class="section">
          <h2 class="label">History</h2>
          <ul class="goal-history">
            {goalHistory(goals).map(({ from, set }) => (
              <li key={set.setAt}>
                <span class="goal-history-from">From {goalDate(from)}</span>
                <span class="goal-history-targets">
                  {describeTargets(set.perDay) || 'no goals'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
