/**
 * A processed meal as text, for reading in a terminal and in the bench's log:
 *
 *   # Обед: 640kcal, 18p, 22f, 95c, 300w
 *   ## Вареники: 640kcal, 18p, 22f, 95c, 300w
 *   - Вареники с картошкой — 10 шт. × 45 г: 450g, 640kcal, 18p, 22f, 95c, 300w
 *     ? что
 *       * с картошкой
 *       ~ с творогом: +40kcal, +9p, +2f, -12c
 *       ~ с вишней:   -150kcal, -2p, -4f, +18c
 *     ? сколько
 *       ~ 8: -90g, -130kcal, -3.6p, -4.4f, -19c, -60w
 *       * 10
 *   ! dishes[0].products[1]: …
 *
 * A line's kind by its first mark: `#` the meal, `##` a dish, `-` a product, `?` a question,
 * `*` the model's guess, `~` another answer, `!` a note (the reader's flags). A line is words, then
 * after `: ` its numbers (what a chart would show), if it has any; the numbers never hold a `:`.
 * Numbers in one form, each with its unit: `<amount>g|ml, <kcal>kcal, <protein>p, <fat>f,
 * <carbs>c, <water>w`; the amount for a product only (a dish's or a meal's would add g to ml).
 * Another answer's change against the guess in the same form, signed, with only what changes,
 * aligned within the question. Only the questions asked are shown: the rest aren't worth asking.
 */
import { type Processed, type Question, type Values } from './process.ts';

const AXES = { kind: 'что', size: 'размер', count: 'сколько', whole: 'или' };

type Base = 'g' | 'ml';

export function textView(meal: Processed, flags: string[] = []): string {
  const lines = [`# ${meal.title}: ${valuesText(meal.total)}`];
  for (const dish of meal.dishes) {
    lines.push(`## ${dish.name}: ${valuesText(dish.values)}`);
    for (const item of dish.items) {
      const base = item.product.base;
      lines.push(`- ${item.name} — ${item.amount}: ${valuesText(item.values, base)}`);
      for (const q of item.questions) if (q.asked) lines.push(...questionLines(q, base));
    }
  }
  for (const f of flags) lines.push(`! ${f}`);
  return lines.join('\n');
}

/** `110g, 430kcal, 7p, 2f, 30c, 20w`: kcal and amounts whole, the rest to a tenth. */
export function valuesText(v: Values, base?: Base): string {
  return fields(v, base, false)
    .map((f) => f.text)
    .join(', ');
}

/** `-90g, -130kcal, -3.6p`: what changes, signed, as valuesText rounds it. */
export function changeText(d: Values, base?: Base): string {
  return fields(d, base, true)
    .map((f) => f.text)
    .join(', ');
}

/** The numbers, the amount only with a base; a change signed, without what doesn't change. */
function fields(v: Values, base: Base | undefined, change: boolean) {
  const all = [
    ...(base ? [{ x: v.amount, digits: 0, unit: base, amount: true }] : []),
    { x: v.kcal, digits: 0, unit: 'kcal', amount: false },
    { x: v.protein, digits: 1, unit: 'p', amount: false },
    { x: v.fat, digits: 1, unit: 'f', amount: false },
    { x: v.carbs, digits: 1, unit: 'c', amount: false },
    { x: v.water, digits: 1, unit: 'w', amount: false },
  ];
  return all
    .map((f) => ({ ...f, r: round(f.x, f.digits) }))
    .filter((f) => !change || f.r !== 0)
    .map((f) => ({ amount: f.amount, text: `${change && f.r > 0 ? '+' : ''}${f.r}${f.unit}` }));
}

/** The question, then its answers: labels, amounts and the rest each in a column. */
function questionLines(q: Question, base: Base): string[] {
  const rows = q.options.map((o) => {
    const changes = o.chosen
      ? []
      : fields(o.delta, o.product.base === base ? base : undefined, true);
    return {
      o,
      amount: changes.find((f) => f.amount)?.text ?? '',
      rest: changes.filter((f) => !f.amount).map((f) => f.text),
    };
  });
  const changed = rows.filter((r) => r.amount || r.rest.length);
  const labels = Math.max(0, ...changed.map((r) => r.o.label.length));
  const amounts = Math.max(0, ...changed.map((r) => r.amount.length));
  const numbers = (r: (typeof rows)[number]) => {
    if (!amounts) return r.rest.join(', ');
    const amount = r.amount ? `${r.amount.padStart(amounts)},` : ' '.repeat(amounts + 1);
    return [amount, r.rest.join(', ')].join(' ').trimEnd().replace(/,$/, '');
  };
  return [
    `  ? ${AXES[q.axis]}`,
    ...rows.map((r) => {
      if (r.o.chosen) return `    * ${r.o.label}`;
      if (!r.amount && !r.rest.length) return `    ~ ${r.o.label}`;
      return `    ~ ${`${r.o.label}:`.padEnd(labels + 1)} ${numbers(r)}`;
    }),
  ];
}

/** Rounded to `digits` places, halves away from zero (a change as its value), never -0. */
const round = (x: number, digits: number) => {
  const r = (Math.sign(x) * Math.round(Math.abs(x) * 10 ** digits)) / 10 ** digits;
  return r === 0 ? 0 : r;
};
