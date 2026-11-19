import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { canScan } from '../barcode';
import { GRAMS, NUTRIENT_LABEL, NUTRIENT_UNIT, NUTRIENTS, type Nutrient } from '../config';
import { newId, productWithBarcode, unitUsages, usages } from '../core/foods';
import { formatNumber, parseNumber } from '../core/format';
import { cleanText, nameKey } from '../core/text';
import { isBuiltinName } from '../core/builtins';
import type { NutrientValues, Product } from '../core/types';
import { perGramFrom } from '../core/units';
import type { Store } from '../state/store';
import { ConfirmButton } from './ConfirmButton';
import { handOverCreatedFood } from './drafts';
import { lookUpBarcode, type LookupResult } from '../data/openFoodFacts';
import { BarcodeScanner } from './BarcodeScanner';
import { goBack, replaceRoute } from './router';
import {
  emptyUnitRow,
  productUnitRows,
  readProductUnits,
  UnitsEditor,
  type UnitRow,
} from './UnitsEditor';

interface Props {
  store: Store;
  /** null for a new product. */
  id: string | null;
  /** Prefilled name of a new product (typed in a food picker). */
  initialName?: string;
  /** Add the new product where the picker was, once saved. */
  addToPicker?: boolean;
}

export function ProductForm({ store, id, initialName = '', addToPicker = false }: Props) {
  const data = store.data.value;
  const existing = id === null ? undefined : data.products.find((p) => p.id === id);

  const [name, setName] = useState(existing?.name ?? initialName);
  const [unitRows, setUnitRows] = useState<UnitRow[]>(() => productUnitRows(existing?.units ?? []));
  // Values are entered per an amount of a unit, as on the label's column: per 100 g, per 1 bar…
  const [basisAmount, setBasisAmount] = useState('100');
  const [basisUnit, setBasisUnit] = useState(GRAMS);
  // An existing product is shown per 100 g; empty means 0.
  const [values, setValues] = useState<Record<Nutrient, string>>(() => {
    const v = {} as Record<Nutrient, string>;
    for (const n of NUTRIENTS) {
      const x = existing?.perGram[n];
      v[n] = x === undefined ? '' : formatNumber(x * 100, 3);
    }
    return v;
  });
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [barcode, setBarcode] = useState(existing?.barcode);
  const [scanning, setScanning] = useState(false);
  const [lookup, setLookup] = useState<ScanStatus | null>(null);
  // The current units, for the lookup that finishes after a scan.
  const unitRowsRef = useRef(unitRows);
  useEffect(() => {
    unitRowsRef.current = unitRows;
  }, [unitRows]);

  /** A barcode was read: open the product if it's in the library, else look it up and fill the form. */
  const onCode = useCallback(
    (code: string) => {
      setScanning(false);
      const known = productWithBarcode(store.data.value, code);
      if (known) {
        setLookup({ kind: 'known', code, product: { id: known.id, name: known.name } });
        return;
      }
      setBarcode(code);
      setLookup({ kind: 'looking', code });
      void lookUpBarcode(code).then((result) => {
        setLookup({ kind: 'result', code, result });
        if (result.kind !== 'found') return;
        if (result.name) setName(result.name);
        const filled = {} as Record<Nutrient, string>;
        for (const n of NUTRIENTS) {
          const v = result.per100[n];
          filled[n] = v === undefined ? '' : formatNumber(v, 3);
        }
        setValues(filled);
        if (result.liquid) {
          // Values are per 100 ml: an ml unit, counted as 1 g unless corrected under Units.
          const rows = unitRowsRef.current;
          const ml = rows.find((r) => nameKey(r.name) === 'ml');
          const row = ml ?? { ...emptyUnitRow(), name: 'ml', valueText: '1' };
          if (!ml) setUnitRows([...rows, row]);
          setBasisUnit(row.id);
        } else {
          setBasisUnit(GRAMS);
        }
        setBasisAmount('100');
      });
    },
    [store],
  );

  if (id !== null && !existing) return <p class="empty">This product does not exist.</p>;

  const { units, errors: unitErrors } = readProductUnits(unitRows);
  const basisUnits = [{ grams: 1, id: GRAMS, name: GRAMS }, ...units];
  const basisGrams =
    (parseNumber(basisAmount) ?? 0) * (basisUnits.find((u) => u.id === basisUnit)?.grams ?? 0);

  const parsed: NutrientValues = {};
  const valueErrors = new Map<Nutrient, string>();
  for (const n of NUTRIENTS) {
    const text = values[n].trim();
    if (text === '') continue; // counts as 0
    const x = parseNumber(text);
    if (x === null) valueErrors.set(n, 'Not a number');
    else parsed[n] = x;
  }

  const cleanName = cleanText(name);
  const taken = [...store.foods.value.values()].find(
    (f) => f.id !== id && nameKey(f.name) === nameKey(cleanName),
  );
  const nameError = !cleanName
    ? 'Add a name'
    : isBuiltinName(cleanName)
      ? `“${cleanName}” is a built-in food`
      : taken
        ? `“${taken.name}” already exists`
        : '';
  const basisError = basisGrams > 0 ? '' : 'Check the amount';
  const valid = !nameError && !basisError && valueErrors.size === 0 && unitErrors.size === 0;

  const used = id === null ? { meals: 0, recipes: 0 } : usages(data, id);
  const inUse = used.meals + used.recipes > 0;
  const hint = macroHint(parsed);

  function save() {
    setSubmitted(true);
    if (!valid) return;
    const product: Product = {
      id: existing?.id ?? newId(),
      name: cleanName,
      perGram: perGramFrom(parsed, basisGrams),
      units,
      ...(barcode !== undefined && { barcode }),
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
      {scanning && <BarcodeScanner onCode={onCode} onClose={() => setScanning(false)} />}
      {id === null && canScan() && (
        <button type="button" class="button scan" onClick={() => setScanning(true)}>
          Scan barcode
        </button>
      )}
      {lookup && <ScanMessage status={lookup} />}
      {barcode !== undefined && (
        <p class="barcode">
          Barcode <span class="barcode-digits">{barcode}</span>
          <button
            type="button"
            class="button link"
            onClick={() => {
              setBarcode(undefined);
              setLookup(null);
            }}
          >
            Remove
          </button>
        </p>
      )}

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
              setBasisAmount(unit === GRAMS ? '100' : '1');
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
                placeholder="0"
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
          kind="product"
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

type ScanStatus =
  | { kind: 'known'; code: string; product: { id: string; name: string } }
  | { kind: 'looking'; code: string }
  | { kind: 'result'; code: string; result: LookupResult };

/** What happened to a scanned barcode. */
function ScanMessage({ status }: { status: ScanStatus }) {
  if (status.kind === 'known') {
    return (
      <div class="notice">
        <p>
          Already in your library: <strong>{status.product.name}</strong>
        </p>
        <div class="actions">
          <button
            type="button"
            class="button primary"
            onClick={() => replaceRoute(`/product/${status.product.id}`)}
          >
            Open it
          </button>
        </div>
      </div>
    );
  }
  if (status.kind === 'looking') return <p class="notice">Looking up {status.code}…</p>;
  const { result } = status;
  const text =
    result.kind === 'found'
      ? result.liquid
        ? 'Filled from Open Food Facts, per 100 ml: check the values against the label. ml is counted as 1 g; correct it under Units if you know better.'
        : 'Filled from Open Food Facts, per 100 g: check the values against the label.'
      : result.kind === 'not-found'
        ? `${status.code} isn’t in Open Food Facts. Enter the product from its label.`
        : result.kind === 'offline'
          ? `Offline: couldn’t look up ${status.code}. Enter the product from its label.`
          : 'Couldn’t reach Open Food Facts. Enter the product from its label.';
  return <p class="notice">{text}</p>;
}
