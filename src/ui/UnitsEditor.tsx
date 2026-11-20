import { GRAMS, type Base } from '../config';
import { roundStored } from '../core/decimal';
import { newId } from '../core/foods';
import { formatNumber, parseNumber } from '../core/format';
import { cleanText, nameKey } from '../core/text';
import { unitSize, type ProductUnit, type RecipeUnit } from '../core/types';
import { isReservedProductUnitName } from '../core/units';

/**
 * A unit as typed in a form. For a product, `valueText` is how many g or ml (`base`) one of
 * the unit is ("1 piece = 60 g", "1 cup = 250 ml"); for a recipe, how many of the unit the
 * whole recipe makes ("makes 6 servings").
 */
export interface UnitRow {
  id: string;
  name: string;
  valueText: string;
  /** A product unit's base. */
  base?: Base;
}

export function productUnitRows(units: readonly ProductUnit[]): UnitRow[] {
  return units.map((u) => {
    const { base, size } = unitSize(u);
    return { id: u.id, name: u.name, valueText: formatNumber(size, 3), base };
  });
}

export function recipeUnitRows(units: readonly RecipeUnit[]): UnitRow[] {
  return units.map((u) => ({ id: u.id, name: u.name, valueText: formatNumber(u.makes, 3) }));
}

export function emptyUnitRow(base?: Base): UnitRow {
  return { id: newId(), name: '', valueText: '', ...(base && { base }) };
}

const isBlank = (row: UnitRow) => row.name.trim() === '' && row.valueText.trim() === '';

type Kind = 'product' | 'recipe';

/**
 * Reads typed units: blank rows are ignored; every other row needs a free name and a positive
 * number, rounded for storing. Returns the units' names and values and an error per row id.
 */
function readRows(
  rows: readonly UnitRow[],
  kind: Kind,
): { units: (UnitRow & { value: number })[]; errors: Map<string, string> } {
  const units: (UnitRow & { value: number })[] = [];
  const errors = new Map<string, string>();
  const names = new Set<string>();
  for (const row of rows.filter((r) => !isBlank(r))) {
    const name = cleanText(row.name);
    const parsed = parseNumber(row.valueText);
    const value = parsed === null ? null : roundStored(parsed);
    if (!name) errors.set(row.id, 'Add a name');
    else if (kind === 'product' && isReservedProductUnitName(name)) {
      errors.set(row.id, `“${name}” is reserved: g and ml are the product’s bases`);
    } else if (names.has(nameKey(name))) errors.set(row.id, `“${name}” is defined twice`);
    else if (value === null || value <= 0) {
      errors.set(
        row.id,
        kind === 'product' ? `Add how many ${row.base ?? GRAMS} it is` : 'Add how many it makes',
      );
    }
    names.add(nameKey(name));
    if (!errors.has(row.id)) units.push({ ...row, name, value: value! });
  }
  return { units, errors };
}

/**
 * Reads a product's typed units. `bases` are the bases that have values: a unit in another
 * base is an error, since the product can't be measured in it.
 */
export function readProductUnits(
  rows: readonly UnitRow[],
  bases: readonly Base[],
): { units: ProductUnit[]; errors: Map<string, string> } {
  const { units, errors } = readRows(rows, 'product');
  const kept: ProductUnit[] = [];
  for (const { id, name, value, base = GRAMS } of units) {
    if (!bases.includes(base)) {
      errors.set(id, `${name} is in ${base}: enter at least one value per ${base}`);
    } else {
      kept.push(base === GRAMS ? { g: value, id, name } : { id, ml: value, name });
    }
  }
  return { units: kept, errors };
}

/** A unit's base: a selector when the product has both, else the one base as text. */
export function BaseSelect({
  bases,
  value,
  onChange,
  label,
}: {
  bases: readonly Base[];
  value: Base;
  onChange: (base: Base) => void;
  label: string;
}) {
  // A unit whose base lost its values still shows it, marked by its error.
  const options = bases.includes(value) ? bases : [...bases, value];
  if (options.length === 1) return <span>{value}</span>;
  return (
    <select
      class="input base"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value as Base)}
    >
      {options.map((b) => (
        <option key={b} value={b}>
          {b}
        </option>
      ))}
    </select>
  );
}

export function readRecipeUnits(rows: readonly UnitRow[]): {
  units: RecipeUnit[];
  errors: Map<string, string>;
} {
  const { units, errors } = readRows(rows, 'recipe');
  return { units: units.map(({ id, name, value }) => ({ id, makes: value, name })), errors };
}

interface Props {
  kind: Kind;
  /** A product's bases that have values: its units can be in these. */
  bases?: readonly Base[];
  rows: UnitRow[];
  onChange: (rows: UnitRow[]) => void;
  /** How many ingredients use a unit; used units can't be removed. */
  usesOf: (unitId: string) => number;
  errors: Map<string, string>;
}

export function UnitsEditor({ kind, bases = [GRAMS], rows, onChange, usesOf, errors }: Props) {
  const change = (id: string, patch: Partial<UnitRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div class="units">
      {rows.map((row) => {
        const uses = usesOf(row.id);
        const name = (
          <input
            class="input"
            aria-label="Unit name"
            placeholder={kind === 'product' ? 'piece' : 'servings'}
            value={row.name}
            onInput={(e) => change(row.id, { name: e.currentTarget.value })}
          />
        );
        const value = (
          <input
            class="input number"
            aria-label={
              kind === 'product'
                ? `Size of 1 ${row.name || 'unit'}`
                : `How many ${row.name || 'units'} it makes`
            }
            inputMode="decimal"
            placeholder={kind === 'product' ? '60' : '6'}
            value={row.valueText}
            onInput={(e) => change(row.id, { valueText: e.currentTarget.value })}
          />
        );
        return (
          <div class="unit-row" key={row.id}>
            <div class={`unit-fields ${kind}`}>
              {kind === 'product' ? (
                <>
                  <span class="unit-one">1</span>
                  {name}
                  <span>=</span>
                  {value}
                  <BaseSelect
                    bases={bases}
                    value={row.base ?? GRAMS}
                    onChange={(base) => change(row.id, { base })}
                    label={`Unit of 1 ${row.name || 'unit'}`}
                  />
                </>
              ) : (
                <>
                  <span class="unit-one">makes</span>
                  {value}
                  {name}
                </>
              )}
              <button
                type="button"
                class="icon-button"
                aria-label={`Remove unit ${row.name}`}
                disabled={uses > 0}
                title={uses > 0 ? `Used in ${uses} ingredients` : undefined}
                onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
              >
                ×
              </button>
            </div>
            {errors.has(row.id) && <p class="error">{errors.get(row.id)}</p>}
          </div>
        );
      })}
      <button
        type="button"
        class="button link"
        onClick={() =>
          onChange([...rows, emptyUnitRow(kind === 'product' ? (bases[0] ?? GRAMS) : undefined)])
        }
      >
        ＋ Add unit
      </button>
    </div>
  );
}
