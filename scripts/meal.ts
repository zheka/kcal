/**
 * One meal through the model, locally (the lab's own code, see scripts/meal-tool.ts): prints the
 * meal as text, and nothing else.
 *
 *   GEMINI_API_KEY=… [GEMINI_API_KEY_2=…] node scripts/meal.ts [--verbose] [--target=<s>] [--limit=<s>] [--test=<file>] [--out=<file>] [<input>…]
 *     <input>    a photo file, a product JSON file (Open Food Facts data), a barcode, else a text;
 *                sent in the order given, after the test's
 *     --test     a test file (see readTest in meal-tool.ts): its inputs first; its time and
 *                language, if it has them, instead of now and ru
 *     --out      writes everything (inputs, request, answer, what the code made of it) to this
 *                JSON file; nothing is written without it
 *     --target   the answer wanted within this many seconds (60), Key 2 spent if need be; `inf`:
 *                Key only (MEAL_URGENCY in meal-tool.ts)
 *     --limit    given up after this many seconds (90)
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
  MEAL_URGENCY,
  settingsText,
  urgencyArgs,
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
    target: { type: 'string' },
    limit: { type: 'string' },
  },
});
const urgency = urgencyArgs(args, MEAL_URGENCY);
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

const now = test?.time?.(new Date()) ?? new Date();
const language = test?.language ?? LANGUAGE;
if (note) {
  note(settingsText(language, now, urgency));
  if (args.test) note(`test ${args.test}${test?.description ? `: ${test.description}` : ''}`);
  note(`inputs ${inputs.map(givenText).join(' ')}`);
}

const entry = await ask({
  provider: gemini,
  language,
  now,
  given: inputs,
  urgency,
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
