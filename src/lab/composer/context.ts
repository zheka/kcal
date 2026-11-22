import { buildFoodTable } from '../../core/nutrition';
import type { AppData } from '../../core/types';
import { effective } from './recompute';
import type { ComposedMeal, Item } from './types';
import PROMPT from './prompt-v3.txt?raw';

/**
 * What a model call is sent: prompt-v3.txt with its {CONTEXT} and {INPUT} filled in. The context
 * follows model-prompt.md in the approach docs, without "remaining today" (goals are out of the
 * experiment's scope; the prompt's thresholds are absolute) and with no habits yet.
 */

export const LANGUAGE = 'English';
/** History matches sent per call: enough to cover a meal, few enough to stay cheap. */
export const MAX_MATCHES = 25;

/** A food from my history that the model may match: one line of the context. */
export interface Candidate {
  name: string;
  /** label: a scanned product; my product: entered from a label; history: a composed item. */
  kind: 'label' | 'my product' | 'my recipe' | 'history';
  /** What the line says after the name. */
  details: string;
  /** For ranking: when it was last eaten (UTC), if known. */
  lastAt: string;
}

/** Every candidate: the app's products and recipes, and items of earlier composed meals. */
export function candidates(app: AppData | null, meals: readonly ComposedMeal[]): Candidate[] {
  const result: Candidate[] = [];
  // Items from composed meals, newest first; one per name.
  const seen = new Set<string>();
  for (const meal of [...meals].sort((a, b) => b.at.localeCompare(a.at))) {
    for (const item of meal.items) {
      const key = item.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        name: item.name,
        kind: item.source === 'published' ? 'label' : 'history',
        details: itemDetails(item),
        lastAt: meal.at,
      });
    }
  }
  if (!app) return result;
  const lastUse = new Map<string, { at: string; amount: number; unit: string }>();
  for (const meal of [...app.meals].sort((a, b) => a.consumedAt.localeCompare(b.consumedAt))) {
    for (const i of meal.ingredients) {
      lastUse.set(i.food, { at: meal.consumedAt, amount: i.amount, unit: i.unit });
    }
  }
  const table = buildFoodTable(app.products, app.recipes);
  for (const p of app.products) {
    if (seen.has(p.name.toLowerCase())) continue;
    const per = p.perG ?? p.perMl;
    const base = p.perG ? 'g' : 'ml';
    const unit = p.units[0];
    const size = unit ? `1 ${unit.name} = ${unit.g ?? unit.ml} ${unit.g ? 'g' : 'ml'}; ` : '';
    const last = lastUse.get(p.id);
    const lastUnit = last && (p.units.find((u) => u.id === last.unit)?.name ?? last.unit);
    result.push({
      name: p.name,
      kind: p.barcode ? 'label' : 'my product',
      details:
        `${size}per 100 ${base}: ${values(per ?? {}, 100)}` +
        (last ? `; last time: ${num(last.amount)} ${lastUnit}` : ''),
      lastAt: last?.at ?? '',
    });
  }
  for (const r of app.recipes) {
    if (seen.has(r.name.toLowerCase())) continue;
    const food = table.get(r.id);
    const unit = r.units[0];
    const portion = unit && food?.portion(unit.id, 1);
    if (!unit || !portion) continue;
    const last = lastUse.get(r.id);
    result.push({
      name: r.name,
      kind: 'my recipe',
      details:
        `1 ${unit.name}: ${values(portion, 1)}` +
        (last
          ? `; last time: ${num(last.amount)} ${r.units.find((u) => u.id === last.unit)?.name ?? ''}`
          : ''),
      lastAt: last?.at ?? '',
    });
  }
  return result;
}

/**
 * The candidates worth sending for this input: those sharing a word with the text first, then
 * the most recently eaten, up to MAX_MATCHES.
 */
export function pickMatches(all: readonly Candidate[], text: string, meal: readonly Item[]) {
  const words = new Set(
    [text, ...meal.map((i) => i.name)]
      .join(' ')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3),
  );
  const score = (c: Candidate) =>
    c.name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3 && [...words].some((x) => x.startsWith(w) || w.startsWith(x)))
      .length;
  return [...all]
    .map((c, i) => ({ c, i, s: score(c) }))
    .sort((a, b) => b.s - a.s || b.c.lastAt.localeCompare(a.c.lastAt) || a.i - b.i)
    .slice(0, MAX_MATCHES)
    .map(({ c }) => c);
}

export function contextBlock(
  meal: readonly Item[],
  matches: readonly Candidate[],
  now: Date,
): string {
  const time = now.toTimeString().slice(0, 5);
  return [
    `language: ${LANGUAGE}`,
    `time: ${time}, place: unknown`,
    'habits: none',
    `meal so far: ${meal.length > 0 ? JSON.stringify(meal) : 'empty'}`,
    `history matches:${matches.length > 0 ? '' : ' none'}`,
    ...matches.map((c) => `- "${c.name}" (${c.kind}): ${c.details}`),
  ].join('\n');
}

/**
 * The prompt's user input: the meal's whole context follows the prompt as parts of their own, in
 * the order attached (see compose.ts).
 */
export const INPUT =
  'The user input follows as separate parts, in the order given: texts, photos, and scanned ' +
  'products as JSON (with their published values).';

/** The prompt to send: prompt-v3.txt with the context and the input filled in. */
export function fillPrompt(context: string, input: string = INPUT): string {
  return PROMPT.replace('{CONTEXT}', context).replace('{INPUT}', input);
}

function itemDetails(item: Item): string {
  const { per_100g, grams_per_unit } = effective(item);
  const size = grams_per_unit !== 1 ? `1 ${item.unit} = ${num(grams_per_unit)} g; ` : '';
  return `${size}per 100 g: ${values(per_100g, 1)}; last time: ${num(item.count)} ${item.unit}`;
}

/** `160 kcal, protein 14, fat 9, carbs 6`, from values per 1 (× factor). */
function values(
  v: { kcal?: number; protein?: number; fat?: number; carbs?: number },
  factor: number,
): string {
  const n = (x: number | undefined) => num((x ?? 0) * factor);
  return `${n(v.kcal)} kcal, protein ${n(v.protein)}, fat ${n(v.fat)}, carbs ${n(v.carbs)}`;
}

function num(x: number): string {
  return String(Math.round(x * 10) / 10);
}
