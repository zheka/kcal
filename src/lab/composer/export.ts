import { localTime } from '../../core/time';
import type { ItemAnswers } from '../meal/process';
import { readMeal, type Meal } from '../meal/read';
import type { LogRecord } from '../storage/lab';
import type { ComposedMeal } from './types';

/**
 * The composer's meals as tests for the command-line tool and the bench (scripts/meal-tool.ts,
 * readTest): one zip that unpacks into a folder the bench runs as it is. Each meal is
 * `<meal id>.json`, a test with a section of its own (`lab-composer`); photos and scanned
 * products are files in `data/`, each named by the id it is kept under here: a photo by its lab
 * file id (as the logs' requests name it), a product by its attached id (it is inline in the
 * logs' requests). Deleting `lab-composer` makes a downloaded meal a plain test.
 *
 * The time and the model's answer only when the answer is for the meal's context as it is: else
 * (never answered, or attached to since) its inputs only.
 */

export const SECTION = 'lab-composer';

/** A meal as a test: what the tool reads, and the lab's own section. */
export interface MealTest {
  description: string;
  /** When its answer was asked for, local time with the offset: the time the model was told. */
  time?: string;
  language: string;
  inputs: ({ text: string } | { photo: string } | { product: string })[];
  [SECTION]: {
    meal: string;
    /** The build that asked, when the log says. */
    build?: string;
    /** The model's answer as it came. */
    answer?: unknown;
    /** The user's choices on that answer, by name. */
    answers?: Choice[];
    /** Photos no longer kept (left out of the inputs). */
    missing?: string[];
  };
}

/**
 * A choice on a product (process.ts ItemAnswers), by name: the dish, the product as the model
 * guessed it, then what was chosen: the food (another of its foods), a size per food (an amount
 * in `base`), the count.
 */
export interface Choice {
  dish: string;
  product: string;
  base: 'g' | 'ml';
  food?: string;
  sizes?: Record<string, number>;
  count?: number;
}

/** A downloaded meal: its test, and its files by their path in the download. */
export interface MealDownload {
  name: string;
  test: MealTest;
  photos: { path: string; file: string }[];
  products: { path: string; json: string }[];
}

/** A logged update of the composer (main.tsx), as far as this reads it. */
type UpdateLog = LogRecord & { meal?: string; response?: { answer?: unknown; error?: string } };

/** The meal as a test, null when it has nothing attached. `logs` oldest first, as kept. */
export function mealTest(
  meal: ComposedMeal,
  logs: readonly LogRecord[],
  language: string,
  hasFile: (id: string) => boolean,
): MealDownload | null {
  if (meal.context.length === 0) return null;
  const photos: MealDownload['photos'] = [];
  const products: MealDownload['products'] = [];
  const missing: string[] = [];
  const inputs: MealTest['inputs'] = [];
  for (const a of meal.context) {
    if (a.kind === 'text') inputs.push({ text: a.text });
    else if (a.kind === 'photo') {
      if (!hasFile(a.file)) {
        missing.push(a.file);
        continue;
      }
      const path = `data/${a.file}.jpg`;
      photos.push({ path, file: a.file });
      inputs.push({ photo: path });
    } else {
      const path = `data/${a.id}.json`;
      products.push({ path, json: `${JSON.stringify(a.product, null, 2)}\n` });
      inputs.push({ product: path });
    }
  }
  const answered = answerOf(meal, logs as UpdateLog[]);
  const answers = answered && meal.meal ? choices(meal.meal, meal.answers) : [];
  return {
    name: `${meal.id}.json`,
    test: {
      description: meal.title,
      ...(answered && { time: answered.at }),
      language,
      inputs,
      [SECTION]: {
        meal: meal.id,
        ...(answered?.build && { build: answered.build }),
        ...(answered && { answer: answered.answer }),
        ...(answers.length > 0 && { answers }),
        ...(missing.length > 0 && { missing }),
      },
    },
    photos,
    products,
  };
}

/**
 * The meal's answer, when it is for the context as it is: as the meal keeps it (since
 * 2026-11-25), else as last logged for it, if that is the answer the meal shows. With its time,
 * and the build that asked when the log says.
 */
function answerOf(
  meal: ComposedMeal,
  logs: readonly UpdateLog[],
): { answer: unknown; at: string; build?: string } | null {
  if (!meal.meal || meal.changed) return null;
  const mine = logs.filter(
    (l) => l.meal === meal.id && l.response?.answer !== undefined && !l.response.error,
  );
  const second = (time: string) => Math.floor(Date.parse(time) / 1000);
  if (meal.answer !== undefined && meal.answeredAt) {
    const at = meal.answeredAt;
    const log = mine.find((l) => second(l.time) === second(at));
    return { answer: meal.answer, at, ...(log && { build: log.build }) };
  }
  const log = mine.at(-1);
  if (!log || !sameMeal(readMeal(log.response!.answer).meal, meal.meal)) return null;
  return { answer: log.response!.answer, at: localTime(new Date(log.time)), build: log.build };
}

const sameMeal = (a: Meal, b: Meal) => JSON.stringify(a) === JSON.stringify(b);

/** The user's answers (by `dish.item`, process.ts itemKey) by name, in the meal's order. */
function choices(meal: Meal, answers: Record<string, ItemAnswers>): Choice[] {
  return Object.entries(answers)
    .map(([key, a]) => ({ at: key.split('.').map(Number) as [number, number], a }))
    .sort((x, y) => x.at[0] - y.at[0] || x.at[1] - y.at[1])
    .flatMap(({ at: [d, i], a }) => {
      const dish = meal.dishes[d];
      const item = dish?.items[i];
      if (!dish || !item) return [];
      const choice: Choice = {
        dish: dish.name,
        product: item.foods[0]?.name ?? '',
        base: item.base,
      };
      if (a.food !== undefined) choice.food = a.food;
      if (a.sizes) {
        choice.sizes = Object.fromEntries(Object.entries(a.sizes).map(([f, s]) => [f, Number(s)]));
      }
      if (a.count !== undefined) choice.count = Number(a.count);
      return [choice];
    });
}

/**
 * The meals as one zip (fflate, loaded only when asked): each meal with something attached, its
 * photos as kept (`files`), its products. Photos are stored as they are (JPEG doesn't shrink).
 */
export async function mealsZip(
  meals: readonly ComposedMeal[],
  logs: readonly LogRecord[],
  language: string,
  files: (id: string) => Promise<Blob | null | undefined>,
): Promise<Uint8Array> {
  const { zipSync, strToU8 } = await import('fflate');
  const blobs = new Map<string, Uint8Array>();
  for (const m of meals) {
    for (const a of m.context) {
      if (a.kind !== 'photo' || blobs.has(a.file)) continue;
      const blob = await files(a.file);
      if (blob) blobs.set(a.file, new Uint8Array(await blob.arrayBuffer()));
    }
  }
  const entries: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  for (const m of meals) {
    const d = mealTest(m, logs, language, (id) => blobs.has(id));
    if (!d) continue;
    entries[d.name] = strToU8(`${JSON.stringify(d.test, null, 2)}\n`);
    for (const p of d.photos) entries[p.path] = [blobs.get(p.file)!, { level: 0 }];
    for (const p of d.products) entries[p.path] = strToU8(p.json);
  }
  return zipSync(entries);
}
