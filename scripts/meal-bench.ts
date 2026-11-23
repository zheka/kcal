/**
 * The meal composer's bench: runs the test meals (scripts/meal-bench-cases.ts) through the local
 * tool (scripts/meal-tool.ts: the lab's prompt, schema, reader and processing) and prints each
 * answer's text view next to what a good answer would be, for judging by reading. Each case's
 * entry.json and view.txt go to <out>/<case>/, the whole output to <out>/run.log (replay.log on a replay).
 *
 *   GEMINI_API_KEY=… node scripts/meal-bench.ts --photos <dir with food1.jpg …>
 *     [--only p7,t3] [--repeat 2] [--parallel 4] [--out <dir>] [--verbose]
 *
 * The model and its settings are src/lab/meal/settings.ts. --verbose: brief hints on stderr on
 * what each case is waiting for; run.log has the results only.
 *
 *   node scripts/meal-bench.ts --replay <a run's dir>
 *     reprocesses every answer of that run with the code as it is now: no model calls
 *
 * Photo cases are skipped without --photos (the photos are personal, not in the repo).
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { SETTINGS } from '../src/lab/meal/settings.ts';
import { CASES, type Case } from './meal-bench-cases.ts';
import {
  ask,
  type Entry,
  geminiSend,
  type Given,
  givenText,
  limited,
  processEntry,
  readEntry,
  view,
  writeEntry,
} from './meal-tool.ts';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    photos: { type: 'string' },
    parallel: { type: 'string', default: '4' },
    out: { type: 'string', default: 'test-results/meal-bench' },
    /** Each case this many times (as p7#1, p7#2), to tell a rule from chance. */
    repeat: { type: 'string', default: '1' },
    replay: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
});
const LANGUAGE = 'ru';
/** A fixed time, so runs differ only by the model. */
const NOW = new Date('2026-11-22T13:00:00');

const OUT = args.replay ?? args.out;
mkdirSync(OUT, { recursive: true });
const LOG = `${OUT}/${args.replay ? 'replay' : 'run'}.log`;
writeFileSync(LOG, '');
const log = (text: string) => {
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
};

const caseOf = (id: string) => CASES.find((c) => c.id === id.replace(/#\d+$/, ''));

function report(id: string, entry: Entry): string {
  const c = caseOf(id);
  return [
    `=== ${id}: ${c?.title ?? '?'}`,
    `expect: ${c?.expect ?? '?'}`,
    `--- ${entry.given.map(givenText).join(' ')}`,
    view(entry),
  ].join('\n');
}

interface Stats {
  answers: number;
  failed: number;
  flags: number;
  asked: number;
  input: number;
  output: number;
  thinking: number;
  ms: number;
}
const stats: Stats = {
  answers: 0,
  failed: 0,
  flags: 0,
  asked: 0,
  input: 0,
  output: 0,
  thinking: 0,
  ms: 0,
};
function count(entry: Entry) {
  const r = entry.response;
  if (!entry.processed) stats.failed++;
  else stats.answers++;
  stats.flags += entry.read?.flags.length ?? 0;
  stats.asked +=
    entry.processed?.dishes
      .flatMap((d) => d.items.flatMap((i) => i.questions))
      .filter((q) => q.asked).length ?? 0;
  stats.input += r?.tokens?.input ?? 0;
  stats.output += r?.tokens?.output ?? 0;
  stats.thinking += r?.tokens?.thinking ?? 0;
  stats.ms += r?.ms ?? 0;
}
const summary = (cases: number, extra = '') =>
  `${cases} cases: ${stats.answers} meals, ${stats.failed} failed, ${stats.flags} flags, ` +
  `${stats.asked} questions asked; tokens in ${stats.input}, out ${stats.output}, ` +
  `thinking ${stats.thinking}; ` +
  `${stats.answers ? (stats.ms / (stats.answers + stats.failed) / 1000).toFixed(1) : '–'} s per answer${extra}. ` +
  `In ${OUT}/`;

// Replay: the run's answers, processed again -----------------------------------------------------

if (args.replay) {
  const ids = readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${OUT}/${d.name}/entry.json`))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  for (const id of ids) {
    const entry = processEntry(readEntry(`${OUT}/${id}/entry.json`));
    writeEntry(`${OUT}/${id}`, entry);
    count(entry);
    log(`${report(id, entry)}\n`);
  }
  log(summary(ids.length, ', replayed'));
  process.exit(0);
}

// A run ------------------------------------------------------------------------------------------

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Set GEMINI_API_KEY.');
  process.exit(1);
}
const send = limited(geminiSend(key));
log(`model: ${SETTINGS.model}, thinking: ${SETTINGS.thinking}`);

const only = args.only?.split(',');
const cases = CASES.filter((c) => !only || only.includes(c.id)).filter((c) => {
  const photos = c.inputs.flatMap((i) => ('photo' in i ? [i.photo] : []));
  if (photos.length === 0) return true;
  if (!args.photos) return false;
  const missing = photos.filter((p) => !existsSync(`${args.photos}/${p}`));
  if (missing.length) log(`${c.id}: skipped, no ${missing.join(', ')}`);
  return missing.length === 0;
});
if (!args.photos) log('Photo cases skipped: no --photos.');
log(
  `${cases.length} cases, ${args.parallel} at a time, at most ${SETTINGS.perMinute} requests a minute\n`,
);

const given = (c: Case): Given[] =>
  c.inputs.map((i) => ('photo' in i ? { photo: `${args.photos}/${i.photo}` } : i));

const repeat = Number(args.repeat);
const queue = cases.flatMap((c) =>
  repeat > 1
    ? Array.from({ length: repeat }, (_, i) => ({ c, id: `${c.id}#${i + 1}` }))
    : [{ c, id: c.id }],
);
const started = Date.now();
await Promise.all(
  Array.from({ length: Number(args.parallel) }, async () => {
    for (let q = queue.shift(); q; q = queue.shift()) {
      const { c, id } = q;
      let entry: Entry;
      try {
        entry = await ask({
          send,
          language: LANGUAGE,
          now: NOW,
          given: given(c),
          ...(args.verbose && { hint: (text: string) => console.error(`  ${id}: ${text}`) }),
        });
      } catch (err) {
        stats.failed++;
        log(`=== ${id}: FAILED before sending: ${String(err)}\n`);
        continue;
      }
      writeEntry(`${OUT}/${id}`, entry);
      count(entry);
      log(`${report(id, entry)}\n`);
    }
  }),
);
log(summary(cases.length, `, ${((Date.now() - started) / 1000).toFixed(0)} s in all`));
