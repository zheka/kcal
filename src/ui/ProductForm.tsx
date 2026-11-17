import { useState } from 'preact/hooks';
import { NUTRIENT_UNIT, NUTRIENTS, REQUIRED_NUTRIENTS, type Nutrient } from '../config';
import { newId, unitUsages, usages } from '../core/foods';
import { formatNumber, parseNumber, roundStored } from '../core/format';
import { cleanText, nameKey } from '../core/text';
import type { NutrientValues, Product } from '../core/types';
import { per100gFrom } from '../core/units';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { handOverCreatedFood } from './drafts';
import { goBack } from './router';
import { readUnits, unitRowsFrom, UnitsEditor, type UnitRow } from './UnitsEditor';

interface Props {
  store: Store;
  /** null for a new product. */
  id: string | null;
  /** Prefilled name of a new product (typed in a food picker). */
  initialName?: string;
  /** Add the new product where the picker was, once saved. */
  addToPicker?: boolean;
}

const NUTRIENT_LABEL: Record<Nutrient, string> = {
  kcal: 'kcal',
  protein: 'Protein',
  fat: 'Fat',
  carbs: 'Carbs',
};

export function ProductForm({ store, id, initialName = '', addToPicker = false }: Props) {
  const data = store.data.value;
  const existing = id === null ? undefined : data.products.find((p) => p.id === id);

  const [name, setName] = useState(existing?.name ?? initialName);
  const [unitRows, setUnitRows] = useState<UnitRow[]>(() => unitRowsFrom(existing?.units ?? []));
  // Values are entered per an amount of a unit, as on the label's column: per 100 g, per 1 bar…
  const [basisAmount, setBasisAmount] = useState('100');
  const [basisUnit, setBasisUnit] = useState('g');
  const [values, setValues] = useState<Record<Nutrient, string>>(() => {
    const v = {} as Record<Nutrient, string>;
    for (const n of NUTRIENTS) {
      const x = existing?.per100g[n];
      v[n] = x === undefined ? '' : formatNumber(x, 3);
    }
    return v;
  });
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');

  if (id !== null && !existing) return <p class="empty">This product does not exist.</p>;

  const { units, errors: unitErrors } = readUnits(unitRows, 'product');
  const basisUnits = [{ id: 'g', name: 'g', grams: 1 }, ...units];
  const basisGrams =
    (parseNumber(basisAmount) ?? 0) * (basisUnits.find((u) => u.id === basisUnit)?.grams ?? 0);

  const parsed: NutrientValues = {};
  const valueErrors = new Map<Nutrient, string>();
  for (const n of NUTRIENTS) {
    const text = values[n].trim();
    if (text === '') {
      if (REQUIRED_NUTRIENTS.includes(n)) valueErrors.set(n, `Add ${NUTRIENT_LABEL[n]}`);
      continue;
    }
    const x = parseNumber(text);
    if (x === null) valueErrors.set(n, 'Not a number');
    else parsed[n] = x;
  }

  const cleanName = cleanText(name);
  const taken = [...store.foods.value.values()].find(
    (f) => f.id !== id && nameKey(f.name) === nameKey(cleanName),
  );
  const nameError = !cleanName ? 'Add a name' : taken ? `“${taken.name}” already exists` : '';
  const basisError = basisGrams > 0 ? '' : 'Check the amount';
  const valid = !nameError && !basisError && valueErrors.size === 0 && unitErrors.size === 0;

  const used = id === null ? { meals: 0, recipes: 0 } : usages(data, id);
  const inUse = used.meals + used.recipes > 0;
  const hint = macroHint(parsed);

  function save() {
    setSubmitted(true);
    if (!valid) return;
    const per100g: NutrientValues = {};
    for (const [n, x] of Object.entries(per100gFrom(parsed, basisGrams)) as [Nutrient, number][]) {
      per100g[n] = roundStored(x);
    }
    const product: Product = {
      id: existing?.id ?? newId(),
      name: cleanName,
      per100g,
      units,
      archived: existing?.archived ?? false,
    };
    try {
      store.saveProduct(product);
    } catch (err) {
      setSaveError((err as Error).message);
      return;
    }
    if (addToPicker && !existing) handOverCreatedFood(product.id);
    goBack('/library');
  }

  const show = (error: string | undefined) => submitted && error && <p class="error">{error}</p>;

  return (
    <form
      class="form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label class="field">
        <span class="label">Name</span>
        <input
          class="input"
          value={name}
          placeholder="e.g. Skyr natural"
          onInput={(e) => setName(e.currentTarget.value)}
        />
        {show(nameError)}
      </label>

      <fieldset class="section">
        <legend class="label">
          Nutrients per
          <input
            class="input number basis"
            aria-label="Per amount"
            inputMode="decimal"
            value={basisAmount}
            onInput={(e) => setBasisAmount(e.currentTarget.value)}
          />
          <select
            class="input"
            aria-label="Per unit"
            value={basisUnit}
            onChange={(e) => {
              const unit = e.currentTarget.value;
              setBasisUnit(unit);
              setBasisAmount(unit === 'g' ? '100' : '1');
            }}
          >
            {basisUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </legend>
        {show(basisError)}
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
                placeholder={REQUIRED_NUTRIENTS.includes(n) ? '' : 'unknown'}
                value={values[n]}
                onInput={(e) => setValues({ ...values, [n]: e.currentTarget.value })}
              />
              {show(valueErrors.get(n))}
            </label>
          ))}
        </div>
        {hint && <p class="hint">{hint}</p>}
      </fieldset>

      <fieldset class="section">
        <legend class="label">Units</legend>
        <UnitsEditor
          rows={unitRows}
          onChange={setUnitRows}
          usesOf={(unitId) => (id ? unitUsages(data, id, unitId) : 0)}
          errors={submitted ? unitErrors : new Map()}
        />
      </fieldset>

      {inUse && (
        <p class="notice">
          Used in {plural(used.meals, 'meal')} and {plural(used.recipes, 'recipe')}: saving changes
          them too.
        </p>
      )}
      {saveError && <p class="error">Could not save: {saveError}</p>}

      <div class="actions action-bar">
        <button type="submit" class="button primary">
          Save
        </button>
        <button type="button" class="button" onClick={() => goBack('/library')}>
          Cancel
        </button>
        {existing && !inUse && (
          <ConfirmButton
            class="push-right"
            label="Delete"
            confirmLabel="Tap again to delete"
            onConfirm={() => {
              store.deleteFood(existing.id);
              goBack('/library');
            }}
          />
        )}
      </div>
    </form>
  );
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** A hint when label kcal and the macros disagree by more than 15%: likely a typo. */
function macroHint(v: NutrientValues): string {
  const { kcal, protein, fat, carbs } = v;
  if (kcal === undefined || protein === undefined || fat === undefined || carbs === undefined) {
    return '';
  }
  const fromMacros = 4 * protein + 4 * carbs + 9 * fat;
  const larger = Math.max(kcal, fromMacros);
  if (larger < 20 || Math.abs(kcal - fromMacros) <= 0.15 * larger) return '';
  return `The macros give about ${formatNumber(fromMacros, 0)} kcal: check for a typo.`;
}
