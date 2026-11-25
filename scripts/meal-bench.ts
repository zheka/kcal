/**
 * The meal composer's bench: runs tests (see readTest in scripts/meal-tool.ts) through the local
 * tool's code, one after another, and reports which failed. A test passes when a meal comes back;
 * expectations come later.
 *
 *   GEMINI_API_KEY=… [GEMINI_API_KEY_2=…] node scripts/meal-bench.ts [--verbose] [--repeat=N] [--out=<dir>] <test>…
 *     <test>     a test file, or a folder of them (its *.json, not its subfolders)
 *     --repeat   each test N times (<test>-1, <test>-2, …), to tell a rule from chance
 *     --out      writes each test's everything (as scripts/meal.ts --out) to <dir>/<test>.json;
 *                nothing is written without it
 *     --verbose  each test's meal as text on stdout; on stderr the settings, brief notes as it
 *                goes, and each test's stats
 *
 * On stdout: each failed test and why, and a summary. Exit code 1 when any test failed.
 */
import { readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  ask,
  envGemini,
  type Entry,
  givenText,
  mealText,
  noMeal,
  readTest,
  settingsText,
  statsText,
  writeJson,
} from './meal-tool.ts';

const LANGUAGE = 'ru';
/** A fixed time, so runs differ only by the model. */
const NOW = new Date('2026-11-22T13:00:00');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    verbose: { type: 'boolean', default: false },
    repeat: { type: 'string', default: '1' },
    out: { type: 'string' },
  },
});
const note = args.verbose ? (text: string) => console.error(text) : undefined;

const files = positionals.flatMap((p) =>
  statSync(p).isDirectory()
    ? readdirSync(p, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith('.json'))
        .map((d) => join(p, d.name))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    : [p],
);
if (files.length === 0) {
  console.error('Give tests: test files, or folders of them.');
  process.exit(1);
}
const idOf = (file: string) => basename(file, '.json');
const ids = files.map(idOf);
const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
if (twice.length) {
  console.error(`Tests of the same name: ${[...new Set(twice)].join(', ')}.`);
  process.exit(1);
}
const gemini = envGemini();
if (!gemini) {
  console.error('Set GEMINI_API_KEY (Key, cheap), GEMINI_API_KEY_2 (Key 2, reliable), or both.');
  process.exit(1);
}

const repeat = Number(args.repeat);
const runs = files.flatMap((file) =>
  repeat > 1
    ? Array.from({ length: repeat }, (_, i) => ({ file, id: `${idOf(file)}-${i + 1}` }))
    : [{ file, id: idOf(file) }],
);

note?.(settingsText(LANGUAGE, NOW));
note?.(`${files.length} tests${repeat > 1 ? ` × ${repeat}` : ''}, one at a time\n`);

const failed: string[] = [];
const total = { flags: 0, asked: 0, input: 0, output: 0, thinking: 0 };
const started = Date.now();

for (const { file, id } of runs) {
  let entry: Entry;
  try {
    const test = readTest(file);
    note?.(`=== ${id}${test.description ? `: ${test.description}` : ''}`);
    note?.(`inputs ${test.given.map(givenText).join(' ')}`);
    entry = await ask({
      provider: gemini,
      language: LANGUAGE,
      now: NOW,
      given: test.given,
      ...(note && { hint: note }),
    });
  } catch (err) {
    fail(id, err instanceof Error ? err.message : String(err));
    continue;
  }
  if (args.out) writeJson(join(args.out, `${id}.json`), entry);
  count(entry);
  note?.(statsText(entry));
  const why = noMeal(entry);
  if (why) fail(id, why);
  else if (args.verbose) console.log(`=== ${id}\n${mealText(entry)}\n`);
}

const s = (Date.now() - started) / 1000;
console.log(
  `${runs.length} runs: ${runs.length - failed.length} passed, ${failed.length} failed` +
    (failed.length ? ` (${failed.join(', ')})` : '') +
    `; ${total.flags} flags, ${total.asked} questions asked; tokens in ${total.input}, ` +
    `out ${total.output}, thinking ${total.thinking}; ${s.toFixed(0)} s` +
    (args.out ? `; in ${args.out}` : ''),
);
process.exit(failed.length ? 1 : 0);

function fail(id: string, why: string) {
  failed.push(id);
  console.log(`=== ${id}: FAILED: ${why}${args.verbose ? '\n' : ''}`);
}

function count(e: Entry) {
  const r = e.response;
  total.flags += e.read?.flags.length ?? 0;
  total.asked +=
    e.processed?.dishes.flatMap((d) => d.items.flatMap((i) => i.questions)).filter((q) => q.asked)
      .length ?? 0;
  total.input += r?.tokens?.input ?? 0;
  total.output += r?.tokens?.output ?? 0;
  total.thinking += r?.tokens?.thinking ?? 0;
}
