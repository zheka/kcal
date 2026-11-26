/**
 * The meal composer's request, run locally: inputs (photos, texts, barcodes, product JSON) in,
 * the model's answer and what the code makes of it out, as one entry (the lab's log entry, with
 * the code's side added). The lab's own code does the work (src/lab/meal, src/ai); this file
 * only does what the browser would: shrink photos (sharp), look up barcodes, give Gemini its keys
 * (from the environment).
 * Used by scripts/meal.ts (one meal) and scripts/meal-bench.ts (tests).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { lookUpBarcode } from '../src/data/openFoodFacts.ts';
import { createGemini } from '../src/ai/gemini/index.ts';
import { type ModelRequest, type ModelResponse, run } from '../src/ai/model.ts';
import type { Attempt, Progress, Provider, Urgency } from '../src/ai/provider.ts';
import { type Processed, process as processMeal } from '../src/lab/meal/process.ts';
import { type Meal, readMeal } from '../src/lab/meal/read.ts';
import { type Input, mealRequest } from '../src/lab/meal/request.ts';
import { SETTINGS } from '../src/lab/meal/settings.ts';
import { textView } from '../src/lab/meal/view.ts';

export const PROMPT_FILE = 'src/lab/meal/prompt.md';

/** An input as given on the command line or in a test. */
export type Given =
  { text: string } | { photo: string } | { barcode: string } | { productFile: string };

const PHOTO = /\.(jpe?g|png|webp|heic|heif|avif)$/i;

/** A command-line argument: a photo file, a product JSON file, a barcode, else a text. */
export function given(arg: string): Given {
  if (existsSync(arg) && statSync(arg).isFile()) {
    if (PHOTO.test(arg)) return { photo: arg };
    if (arg.endsWith('.json')) return { productFile: arg };
  }
  if (/^\d{8,14}$/.test(arg)) return { barcode: arg };
  return { text: arg };
}

/**
 * A test (a JSON file): what is hard about it, the inputs in order, and optionally the time and
 * the answer language the request tells the model (else the tool's own). Other fields are
 * ignored (a lab download's own section). Texts and barcodes are inline; files (photos, product
 * JSON, text files) are paths relative to the test file, or absolute.
 *
 *   { "description": "…", "time": "08:10", "language": "ru",
 *     "inputs": [{ "photo": "data/meatballs.jpg" }, { "text": "…" }] }
 *
 * `time`: `HH:MM`, as the request tells the model (the lab's: scripts/lab-meal-test.ts).
 */
export interface Test {
  description?: string;
  /** The test's time, else undefined: the caller's own. */
  time?: (base: Date) => Date;
  language?: string;
  given: Given[];
}

type TestInput =
  | { text: string }
  | { barcode: string }
  | { photo: string }
  | { product: string }
  | { textFile: string };

export function readTest(file: string): Test {
  const json = JSON.parse(readFileSync(file, 'utf8')) as {
    description?: string;
    time?: string;
    language?: string;
    inputs?: TestInput[];
  };
  if (!Array.isArray(json.inputs)) throw new Error(`${file}: no "inputs" list`);
  const path = (p: string) => {
    const full = resolve(dirname(file), p);
    if (!existsSync(full)) throw new Error(`${file}: no ${p}`);
    return full;
  };
  const given = json.inputs.map((i): Given => {
    if ('text' in i) return { text: i.text };
    if ('barcode' in i) return { barcode: i.barcode };
    if ('photo' in i) return { photo: path(i.photo) };
    if ('product' in i) return { productFile: path(i.product) };
    if ('textFile' in i) return { text: readFileSync(path(i.textFile), 'utf8').trim() };
    throw new Error(`${file}: an input of no known kind: ${JSON.stringify(i)}`);
  });
  const time = json.time === undefined ? undefined : testTime(json.time);
  if (time === null) throw new Error(`${file}: "time": HH:MM, not ${json.time}`);
  return {
    ...(json.description && { description: json.description }),
    ...(time && { time }),
    ...(json.language && { language: json.language }),
    given,
  };
}

/** A test's time (`HH:MM`), on the base's date: what the model is told. Null when it isn't one. */
export function testTime(text: string): ((base: Date) => Date) | null {
  const m = /^(\d{2}):(\d{2})$/.exec(text);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return (base) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate(), Number(m[1]), Number(m[2]));
}

/** A brief note on what's going on, so a long wait has a reason (--verbose). */
export type Hint = (text: string) => void;

