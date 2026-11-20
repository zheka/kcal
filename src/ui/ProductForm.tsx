import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  BASES,
  GRAMS,
  MILLILITRES,
  NUTRIENT_LABEL,
  NUTRIENT_UNIT,
  NUTRIENTS,
  type Base,
  type Nutrient,
} from '../config';
import { isUsed, newId, productWithBarcode, unitUsages, usages, type Usages } from '../core/foods';
import { formatNumber, parseNumber } from '../core/format';
import { applyChange } from '../core/change';
import { cleanText, nameKey } from '../core/text';
import type { NutrientValues, Product } from '../core/types';
import { perOneFrom } from '../core/units';
import { validateAppData } from '../core/validate';
import { lookUpBarcode, type LookupResult } from '../data/openFoodFacts';
import type { Store } from '../state/store';
import { CloseIcon } from './icons';
import { ScanButton } from './ScanButton';
import { ConfirmButton } from './ConfirmButton';
import { handOver, type ProductRequest } from './drafts';
import { goBack, replaceRoute } from './router';
import { productUnitRows, readProductUnits, UnitsEditor, type UnitRow } from './UnitsEditor';

interface Props {
  store: Store;
  /** null for a new product. */
  id: string | null;
  /** Prefilled name of a new product (typed in a food picker). */
  initialName?: string;
  /** A barcode scanned elsewhere (the Library's search) for a new product: look it up. */
  initialBarcode?: string | undefined;
  /**
   * Opened from a meal or recipe: the product is for that draft. It is checked against the
   * draft's data and handed back to it, to be saved with it, instead of being saved here.
   */
  forDraft?: ProductRequest | undefined;
}

type ValueTexts = Record<Nutrient, string>;
/** What the values of a base are entered per, as on the label's column: 100 g, 1 bar… */
interface Basis {
  amount: string;
  unit: string;
}

const emptyTexts = (): ValueTexts =>
  Object.fromEntries(NUTRIENTS.map((n) => [n, ''])) as ValueTexts;

/** Stored values per 1 g or ml, shown per 100. */
function textsOf(values: NutrientValues | undefined): ValueTexts {
  const texts = emptyTexts();
  for (const n of NUTRIENTS) {
    const x = values?.[n];
    if (x !== undefined) texts[n] = formatNumber(x * 100, 3);
  }
  return texts;
}

/** Typed values: the ones given, and an error per field that isn't a number. */
function readValues(texts: ValueTexts): { values: NutrientValues; errors: Map<Nutrient, string> } {
  const values: NutrientValues = {};
  const errors = new Map<Nutrient, string>();
  for (const n of NUTRIENTS) {
    const text = texts[n].trim();
    if (text === '') continue; // not given
    const x = parseNumber(text);
    if (x === null) errors.set(n, 'Not a number');
    else values[n] = x;
  }
  return { values, errors };
}

/**
 * A product's name, values and units. Values are entered per g or per ml, one base at a time;
 * a base is stored exactly when at least one of its values is filled (0 counts).
 */
