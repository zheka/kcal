/**
 * The lab's meals as tests (see readTest in scripts/meal-tool.ts), from its Download data (unzipped:
 * `log.json` and `files/`, see docs/lab.md, Logs): for each meal, its last update that brought an
 * answer (else its last update), as the request sent it.
 *
 *   node scripts/lab-meal-test.ts --out=<dir> <download> [<meal id>…]
 *     <download>  the unzipped download
 *     <meal id>   these meals only; all by default
 *     --out       writes <dir>/<meal id>.json, and its photos and products to <dir>/data/
 *
 * A test's inputs are the request's parts between its context and its checklist: a file is a
 * photo (copied as it is, by its id), a text that is a JSON object a scanned product (written to
 * data/<meal id>-<n>.json), any other text a text. Its time and language are what the request's
 * context told the model. The update itself (its time, build, the answer or the error) is kept
 * in the test's `lab-composer` section, which the tool ignores.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' } },
});
const [download, ...only] = positionals;
if (!download || !args.out) {
  console.error('Usage: node scripts/lab-meal-test.ts --out=<dir> <download> [<meal id>…]');
  process.exit(1);
}
const out = args.out;

/** A log entry, as far as this reads it (before 2026-11-25 a photo part was `image`). */
interface Entry {
  time: string;
  build: string;
  meal?: string;
  request?: { content?: ({ text: string } | { file: string } | { image: string })[] };
  response?: { answer?: unknown; error?: string };
}

const log = JSON.parse(readFileSync(join(download, 'log.json'), 'utf8')) as Entry[];
const files = existsSync(join(download, 'files')) ? readdirSync(join(download, 'files')) : [];

const byMeal = new Map<string, Entry[]>();
for (const e of log) {
  if (!e.meal || !e.request?.content) continue;
  byMeal.set(e.meal, [...(byMeal.get(e.meal) ?? []), e]);
}
const meals = only.length > 0 ? only : [...byMeal.keys()];

mkdirSync(join(out, 'data'), { recursive: true });
let failed = false;
for (const meal of meals) {
  const entries = byMeal.get(meal);
  if (!entries) {
    console.error(`${meal}: not in the log`);
    failed = true;
    continue;
  }
  const answered = entries.filter((e) => e.response?.answer !== undefined && !e.response.error);
  const entry = answered.at(-1) ?? entries.at(-1)!;
  try {
    const test = testOf(meal, entry);
    writeFileSync(join(out, `${meal}.json`), `${JSON.stringify(test, null, 2)}\n`);
    console.log(
      `${meal}: ${test.inputs.length} inputs, sent ${entry.time}, ` +
        (entry.response?.error ? `failed: ${entry.response.error}` : `“${test.description}”`),
    );
  } catch (err) {
    console.error(`${meal}: ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);

function testOf(meal: string, entry: Entry) {
  const parts = [...entry.request!.content!];
  const first = parts[0];
  const context =
    first && 'text' in first && /^answer language:/.test(first.text) ? first.text : '';
  if (context) parts.shift();
  const last = parts.at(-1);
  if (last && 'text' in last && last.text.startsWith('Before answering')) parts.pop();

  let products = 0;
  const inputs = parts.map((p) => {
    if ('text' in p) {
      const product = jsonObject(p.text);
      if (!product) return { text: p.text };
      const path = `data/${meal}-${++products}.json`;
      writeFileSync(join(out, path), `${JSON.stringify(product, null, 2)}\n`);
      return { product: path };
    }
    const id = 'file' in p ? p.file : p.image;
    const name = files.find((f) => f.startsWith(`${id}.`));
    if (!name) throw new Error(`no photo ${id} in the download`);
    copyFileSync(join(download!, 'files', name), join(out, 'data', name));
    return { photo: `data/${name}` };
  });

  const answer = entry.response?.answer as { title?: unknown } | undefined;
  return {
    description: typeof answer?.title === 'string' ? answer.title : '',
    ...match(context, /^time: (\d{2}:\d{2})$/m, 'time'),
    ...match(context, /^answer language: (\S+)$/m, 'language'),
    inputs,
    'lab-composer': {
      meal,
      time: entry.time,
      build: entry.build,
      ...(entry.response?.answer !== undefined && { answer: entry.response.answer }),
      ...(entry.response?.error && { error: entry.response.error }),
    },
  };
}

function jsonObject(text: string): object | null {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function match(text: string, re: RegExp, key: string): Record<string, string> {
  const m = re.exec(text);
  return m ? { [key]: m[1]! } : {};
}
