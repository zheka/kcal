/**
 * One meal through the model, locally (see scripts/meal-tool.ts): prints the text view and
 * writes entry.json and view.txt.
 *
 *   GEMINI_API_KEY=… node scripts/meal.ts [options] <input>…
 *     an input is a photo file, a product JSON file (Open Food Facts data), a barcode, or a text;
 *     sent in the order given
 *     --language ru   --time 13:00   --out <dir>   (test-results/meal/<time>)
 *     --verbose   brief hints on stderr on what it's waiting for
 *
 *   node scripts/meal.ts --replay <dir or entry.json>
 *     reads and processes the stored answer again with the code as it is now (no model call),
 *     and rewrites entry.json and view.txt
 */
import { statSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  ask,
  geminiSend,
  limited,
  given,
  processEntry,
  readEntry,
  view,
  writeEntry,
} from './meal-tool.ts';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    language: { type: 'string', default: 'ru' },
    time: { type: 'string' },
    out: { type: 'string' },
    replay: { type: 'string' },
    verbose: { type: 'boolean', default: false },
  },
});

if (args.replay) {
  const dir = statSync(args.replay).isDirectory()
    ? args.replay
    : args.replay.replace(/\/[^/]*$/, '');
  const entry = processEntry(readEntry(`${dir}/entry.json`));
  writeEntry(dir, entry);
  console.log(view(entry));
  process.exit(0);
}

if (positionals.length === 0) {
  console.error(
    'Give the meal: photos, texts, barcodes, product JSON files. See the top of this file.',
  );
  process.exit(1);
}
const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('Set GEMINI_API_KEY.');
  process.exit(1);
}

const now = new Date();
if (args.time) {
  const [h, m] = args.time.split(':').map(Number);
  now.setHours(h!, m ?? 0, 0, 0);
}
const entry = await ask({
  send: limited(geminiSend(key)),
  language: args.language,
  now,
  given: positionals.map(given),
  ...(args.verbose && { hint: (text: string) => console.error(text) }),
});
const dir = args.out ?? `test-results/meal/${entry.time.replace(/[:.]/g, '-')}`;
writeEntry(dir, entry);
console.log(view(entry));
console.log(`\n${dir}/`);