export function ProductForm({ store, id, initialName = '', initialBarcode, forDraft }: Props) {
  const data = forDraft?.data ?? store.data.value;
  /** The stored product being edited. */
  const existing = id === null ? undefined : data.products.find((p) => p.id === id);
  /** What the form starts from: the stored product, or a draft's pending one. */
  const initial = existing ?? forDraft?.product;
  const selfId = initial?.id;

  const [name, setName] = useState(initial?.name ?? initialName);
  const [unitRows, setUnitRows] = useState<UnitRow[]>(() => productUnitRows(initial?.units ?? []));
  const [texts, setTexts] = useState<Record<Base, ValueTexts>>(() => ({
    g: textsOf(initial?.perG),
    ml: textsOf(initial?.perMl),
  }));
  const [shown, setShown] = useState<Base>(initial && !initial.perG ? MILLILITRES : GRAMS);
  const [basis, setBasis] = useState<Record<Base, Basis>>({
    g: { amount: '100', unit: GRAMS },
    ml: { amount: '100', unit: MILLILITRES },
  });
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [barcode, setBarcode] = useState(initial?.barcode);
  const [lookup, setLookup] = useState<ScanStatus | null>(null);

  /** A barcode was read: open the product if it's in the library, else look it up and fill the form. */
  const onCode = useCallback(
    (code: string) => {
      const known = productWithBarcode(data, code);
      if (known && known.id !== selfId) {
        setLookup({ kind: 'known', code, product: { id: known.id, name: known.name } });
        return;
      }
      setBarcode(code);
      setLookup({ kind: 'looking', code });
      void lookUpBarcode(code).then((result) => {
        setLookup({ kind: 'result', code, result });
        if (result.kind !== 'found') return;
        if (result.name) setName(result.name);
        // Per 100 g, or per 100 ml for drinks; the other base is left empty.
        const base = result.liquid ? MILLILITRES : GRAMS;
        const filled = emptyTexts();
        for (const n of NUTRIENTS) {
          const v = result.per100[n];
          if (v !== undefined) filled[n] = formatNumber(v, 3);
        }
        setTexts({ g: emptyTexts(), ml: emptyTexts(), [base]: filled });
        setBasis((b) => ({ ...b, [base]: { amount: '100', unit: base } }));
        setShown(base);
      });
    },
    [data, selfId],
  );

  // A barcode scanned in a food picker or the Library's search: look it up as if scanned here.
  const handedBarcodeRef = useRef(initial ? undefined : (forDraft?.barcode ?? initialBarcode));
  useEffect(() => {
    const code = handedBarcodeRef.current;
    handedBarcodeRef.current = undefined;
    if (code) onCode(code);
  }, [onCode]);

  if (id !== null && !existing) return <p class="empty">This product does not exist.</p>;

  const read = { g: readValues(texts.g), ml: readValues(texts.ml) };
  /** The bases that have values: the ones stored. */
  const bases = BASES.filter((b) => Object.keys(read[b].values).length > 0);
  const { units, errors: unitErrors } = readProductUnits(unitRows, bases);
  // While values are being typed, the units of the base shown already count for "per 1 bar".
  const { units: basisChoices } = readProductUnits(unitRows, [...new Set([...bases, shown])]);

  /** How many g or ml a base's values are about ("per 100 g", "per 1 bar" of 45 g). */
  function basisSize(base: Base): number | null {
    const amount = parseNumber(basis[base].amount);
    if (amount === null || amount <= 0) return null;
    if (basis[base].unit === base) return amount;
    const unit = basisChoices.find((u) => u.id === basis[base].unit);
    const size = unit && (base === GRAMS ? unit.g : unit.ml);
    return size === undefined ? null : amount * size;
  }

  const cleanName = cleanText(name);
  const taken = [...data.products, ...data.recipes].find(
    (f) => f.id !== selfId && nameKey(f.name) === nameKey(cleanName),
  );
  const nameError = !cleanName ? 'Add a name' : taken ? `“${taken.name}” already exists` : '';
  const basisErrors = new Map<Base, string>();
  for (const b of bases) if (basisSize(b) === null) basisErrors.set(b, 'Check the amount');
  // A base that meals, recipes or quick buttons measure the product in must keep its values.
  const lostBases = new Map<Base, string>();
  for (const b of BASES) {
    const uses = id === null || bases.includes(b) ? 0 : unitUsages(data, id, b);
    if (uses > 0) {
      lostBases.set(b, `Used in ${b} ${plural(uses, 'time')}: keep at least one value per ${b}`);
    }
  }
  const valuesError =
    bases.length === 0 ? 'Enter at least one value, per g or per ml (0 counts)' : '';
  const valid =
    !nameError &&
    !valuesError &&
    basisErrors.size === 0 &&
    lostBases.size === 0 &&
    read.g.errors.size === 0 &&
    read.ml.errors.size === 0 &&
    unitErrors.size === 0;

  const used = id === null ? undefined : usages(data, id);
  const inUse = used !== undefined && isUsed(used);
  const hint = macroHint(read[shown].values);

  function save() {
    setSubmitted(true);
    if (!valid) {
      // Show the side with a problem, if the one shown has none.
      const wrong = BASES.find(
        (b) => read[b].errors.size > 0 || basisErrors.has(b) || lostBases.has(b),
      );
      if (wrong && wrong !== shown && !read[shown].errors.size) setShown(wrong);
      return;
    }
    const perOne = (b: Base) =>
      bases.includes(b) ? perOneFrom(read[b].values, basisSize(b)!) : undefined;
    const perG = perOne(GRAMS);
    const perMl = perOne(MILLILITRES);
    const product: Product = {
      id: selfId ?? newId(),
      name: cleanName,
      ...(perG && { perG }),
      ...(perMl && { perMl }),
      units,
      ...(barcode !== undefined && { barcode }),
    };
    if (forDraft) {
      // Saved later, with the meal or recipe; checked now against what it will be saved with.
      const problems = validateAppData(applyChange(data, { products: [product] }));
      if (problems.length > 0) return setSaveError(problems.join('; '));
      handOver({ product });
      goBack('/');
      return;
    }
    try {
      store.saveProduct(product);
    } catch (err) {
      setSaveError((err as Error).message);
      return;
    }
    goBack('/library');
  }

  const show = (error: string | undefined) => submitted && error && <p class="error">{error}</p>;
  // The basis selector: the base itself and the units in it.
  const basisUnits = [
    { id: shown, name: shown },
    ...basisChoices.filter((u) => (shown === GRAMS ? u.g : u.ml) !== undefined),
  ];

  return (
    <form
      class="form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div class="field">
        <label class="label" for="product-name">
          Name
        </label>
        <div class="input-with-action">
          <input
            id="product-name"
            class="input"
            value={name}
            placeholder="e.g. Skyr natural"
            onInput={(e) => setName(e.currentTarget.value)}
          />
          {id === null && <ScanButton onCode={onCode} />}
        </div>
        {show(nameError)}
      </div>
      {lookup && (
        <ScanMessage
          status={lookup}
          {...(forDraft && {
            onAdd: (food: string) => {
              handOver({ food });
              goBack('/');
            },
          })}
        />
      )}
      {barcode !== undefined && (
        <p class="barcode">
          Barcode <span class="barcode-digits">{barcode}</span>
          <button
            type="button"
            class="icon-button push-right"
            aria-label="Remove barcode"
            onClick={() => {
              setBarcode(undefined);
              setLookup(null);
            }}
          >
            <CloseIcon />
          </button>
        </p>
      )}

      <fieldset class="section">
        <legend class="label">Nutrients</legend>
        <div class="segmented" role="group" aria-label="Values per">
          {BASES.map((b) => (
            <button
              key={b}
              type="button"
              class="segment"
              aria-pressed={shown === b}
              onClick={() => setShown(b)}
            >
              per {b}
              {bases.includes(b) && <span aria-hidden="true"> ✓</span>}
            </button>
          ))}
        </div>
        <div class="basis-line">
          Per
          <input
            class="input number basis"
            aria-label="Per amount"
            inputMode="decimal"
            value={basis[shown].amount}
            onInput={(e) =>
              setBasis({ ...basis, [shown]: { ...basis[shown], amount: e.currentTarget.value } })
            }
          />
          <select
            class="input"
            aria-label="Per unit"
            value={basis[shown].unit}
            onChange={(e) => {
              const unit = e.currentTarget.value;
              setBasis({ ...basis, [shown]: { unit, amount: unit === shown ? '100' : '1' } });
            }}
          >
            {basisUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        {show(basisErrors.get(shown))}
        <div class="nutrient-grid">
          {NUTRIENTS.map((n) => (
            <label class="field" key={`${shown}-${n}`}>
              <span class="label">
                {NUTRIENT_LABEL[n]}
                {n !== 'kcal' && ` (${NUTRIENT_UNIT[n]})`}
              </span>
              <input
                class="input number"
                inputMode="decimal"
                value={texts[shown][n]}
                onInput={(e) =>
                  setTexts({ ...texts, [shown]: { ...texts[shown], [n]: e.currentTarget.value } })
                }
              />
              {show(read[shown].errors.get(n))}
            </label>
          ))}
        </div>
        <p class="hint">Empty means not given; type 0 for none.</p>
        {hint && <p class="hint">{hint}</p>}
        {show(lostBases.get(shown))}
        {show(valuesError)}
      </fieldset>

      <fieldset class="section">
        <legend class="label">Units</legend>
        <UnitsEditor
          kind="product"
          bases={bases.length > 0 ? bases : [shown]}
          rows={unitRows}
          onChange={setUnitRows}
          usesOf={(unitId) => (id ? unitUsages(data, id, unitId) : 0)}
          errors={submitted ? unitErrors : new Map()}
        />
      </fieldset>

      {inUse && <p class="notice">{usedNotice(used)}</p>}
      {forDraft && <p class="hint">Saved together with the meal or recipe it’s for.</p>}
      {saveError && <p class="error">Could not save: {saveError}</p>}

      <div class="actions action-bar">
        <button type="submit" class="button primary">
          {forDraft ? 'Done' : 'Save'}
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

/** `Used in 3 meals, 1 recipe and 1 quick button: saving changes them too.` */
export function usedNotice(used: Usages): string {
  const parts = [
    used.meals > 0 && plural(used.meals, 'meal'),
    used.recipes > 0 && plural(used.recipes, 'recipe'),
    used.quickButtons > 0 && plural(used.quickButtons, 'quick button'),
  ].filter((p): p is string => typeof p === 'string');
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `Used in ${list}: saving changes them too.`;
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
function ScanMessage({
  status,
  onAdd,
}: {
  status: ScanStatus;
  /** Opened from a meal or recipe: add the known product there instead of opening it. */
  onAdd?: (food: string) => void;
}) {
  if (status.kind === 'known') {
    const { id } = status.product;
    return (
      <div class="notice">
        <p>
          Already in your library: <strong>{status.product.name}</strong>
        </p>
        <div class="actions">
          <button
            type="button"
            class="button primary"
            onClick={() => (onAdd ? onAdd(id) : replaceRoute(`/product/${id}`))}
          >
            {onAdd ? 'Add it' : 'Open it'}
          </button>
        </div>
      </div>
    );
  }
  if (status.kind === 'looking') return <p class="notice">Looking up {status.code}…</p>;
  const { result } = status;
  const text =
    result.kind === 'found'
      ? `Filled from Open Food Facts, per 100 ${result.liquid ? 'ml' : 'g'}: check the values against the label.`
      : result.kind === 'not-found'
        ? `${status.code} isn’t in Open Food Facts. Enter the product from its label.`
        : result.kind === 'offline'
          ? `Offline: couldn’t look up ${status.code}. Enter the product from its label.`
          : 'Couldn’t reach Open Food Facts. Enter the product from its label.';
  return <p class="notice">{text}</p>;
}
