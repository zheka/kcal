/**
 * The meal composer's bench: runs test meals through Gemini with the real prompt
 * (src/lab/composer/prompt-v4.md), schema (schema.ts), context (request.ts) and reader (meal.ts),
 * and prints each answer in the screen form next to what a good answer would be, for judging by
 * reading. Answers and the whole output (run.log) are kept in test-results/meal-bench/.
 *
 *   GEMINI_API_KEY=… node scripts/meal-bench.ts [--model lite|flash|<id>] [--only p7,t3]
 *     [--photos <dir with food1.jpg …>] [--parallel 4] [--per-minute <n>] [--out <dir>]
 *     [--thinking minimal|low|medium|high] [--thinking-budget <tokens>]
 *
 * Photo cases are skipped without --photos (the photos are personal, not in the repo).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { withRetries } from '../src/data/retry.ts';
import {
  type Meal,
  type Question,
  readMeal,
  type Row,
  rowName,
  screenForm,
} from '../src/lab/composer/meal.ts';
import { CHECKLIST, contextText } from '../src/lab/composer/request.ts';
import { MEAL_SCHEMA } from '../src/lab/composer/schema.ts';
import { CASES, type Case } from './meal-bench-cases.ts';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: 'lite' },
    only: { type: 'string' },
    photos: { type: 'string' },
    parallel: { type: 'string', default: '4' },
    'per-minute': { type: 'string' },
    out: { type: 'string', default: 'test-results/meal-bench' },
    /** minimal (Flash-Lite's own default), low (ours: fast, thinks when it needs to), medium, high. */
    thinking: { type: 'string', default: 'low' },
    /** Thinking as a token budget (the Gemini 2.5 way), for a model that ignores the level. */
    'thinking-budget': { type: 'string' },
  },
});
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Set GEMINI_API_KEY.');
  process.exit(1);
}
const API = 'https://generativelanguage.googleapis.com/v1beta';
const OUT = args.out;
const PROMPT = readFileSync('src/lab/composer/prompt-v4.md', 'utf8');
const LANGUAGE = 'ru';
/** A fixed time, so runs differ only by the model. */
const NOW = new Date('2026-11-22T13:00:00');

