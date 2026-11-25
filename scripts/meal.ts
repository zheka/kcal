/**
 * One meal through the model, locally (the lab's own code, see scripts/meal-tool.ts): prints the
 * meal as text, and nothing else.
 *
 *   GEMINI_API_KEY=… [GEMINI_API_KEY_2=…] node scripts/meal.ts [--verbose] [--test=<file>] [--out=<file>] [<input>…]
 *     <input>    a photo file, a product JSON file (Open Food Facts data), a barcode, else a text;
 *                sent in the order given, after the test's
 *     --test     a test file (see readTest in meal-tool.ts): its inputs first
 *     --out      writes everything (inputs, request, answer, what the code made of it) to this
 *                JSON file; nothing is written without it
 *     --verbose  on stderr: the settings, brief notes as it goes, the stats at the end
 *
 * No meal (the model failed or answered nothing usable): why on stderr, exit code 1.
 */
import { parseArgs } from 'node:util';
import {
  ask,
  envGemini,
  given,
  type Given,
  givenText,
  mealText,
  noMeal,
  readTest,
  settingsText,
  statsText,
  writeJson,
} from './meal-tool.ts';

const LANGUAGE = 'ru';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    verbose: { type: 'boolean', default: false },
    test: { type: 'string' },
    out: { type: 'string' },
  },
});
const note = args.verbose ? (text: string) => console.error(text) : undefined;

const test = args.test ? readTest(args.test) : undefined;
const inputs: Given[] = [...(test?.given ?? []), ...positionals.map(given)];
if (inputs.length === 0) {
  console.error('Give the meal: photos, texts, barcodes, product JSON files, or --test=<file>.');
  process.exit(1);
}
const gemini = envGemini();
if (!gemini) {
  console.error('Set GEMINI_API_KEY (Key, cheap), GEMINI_API_KEY_2 (Key 2, reliable), or both.');
  process.exit(1);
}

const now = new Date();
if (note) {
  note(settingsText(LANGUAGE, now));
  if (args.test) note(`test ${args.test}${test?.description ? `: ${test.description}` : ''}`);
  note(`inputs ${inputs.map(givenText).join(' ')}`);
}

const entry = await ask({
  provider: gemini,
  language: LANGUAGE,
  now,
  given: inputs,
  ...(note && { hint: note }),
});

if (args.out) writeJson(args.out, entry);
note?.(`${statsText(entry)}${args.out ? `; written to ${args.out}` : ''}`);

const why = noMeal(entry);
if (why) {
  console.error(`No meal: ${why}`);
  process.exit(1);
}
console.log(mealText(entry));