/** Inputs as the request takes them: barcodes looked up, product files read. */
export async function inputs(list: Given[], language: string, hint?: Hint): Promise<Input[]> {
  const out: Input[] = [];
  for (const g of list) {
    if ('barcode' in g) {
      hint?.(`looking up ${g.barcode} on Open Food Facts…`);
      const found = await lookUpBarcode(g.barcode, { language });
      if (found.kind !== 'found') throw new Error(`barcode ${g.barcode}: ${found.kind}`);
      out.push({ product: found.data });
    } else if ('productFile' in g) {
      out.push({ product: JSON.parse(readFileSync(g.productFile, 'utf8')) });
    } else out.push(g);
  }
  return out;
}

const shrunk = new Map<string, Promise<Blob>>();

/**
 * A photo (by its path) as the lab sends it (SETTINGS.photo): upright, shrunk, JPEG. A JPEG
 * already upright and small enough is sent as it is, not encoded again: a photo the lab stored
 * (shrunk on the phone) is then sent as the lab sent it.
 */
export function photoFile(path: string): Promise<Blob> {
  let p = shrunk.get(path);
  if (!p) {
    p = prepare(path).then((b) => new Blob([new Uint8Array(b)], { type: 'image/jpeg' }));
    shrunk.set(path, p);
  }
  return p;
}

