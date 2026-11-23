/**
 * A processed meal as text, for reading in a terminal and in the bench's log:
 *
 *   # Обед
 *   ## Вареники — 640 kcal
 *   - Вареники с картошкой — 10 шт. × 45 г (450 г: 650 kcal · 18 P · 22 F · 95 C)
 *     ? что: [с картошкой] / с творогом (+40) / с вишней (−150)
 *     · сколько: 8 (−130) / [10]
 *   = 640 kcal · …
 *
 * `?` a question asked, `·` one not asked (under the threshold, or over the meal's limit); each
 * option's change in kcal (and protein when it matters), the model's guess in brackets.
 */
import { type Processed, type Question, type Values, num, THRESHOLD } from './process.ts';

const AXES = { kind: 'что', size: 'размер', count: 'сколько', whole: 'или' };

export function textView(meal: Processed, flags: string[] = []): string {
  const lines = [`# ${meal.title}`];
  for (const dish of meal.dishes) {
    lines.push(`## ${dish.name} — ${Math.round(dish.values.kcal)} kcal`);
    for (const item of dish.items) {
      const v = item.values;
      lines.push(`- ${item.name} — ${item.amount} (${num(v.amount)}: ${valuesText(v)})`);
      for (const q of item.questions) lines.push(`  ${questionText(q)}`);
    }
  }
  lines.push(`= ${valuesText(meal.total)}`);
  for (const f of flags) lines.push(`! ${f}`);
  return lines.join('\n');
}

export function valuesText(v: Values): string {
  return `${Math.round(v.kcal)} kcal · ${num(v.protein)} P · ${num(v.fat)} F · ${num(v.carbs)} C`;
}

function questionText(q: Question): string {
  const options = q.options.map((o) => {
    if (o.chosen) return `[${o.label}]`;
    const changes = [signed(o.delta.kcal)];
    if (Math.abs(o.delta.protein) >= THRESHOLD.protein)
      changes.push(`${signed(o.delta.protein)} P`);
    return `${o.label} (${changes.join(', ')})`;
  });
  return `${q.asked ? '?' : '·'} ${AXES[q.axis]}: ${options.join(' / ')}`;
}

const signed = (x: number) => (x < 0 ? `−${Math.round(-x)}` : `+${Math.round(x)}`);
