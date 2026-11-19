import { roundStored } from '../core/decimal';
import { newId } from '../core/foods';
import { formatNumber, parseNumber } from '../core/format';
import { cleanText, nameKey } from '../core/text';
import type { ProductUnit, RecipeUnit } from '../core/types';
import { isReservedProductUnitName } from '../core/units';

/**
 * A unit as typed in a form. For a product, `valueText` is the grams of one of the unit
 * ("1 piece = 60 g"); for a recipe, how many of the unit the whole recipe makes ("makes 6
 * servings").
 */
export interface UnitRow {
  id: string;
  name: string;
  valueText: string;
}

export function productUnitRows(units: readonly ProductUnit[]): UnitRow[] {
  return units.map((u) => ({ id: u.id, name: u.name, valueText: formatNumber(u.grams, 3) }));
}

export function recipeUnitRows(units: readonly RecipeUnit[]): UnitRow[] {
  return units.map((u) => ({ id: u.id, name: u.name, valueText: formatNumber(u.makes, 3) }));
}

export function emptyUnitRow(): UnitRow {
  return { id: newId(), name: '', valueText: '' };
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
): { units: { id: string; name: string; value: number }[]; errors: Map<string, string> } {
  const units: { id: string; name: string; value: number }[] = [];
  const errors = new Map<string, string>();
  const names = new Set<string>();
  for (const row of rows.filter((r) => !isBlank(r))) {
    const name = cleanText(row.name);
    const parsed = parseNumber(row.valueText);
    const value = parsed === null ? null : roundStored(parsed);
    if (!name) errors.set(row.id, 'Add a name');
    else if (kind === 'product' && isReservedProductUnitName(name)) {
      errors.set(row.id, '“g” is built in: every product has grams');
    } else if (names.has(nameKey(name))) errors.set(row.id, `“${name}” is defined twice`);
    else if (value === null || value <= 0) {
      errors.set(row.id, kind === 'product' ? 'Add its weight in grams' : 'Add how many it makes');
    }
    names.add(nameKey(name));
    if (!errors.has(row.id)) units.push({ id: row.id, name, value: value! });
  }
  return { units, errors };
}

export function readProductUnits(rows: readonly UnitRow[]): {
  units: ProductUnit[];
  errors: Map<string, string>;
} {
  const { units, errors } = readRows(rows, 'product');
  return { units: units.map(({ id, name, value }) => ({ grams: value, id, name })), errors };
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
  rows: UnitRow[];
  onChange: (rows: UnitRow[]) => void;
  /** How many ingredients use a unit; used units can't be removed. */
  usesOf: (unitId: string) => number;
  errors: Map<string, string>;
}

export function UnitsEditor({ kind, rows, onChange, usesOf, errors }: Props) {
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
                ? `Grams in 1 ${row.name || 'unit'}`
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
                  <span>g</span>
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
      <button type="button" class="button link" onClick={() => onChange([...rows, emptyUnitRow()])}>
        ＋ Add unit
      </button>
    </div>
  );
}