async function prepare(path: string): Promise<Buffer> {
  const { maxSide, quality } = SETTINGS.photo;
  const image = sharp(path);
  const { format, width = Infinity, height = Infinity, orientation = 1 } = await image.metadata();
  if (format === 'jpeg' && orientation === 1 && Math.max(width, height) <= maxSide) {
    return readFileSync(path);
  }
  return image
    .rotate()
    .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

/**
 * Gemini with the keys from the environment: GEMINI_API_KEY (Key, cheap) and GEMINI_API_KEY_2
 * (Key 2, reliable), either or both; null when neither is set. One per process, so its pace
 * holds across a bench's requests.
 */
export function envGemini(): Provider | null {
  const keys = { key: process.env.GEMINI_API_KEY ?? '', key2: process.env.GEMINI_API_KEY_2 ?? '' };
  if (!keys.key && !keys.key2) return null;
  return createGemini({ keys: async () => keys, online: () => true });
}

/**
 * How soon the tool wants an answer: by `--target` (seconds, or `inf`: Key only), given up after
 * `--limit`. A meal (scripts/meal.ts) by 60 s, given up after 90 s: someone is at the terminal,
 * but less hurried than in the lab; the bench by 60 s, given up after 300 s: it runs unattended,
 * and a busy minute shouldn't lose a run. Why Key 2 is spent then: docs/ai.md.
 */
export const MEAL_URGENCY: Urgency = { targetMs: 60_000, limitMs: 90_000 };
export const BENCH_URGENCY: Urgency = { targetMs: 60_000, limitMs: 300_000 };

/** The urgency as `--target` and `--limit` say (seconds; `inf` for no target), else `defaults`. */
export function urgencyArgs(
  args: { target?: string | undefined; limit?: string | undefined },
  defaults: Urgency,
): Urgency {
  const seconds = (text: string, name: string) => {
    const n = text === 'inf' ? Infinity : Number(text);
    if (!(n > 0)) throw new Error(`--${name}: seconds, or inf; not ${text}`);
    return n * 1000;
  };
  const urgency = {
    targetMs: args.target === undefined ? defaults.targetMs : seconds(args.target, 'target'),
    limitMs: args.limit === undefined ? defaults.limitMs : seconds(args.limit, 'limit'),
  };
  if (urgency.limitMs === Infinity) throw new Error('--limit: seconds');
  return urgency;
}

/** The urgency, in a line. */
export const urgencyText = ({ targetMs, limitMs }: Urgency): string =>
  `answer by ${targetMs === Infinity ? 'any time (Key only)' : `${targetMs / 1000} s`}, ` +
  `given up after ${limitMs / 1000} s`;

/** What Gemini is doing, as a hint. */
function progressText({ why, waitMs }: Progress, model: string): string {
  const s = Math.ceil(waitMs / 1000);
  if (why === 'busy') return `busy; trying again in ${s} s…`;
  if (why === 'quota') return `waiting ${s} s for the quota…`;
  if (why === 'slow') return 'slow; asking Key 2 too…';
  return `sent to ${model}, waiting for the answer…`;
}

/** A meal request and what came of it: the lab's log entry, with the code's side added. */
export interface Entry {
  time: string;
  build: string;
  given: Given[];
  language: string;
  request: ModelRequest;
  response: ModelResponse | null;
  /** The answer as read, with what the reader repaired or found doubtful. */
  read?: { meal: Meal; flags: string[] };
  processed?: Processed;
}

export interface Ask {
  provider: Provider;
  language: string;
  now: Date;
  given: Given[];
  urgency: Urgency;
  hint?: Hint;
}

/** Sends one meal request and processes the answer. */
export async function ask(a: Ask): Promise<Entry> {
  const request = mealRequest({
    prompt: readFileSync(PROMPT_FILE, 'utf8'),
    language: a.language,
    now: a.now,
    inputs: await inputs(a.given, a.language, a.hint),
  });
  const response = await run(request, {
    provider: a.provider,
    urgency: a.urgency,
    files: photoFile, // a photo's id is its path
    check: () => [], // the reader is forgiving: any JSON is read, its repairs flagged
    onProgress: (p) => a.hint?.(progressText(p, request.model)),
  });
  a.hint?.(
    !response
      ? 'not sent'
      : response.error
        ? `failed in ${(response.ms / 1000).toFixed(1)} s`
        : `answered in ${(response.ms / 1000).toFixed(1)} s`,
  );
  return processEntry({
    time: new Date().toISOString(),
    build: build(),
    given: a.given,
    language: a.language,
    request,
    response,
  });
}

/** Reads and processes the entry's answer again, with the code as it is now. */
export function processEntry(entry: Entry): Entry {
  const rest = { ...entry };
  delete rest.read;
  delete rest.processed;
  const answer = entry.response?.answer;
  if (answer === undefined) return rest;
  const read = readMeal(answer);
  return { ...rest, read, processed: processMeal(read.meal, entry.language) };
}

/** What came back, in a line: the model, the time, the tokens, the tries; or `not sent`. */
export function about(entry: Entry): string {
  const r = entry.response;
  if (!r) return 'not sent';
  return [
    r.model,
    `${(r.ms / 1000).toFixed(1)} s`,
    r.tokens &&
      `tokens in ${r.tokens.input} out ${r.tokens.output} thinking ${r.tokens.thinking ?? 0}`,
    r.stop && `stop ${r.stop}`,
    r.attempts && (r.attempts.length > 1 || r.attempts[0]?.key !== 'key') && triesText(r.attempts),
  ]
    .filter(Boolean)
    .join(', ');
}

/** Each try: its key, when it was sent, how long it took, how it ended. */
const triesText = (attempts: Attempt[]): string =>
  'tries ' +
  attempts
    .map((t) =>
      [
        t.key + (t.why ? ` (${t.why})` : ''),
        t.at !== undefined && `at ${(t.at / 1000).toFixed(1)} s`,
        `${(t.ms / 1000).toFixed(1)} s`,
        t.cancelled
          ? 'cancelled'
          : t.error
            ? (t.error.match(/^Gemini \d+/)?.[0] ?? 'failed')
            : 'ok',
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join('; ');

/** Why the entry has no meal, when it has none. */
export const noMeal = (entry: Entry): string | undefined =>
  entry.processed ? undefined : (entry.response?.error ?? 'not sent');

/** The meal as text, with the reader's flags; empty when there is none. */
export const mealText = (entry: Entry): string =>
  entry.processed ? textView(entry.processed, entry.read?.flags) : '';

/** The settings a request is sent with, for --verbose. */
export const settingsText = (language: string, now: Date, urgency: Urgency): string =>
  `model ${SETTINGS.model}, thinking ${SETTINGS.thinking}, ` +
  `temperature ${SETTINGS.temperature ?? 'default'}; ${urgencyText(urgency)}; ` +
  `photos ${SETTINGS.photo.maxSide} px, quality ${SETTINGS.photo.quality}\n` +
  `prompt ${PROMPT_FILE}, language ${language}, time ${now.toTimeString().slice(0, 5)}`;

/** The answer's numbers, in a line, for --verbose. */
export function statsText(e: Entry): string {
  const items = e.processed?.dishes.flatMap((d) => d.items) ?? [];
  const questions = items.flatMap((i) => i.questions);
  return [
    about(e),
    e.processed &&
      `${e.processed.dishes.length} dishes, ${items.length} items, ` +
        `${questions.filter((q) => q.asked).length} of ${questions.length} questions asked, ` +
        `${e.read?.flags.length ?? 0} flags`,
  ]
    .filter(Boolean)
    .join('; ');
}

/** Writes the entry as one JSON file. */
export function writeJson(file: string, entry: Entry): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`);
}

/** The commit, `+` when the working tree has changes. */
function build(): string {
  try {
    const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
    return dirty ? `${head}+` : head;
  } catch {
    return 'unknown';
  }
}

/** Text of an input, short, for logs: `“text”`, `[photo.jpg]`, `#barcode`. */
export function givenText(g: Given): string {
  if ('text' in g) return `“${g.text}”`;
  if ('photo' in g) return `[${g.photo.split('/').at(-1)}]`;
  if ('barcode' in g) return `#${g.barcode}`;
  return `{${g.productFile.split('/').at(-1)}}`;
}