// Everything printed is also kept in run.log, to be read after the run.
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/run.log`, '');
const log = (text: string) => {
  console.log(text);
  appendFileSync(`${OUT}/run.log`, `${text}\n`);
};

// Gemini, tried again while busy ------------------------------------------------------------------

const BUSY = [429, 500, 502, 503, 504];
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000];

class Busy extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** A failed try, short: Gemini's status and message, or why it wasn't reached. */
function why(err: unknown): string {
  if (!(err instanceof Busy)) return `not reached (${String(err)})`;
  let message: string;
  try {
    const e = JSON.parse(err.body).error;
    message = [e?.status, e?.message].filter(Boolean).join(': ');
  } catch {
    message = err.body.slice(0, 300);
  }
  return `HTTP ${err.status}${message ? ` ${message}` : ''}`;
}

/**
 * At most PER_MINUTE requests in any 60 s, retries included, across the cases run in parallel:
 * the free tier's quota is per minute and per model, and going over it only earns 429s.
 */
let PER_MINUTE = 2; // until the model is known
/** Under the free tier's quotas: Flash-Lite 15 a minute, Flash 5; others as Flash. */
const perMinute = (model: string) =>
  args['per-minute'] ? Number(args['per-minute']) : model.includes('flash-lite') ? 9 : 2;
const sent: number[] = [];
let turn = Promise.resolve();
function slot(): Promise<void> {
  const mine = turn.then(async () => {
    while (sent.length >= PER_MINUTE) {
      const wait = sent[0]! + 60_000 - Date.now();
      if (wait <= 0) sent.shift();
      else await new Promise((r) => setTimeout(r, wait));
    }
    sent.push(Date.now());
  });
  turn = mine;
  return mine;
}

function call(url: string, init: RequestInit = {}, label = '') {
  return withRetries(
    async () => {
      await slot();
      const sentAt = Date.now();
      const response = await fetch(url, {
        ...init,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key! },
      });
      const body = await response.text();
      if (BUSY.includes(response.status)) throw new Busy(response.status, body);
      return { response, body, ms: Date.now() - sentAt };
    },
    {
      delays: RETRY_DELAYS_MS,
      retriable: (err) => err instanceof Busy || err instanceof TypeError,
      onRetry: (err, attempt, of, delay) =>
        log(`  ${label}${why(err)}; try ${attempt} of ${of} in ${delay / 1000} s…`),
    },
  );
}

// The model -------------------------------------------------------------------------------------

log('Listing the models…');
const listed = await call(`${API}/models?pageSize=1000`);
if (!listed.response.ok) {
  log(`Couldn’t list the models: ${why(new Busy(listed.response.status, listed.body))}`);
  process.exit(1);
}
const models: string[] = (JSON.parse(listed.body).models ?? [])
  .filter((m: Json) => m.supportedGenerationMethods?.includes('generateContent'))
  .map((m: Json) => m.name.replace(/^models\//, ''));

/** The newest of a family (gemini-<version>-<family>): stable, else a preview. */
function newest(family: string): string | undefined {
  const version = (m: string) => m.split('-')[1]!.split('.').map(Number);
  const older = (a: string, b: string) => {
    const [x, y] = [version(a), version(b)];
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    }
    return 0;
  };
  const of = (suffix: string) =>
    models.filter((m) => new RegExp(`^gemini-[\\d.]+-${family}${suffix}$`).test(m)).sort(older);
  return of('').at(-1) ?? of('-preview').at(-1);
}
const model =
  args.model === 'lite'
    ? newest('flash-lite')
    : args.model === 'flash'
      ? newest('flash')
      : args.model;
if (!model || !models.includes(model)) {
  log(`No model ${model ?? args.model}; this key has:\n  ${models.join('\n  ')}`);
  process.exit(1);
}
PER_MINUTE = perMinute(model);
const thinking =
  [args.thinking, args['thinking-budget'] && `budget ${args['thinking-budget']}`]
    .filter(Boolean)
    .join(', ') || 'the model’s default';
log(`model: ${model}, thinking: ${thinking}`);

// The cases -------------------------------------------------------------------------------------

const only = args.only?.split(',');
const cases = CASES.filter((c) => !only || only.includes(c.id)).filter((c) => {
  const photos = c.steps.flatMap((s) => s.photos ?? []);
  if (photos.length === 0) return true;
  if (!args.photos) return false;
  const missing = photos.filter((p) => !existsSync(`${args.photos}/${p}`));
  if (missing.length) log(`${c.id}: skipped, no ${missing.join(', ')}`);
  return missing.length === 0;
});
if (!args.photos) log('Photo cases skipped: no --photos.');
log(`${cases.length} cases, ${args.parallel} at a time, at most ${PER_MINUTE} requests a minute\n`);

interface Stats {
  requests: number;
  input: number;
  output: number;
  thinking: number;
  ms: number;
  problems: number;
  notes: number;
}
const stats: Stats = {
  requests: 0,
  input: 0,
  output: 0,
  thinking: 0,
  ms: 0,
  problems: 0,
  notes: 0,
};

/** Runs a case, step by step, logging each step's report as soon as it has its answer. */
async function run(c: Case): Promise<void> {
  const out = [`=== ${c.id}: ${c.title}`, `expect: ${c.expect}`];
  // a step's lines, logged together so that cases running at once don't mix
  const flush = () => {
    log(`${out.join('\n')}\n`);
    out.length = 0;
  };
  const parts: Json[] = [];
  let meal: Meal | null = null;
  for (const [i, step] of c.steps.entries()) {
    const label = c.steps.length > 1 ? `step ${i + 1}: ` : '';
    if (i > 0) out.push(`=== ${c.id}, step ${i + 1}`);
    // the user's changes to the meal so far: answers chosen
    if (meal && step.choose) {
      for (const { row, question, pick } of step.choose) {
        const q = findQuestion(meal, row, question);
        if (q && q.options.length > 1) {
          q.chosen = (pick === 'last' ? q.options.at(-1)! : q.options[0]!).label;
          out.push(`  (picked "${q.chosen}" for ${row})`);
        } else out.push(`  (no choice in ${question} of "${row}" to pick)`);
      }
    }
    const given = [
      ...(step.texts ?? []).map((t) => `“${t}”`),
      ...(step.photos ?? []).map((p) => `[${p}]`),
      ...(step.choose ?? []).map((x) => `${x.row}: ${x.question} → ${x.pick}`),
    ];
    out.push(`--- ${label}${given.join(' ')}`);
    for (const t of step.texts ?? []) parts.push({ text: t });
    for (const p of step.photos ?? []) {
      const data = readFileSync(`${args.photos}/${p}`).toString('base64');
      parts.push({ inlineData: { mimeType: 'image/jpeg', data } });
    }
    const context = contextText({ language: LANGUAGE, now: NOW, meal });
    let response: Response;
    let body: string;
    let ms: number; // the answering try's, without waiting for a slot or retries
    try {
      ({ response, body, ms } = await call(
        `${API}/models/${model}:generateContent`,
        {
          method: 'POST',
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: context }, ...parts, { text: CHECKLIST }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: MEAL_SCHEMA,
              // no temperature: Gemini 3 reasons worse away from its default
              ...((args.thinking || args['thinking-budget']) && {
                thinkingConfig: {
                  ...(args.thinking && { thinkingLevel: args.thinking }),
                  ...(args['thinking-budget'] && {
                    thinkingBudget: Number(args['thinking-budget']),
                  }),
                },
              }),
            },
          }),
        },
        `${c.id} ${label}`,
      ));
    } catch (err) {
      stats.problems++;
      out.push(`gave up: ${why(err)}`);
      return flush();
    }
    if (!response.ok) {
      stats.problems++;
      out.push(`FAILED: ${why(new Busy(response.status, body))}`);
      return flush();
    }
    const reply = JSON.parse(body);
    const candidate = reply.candidates?.[0];
    const usage = reply.usageMetadata ?? {};
    stats.requests++;
    stats.input += usage.promptTokenCount ?? 0;
    stats.output += usage.candidatesTokenCount ?? 0;
    stats.thinking += usage.thoughtsTokenCount ?? 0;
    stats.ms += ms;
    out.push(
      `${(ms / 1000).toFixed(1)} s, tokens in ${usage.promptTokenCount} out ${usage.candidatesTokenCount}` +
        ` thinking ${usage.thoughtsTokenCount ?? 0}, stop ${candidate?.finishReason}`,
    );
    const text = (candidate?.content?.parts ?? [])
      .filter((p: Json) => !p.thought)
      .map((p: Json) => p.text ?? '')
      .join('');
    writeFileSync(`${OUT}/${c.id}-${i + 1}.json`, text);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      stats.problems++;
      out.push(`NOT JSON: ${text.slice(0, 500)}`);
      return flush();
    }
    const read = readMeal(raw);
    stats.notes += read.notes.length;
    if (read.notes.length) out.push(`notes: ${read.notes.join('; ')}`);
    if (read.problems.length) {
      stats.problems++;
      out.push(`PROBLEMS (the lab would reject it): ${read.problems.join('; ')}`);
      return flush();
    }
    meal = read.meal;
    out.push(screenForm(meal));
    flush();
  }
}

/**
 * A question of a row (or a dish's part) whose name contains `row`; `amount` is whichever of its
 * sizes and counts is a choice (the model may ask a portion either way).
 */
function findQuestion(
  meal: Meal,
  row: string,
  question: string,
): Question<{ label: string }> | null {
  const rows: Row[] = meal.items.flatMap((r) => ('dish' in r ? [r, ...r.dish.items] : [r]));
  const r = rows.find((x) => rowName(x).toLowerCase().includes(row));
  if (!r) return null;
  const body = ('dish' in r ? r.dish : 'sized_food' in r ? r.sized_food : r.food) as Json;
  if (question !== 'amount') return body[question] ?? null;
  return [body.sizes, body.counts].find((q) => q?.options.length > 1) ?? null;
}

// The run ---------------------------------------------------------------------------------------

const queue = [...cases];
const started = Date.now();
await Promise.all(
  Array.from({ length: Number(args.parallel) }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) await run(c);
  }),
);
log(
  `${cases.length} cases, ${stats.requests} answers in ${((Date.now() - started) / 1000).toFixed(0)} s; ` +
    `${stats.problems} failed or rejected, ${stats.notes} notes; tokens in ${stats.input}, ` +
    `out ${stats.output}, thinking ${stats.thinking}; ` +
    `${stats.requests ? (stats.ms / stats.requests / 1000).toFixed(1) : '–'} s per answer. ` +
    `Answers and run.log in ${OUT}/`,
);
