import { parseNumber, formatNumber } from '../core/format';
import { cleanText, nameKey } from '../core/text';
import type { Unit } from '../core/types';
import { isReservedUnitName, newUnitId } from '../core/units';

/** A unit as typed in a form. */
export interface UnitRow {
  id: string;
  name: string;
  gramsText: string;
}

export function unitRowsFrom(units: readonly Unit[]): UnitRow[] {
  return units.map((u) => ({ id: u.id, name: u.name, gramsText: formatNumber(u.grams, 3) }));
}

const isBlank = (row: UnitRow) => row.name.trim() === '' && row.gramsText.trim() === '';

/**
 * Reads typed units: blank rows are ignored; every other row needs a free name and positive
 * grams. Returns the units and an error per row id.
 */
export function readUnits(
  rows: readonly UnitRow[],
  kind: 'product' | 'recipe',
): { units: Unit[]; errors: Map<string, string> } {
  const units: Unit[] = [];
  const errors = new Map<string, string>();
  const names = new Set<string>();
  for (const row of rows.filter((r) => !isBlank(r))) {
    const name = cleanText(row.name);
    const grams = parseNumber(row.gramsText);
    if (!name) errors.set(row.id, 'Add a name');
    else if (isReservedUnitName(kind, name)) errors.set(row.id, `“${name}” is built in`);
    else if (names.has(nameKey(name))) errors.set(row.id, `“${name}” is defined twice`);
    else if (grams === null || grams <= 0) errors.set(row.id, 'Add its weight in grams');
    names.add(nameKey(name));
    if (!errors.has(row.id)) units.push({ id: row.id, name, grams: grams! });
  }
  return { units, errors };
}

interface Props {
  rows: UnitRow[];
  onChange: (rows: UnitRow[]) => void;
  /** How many ingredients use a unit; used units can't be removed. */
  usesOf: (unitId: string) => number;
  errors: Map<string, string>;
}

export function UnitsEditor({ rows, onChange, usesOf, errors }: Props) {
  const change = (id: string, patch: Partial<UnitRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const add = () =>
    onChange([
      ...rows,
      { id: newUnitId(rows.map((r) => ({ ...r, grams: 0 }))), name: '', gramsText: '' },
    ]);

  return (
    <div class="units">
      {rows.map((row) => {
        const uses = usesOf(row.id);
        return (
          <div class="unit-row" key={row.id}>
            <div class="unit-fields">
              <span class="unit-one">1</span>
              <input
                class="input"
                aria-label="Unit name"
                placeholder="piece"
                value={row.name}
                onInput={(e) => change(row.id, { name: e.currentTarget.value })}
              />
              <span>=</span>
              <input
                class="input number"
                aria-label={`Grams in 1 ${row.name || 'unit'}`}
                inputMode="decimal"
                placeholder="60"
                value={row.gramsText}
                onInput={(e) => change(row.id, { gramsText: e.currentTarget.value })}
              />
              <span>g</span>
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
      <button type="button" class="button link" onClick={add}>
        ＋ Add unit
      </button>
    </div>
  );
}
