/**
 * The meal composer's request, run locally: inputs (photos, texts, barcodes, product JSON) in,
 * the model's answer and what the code makes of it out, as one entry (the lab's log entry, with
 * the code's side added). The lab's own code does the work (src/lab/meal, src/lab/ai); this file
 * only does what the browser would: shrink photos (sharp), look up barcodes, keep to the quota.
 * Used by scripts/meal.ts (one meal) and scripts/meal-bench.ts (tests).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { lookUpBarcode } from '../src/data/openFoodFacts.ts';
import { gemini } from '../src/lab/ai/gemini.ts';
import { type ModelRequest, type ModelResponse, type Reply, run } from '../src/lab/ai/model.ts';
import { type Processed, process as processMeal } from '../src/lab/meal/process.ts';
import { type Meal, readMeal } from '../src/lab/meal/read.ts';
import { type Input, mealRequest } from '../src/lab/meal/request.ts';
import { SETTINGS } from '../src/lab/meal/settings.ts';
import { textView } from '../src/lab/meal/view.ts';

// The lab's code checks navigator.onLine before a request; Node has no such thing.
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });

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
 * A test (a JSON file, kept out of the repo): what is hard about it, and the inputs in order.
 * Texts and barcodes are inline; files (photos, product JSON, text files) are paths relative to
 * the test file, or absolute.
 *
 *   { "description": "…", "inputs": [{ "photo": "data/meatballs.jpg" }, { "text": "…" }] }
 */
export interface Test {
  description?: string;
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
  return { ...(json.description && { description: json.description }), given };
}

/** A brief note on what's going on, so a long wait has a reason (--verbose). */
export type Hint = (text: string) => void;

/** Sends a request, with hints on the way. */
export type Send = (r: ModelRequest, hint?: Hint) => Promise<Reply>;

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

const shrunk = new Map<string, Promise<{ type: string; base64: string }>>();

/** A photo as the lab sends it (SETTINGS.photo): upright, shrunk, JPEG. */
export function photoData(path: string): Promise<{ type: string; base64: string }> {
  let p = shrunk.get(path);
  if (!p) {
    p = sharp(path)
      .rotate()
      .resize(SETTINGS.photo.maxSide, SETTINGS.photo.maxSide, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: SETTINGS.photo.quality })
      .toBuffer()
      .then((b) => ({ type: 'image/jpeg', base64: b.toString('base64') }));
    shrunk.set(path, p);
  }
  return p;
}

/**
 * At most SETTINGS.perMinute sends in any 60 s, retries included, across all sent through it;
 * hints when it waits, and as it sends.
 */
export function limited(send: (r: ModelRequest) => Promise<Reply>): Send {
  const n = SETTINGS.perMinute;
  const sent: number[] = [];
  let turn = Promise.resolve();
  const slot = (hint?: Hint) => {
    const mine = turn.then(async () => {
      while (sent.length >= n) {
        const wait = sent[0]! + 60_000 - Date.now();
        if (wait <= 0) sent.shift();
        else {
          hint?.(`waiting ${Math.ceil(wait / 1000)} s for the quota (${n} a minute)…`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
      sent.push(Date.now());
    });
    turn = mine;
    return mine;
  };
  return async (r, hint) => {
    await slot(hint);
    hint?.(`sent to ${r.model}, waiting for the answer…`);
    return send(r);
  };
}

/** Longer than the lab's waits: a bench run shouldn't lose a case to a busy minute. */
export const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

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
  send: Send;
  language: string;
  now: Date;
  given: Given[];
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
    send: (r) => a.send(r, a.hint),
    check: () => [], // the reader is forgiving: any JSON is read, its repairs flagged
    delays: RETRY_DELAYS_MS,
    onRetry: (attempt, of, ms) => a.hint?.(`busy; try ${attempt} of ${of} in ${ms / 1000} s…`),
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

/** What came back, in a line: the model, the time, the tokens, the retries; or `not sent`. */
export function about(entry: Entry): string {
  const r = entry.response;
  if (!r) return 'not sent';
  return [
    r.model,
    `${(r.ms / 1000).toFixed(1)} s`,
    r.tokens &&
      `tokens in ${r.tokens.input} out ${r.tokens.output} thinking ${r.tokens.thinking ?? 0}`,
    r.stop && `stop ${r.stop}`,
    r.retried && `${r.retried.length} retried`,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Why the entry has no meal, when it has none. */
export const noMeal = (entry: Entry): string | undefined =>
  entry.processed ? undefined : (entry.response?.error ?? 'not sent');

/** The meal as text, with the reader's flags; empty when there is none. */
export const mealText = (entry: Entry): string =>
  entry.processed ? textView(entry.processed, entry.read?.flags) : '';

/** The settings a request is sent with, for --verbose. */
export const settingsText = (language: string, now: Date): string =>
  `model ${SETTINGS.model}, thinking ${SETTINGS.thinking}, ` +
  `temperature ${SETTINGS.temperature ?? 'default'}; ${SETTINGS.perMinute} requests a minute; ` +
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

/** The Gemini sender, photos shrunk as the lab does. */
export const geminiSend = (key: string) => gemini(key, photoData);
