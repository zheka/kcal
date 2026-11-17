import { useState } from 'preact/hooks';
import { NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { formatNumber, parseNumber } from '../core/format';
import { goalsOn } from '../core/goals';
import type { NutrientValues } from '../core/types';
import type { Store } from '../state/store';
import { describeTargets } from './DayScreen';
import { goBack, today } from './router';

/** Daily targets: saving makes them effective from today; earlier days keep their goals. */
export function GoalsScreen({ store }: { store: Store }) {
  const goals = store.data.value.goals;
  const current = goalsOn(goals, today.value) ?? {};
  const [texts, setTexts] = useState<Record<Nutrient, string>>(() => {
    const t = {} as Record<Nutrient, string>;
    for (const n of NUTRIENTS) t[n] = current[n] === undefined ? '' : formatNumber(current[n], 3);
    return t;
  });
  const [submitted, setSubmitted] = useState(false);

  const targets: NutrientValues = {};
  const errors = new Map<Nutrient, string>();
  for (const n of NUTRIENTS) {
    if (texts[n].trim() === '') continue;
    const x = parseNumber(texts[n]);
    if (x === null || x <= 0) errors.set(n, 'Not a positive number');
    else targets[n] = x;
  }

  function save() {
    setSubmitted(true);
    if (errors.size > 0) return;
    store.saveGoals(targets, today.value);
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
        One daily target per nutrient; leave empty for no goal. New goals apply from today; the days
        before keep the goals they had.
      </p>
      <div class="nutrient-grid">
        {NUTRIENTS.map((n) => (
          <label class="field" key={n}>
            <span class="label">
              {n}
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
      <div class="actions action-bar">
        <button type="submit" class="button primary">
          Save
        </button>
        <button type="button" class="button" onClick={() => goBack('/')}>
          Cancel
        </button>
      </div>
      {goals.length > 0 && (
        <section class="section">
          <h2 class="label">History</h2>
          <ul class="goal-history">
            {[...goals].reverse().map((g) => (
              <li key={g.from}>
                From {g.from}: {describeTargets(g.targets) || 'no goals'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
