# The lab: what the model is told

How the meal composer asks the model for a meal in the format of
[lab-meal-format.md](lab-meal-format.md): the model and its settings, what a request holds, the
rules of prompt v5 and why each is there, and the local tool and the bench that test them. The
rules come from 1,000 example meals ([lab-meal-examples.md](lab-meal-examples.md), #N) and seven
bench runs of prompt v4 on my own photos (v1–v7, 2026-11-23).

Status (2026-11-23): **prompt v5 written, not yet run on the bench, not used by the lab's
screen.** `src/lab/meal/prompt.md` (the system instruction), `settings.ts` (the model and its
settings), `request.ts` (the context and the checklist), `schema.ts` (the schema's descriptions);
`scripts/meal.ts` (the tool), `scripts/meal-bench.ts` (the bench). Prompt v4 (the model wrote the
questions) is in git history up to commit 381aee4.

## The model and its settings

All in `src/lab/meal/settings.ts`, for the lab and the tool alike, changed there and not per run
(nor in the lab's menu once the screen uses it), so runs and answers are comparable; every log
entry records them with the request.

- **Gemini Flash-Lite, a fixed id** (`gemini-3.5-flash-lite`). Why: the cheapest and fastest
  modern model with the most generous free quota (15 requests and 250k tokens a minute, 500 a
  day; Flash allows 5 a minute and far fewer a day); about 3–5 s per answer. Flash was set aside:
  slower, a low daily quota, and its quality on rules wasn't the problem to solve. A fixed id,
  not "the newest": a run is reproducible, and a new model is a decision.
- **Thinking `low`.** Why: Flash-Lite's own default is `minimal` (near off). At `low` it thinks
  only when it judges a request hard (3 of 22 in one v4 run, 1 of 44 in another), at almost no
  cost in time; at `medium` it thought on every request and followed v4's rules more
  consistently, but at 7.3 s per answer against 3.7 s. With the judging moved to code, fewer
  rules depend on thinking.
- **No temperature.** Why: Google's guide says Gemini 3 models reason worse away from their
  default; prompt v3 sent 0.2.
- **9 requests a minute**, retries included: under the free tier's 15.
- **Photos at most 1024 px on the longer side, JPEG 85**, shrunk the same by the lab
  (`src/lab/ai/image.ts`) and the tool (sharp). Why: enough to tell foods and portions apart,
  small enough to send quickly; the same, so the tool sees what the phone sends.
- **The answer as JSON in the schema** (`responseJsonSchema`, see the format doc).

## What a request holds

1. **The system instruction: `prompt.md`**, the constant part, in XML sections: `<role>`,
   `<format>`, `<rules>`, `<examples>`. Why: Google's guide puts standing rules in the system
   instruction and asks for one consistent kind of delimiter.
2. **The context** (`contextText`): the answer language and the time. **No meal so far:** every
   request perceives the whole input afresh (see the format doc).
3. **The input**, each a part of its own, in the order given: texts, photos, scanned products
   (Open Food Facts' data as JSON).
4. **The checklist** (`CHECKLIST`), last: the rules broken most, restated. Why: the guide says
   instructions after a large input are heeded best.
5. **The schema's descriptions**: the same rules again, on the fields they govern (a dish's
   name; `count` only for pieces; `unit_amount` one piece when counted; alternatives for real
   doubt only, different foods, one change each). Why: without thinking, Flash-Lite writes the
   JSON field by field; the description is in front of it as it writes the field. In v4 this
   fixed stated facts in updates and invented kinds where the prompt and checklist hadn't.

## The rules, and why

Prompt v5 is about perceiving only. The `<role>` says so: the app adds up, decides which
alternatives matter and asks; the model never judges whether a doubt is worth asking.

**The format section:**

- **Dishes are named foods**, as a menu or a food diary names them, the same each time, without
  containers, the meal, amounts or doubts; a food of its own is a dish of its own. Why: the
  names are for matching against history (see the format doc).
- **The amount, as a table**: pieces counted (`count` × one piece), menu sizes (`amount_alias`),
  loose food and stated weights as one `unit_amount` with `count` null. Never a weight in two
  places. Why: a table of plain cases worked in v4 where prose was mixed up (eggs weighed, "3
  г"); the 72,000 kcal omelette was a weight written twice.
- **Alternatives are complete products, one change each** (what it is, how big, or how many);
  an add-on that may not be there has an alternative of 0. Why: one change each is what lets the
  code split them into independent questions.

**The rules** (the numbers are the prompt's):

1. **Always a complete best guess**; vague input gets a typical meal with no alternatives
   invented. Why: a gap can't be shown; "business lunch" with invented options is noise I can't
   answer better than the model. Broken in v4 without thinking (v7: 0 of 2).
2. **Only the meal in focus**; several plates in focus are all included. Why: other people's cups
   and plates were the commonest wrong rows; I remove a whole plate with one sentence.
3. **Table condiments are ignored** unless I say I used them. Why: "0 oil" rows for the bottle on
   the table would be clutter I'd mostly ignore; I say "полил маслом".
4. **All of it, by me alone.** Why: see the format's principles.
5. **Each kind of piece is its own product**, a set's kinds are dishes of their own; garnish
   dropped. Why: in v4 a sushi tray became one row after a "lump small things" rule (v4b); a row
   per kind in every run since.
6. **A food I think of as one thing is one product** (a sandwich, a Caesar, a ramen), split only
   when I list its parts or a part is in doubt; home cooking whose pieces I know is its parts, so
   they're counted. Why: a dish kept whole has the model's best values (#371: pho split for an
   immaterial question); a question needs its own product.
7. **Stated is certain**: no alternatives for a stated kind, amount or size; a stated total
   weight is one product, never split. Why: in v4 the model asked about oat milk after "на
   овсяном" until an example showed it, and split "гречка с котлетой, 350 г" into rows, once
   losing the buckwheat (v6, v7).
8. **Alternatives for real doubt only**, about what the photo can't tell; never for what it
   shows clearly; **different foods, not variants** of the first guess, up to 4. Why: questions
   on plainly visible counts were noise (v6); v4's alternatives were variants of a wrong guess
   (beef / horse for tuna), so the right answer wasn't a chip.
9. **Amounts are what is eaten** (no bones, shells, peel, ice); cooking fat is part of the food.
10. **One `basis_unit` per product and its alternatives**, g when they'd differ (#40, #502). Why:
    the code compares their values.
11. **Names in full** (an alternative's too), units and aliases short, all in the answer
    language. Why: a chip's label is computed from the names' difference.

**What v4's rules became:** the threshold (80+ kcal or 10+ g protein), "at most 3 questions",
labels in words, the order of options, independent questions and "none" as an answer are now
the code's (format doc, Processing); "updating a meal" is gone with the meal so far; size
wrappers and `г` only of 1 are gone with the shapes.

## Examples

Short examples in a short form (`## dish`, `- product — amount`, alternatives under it with
`|`), then one dish in full JSON. Why: Google recommends always including examples; Flash-Lite
follows examples more than rules (in v4 a stated-milk rule failed in every run until an example
showed it).

**The examples are other foods than the bench's** (shashlik with rice, vareniki, a cappuccino on
almond milk with a muffin, boiled eggs and toasts with butter, cottage cheese). Why: Flash-Lite
copies examples: in v4 a meatball example gave the bench's meatballs the example's words and
sizes, and a cutlet example turned meatballs into "котлеты".

## The tool

`scripts/meal.ts` sends one meal from the command line with the lab's own code (the prompt,
schema, request, reader and processing; Gemini through `src/lab/ai/gemini.ts`), and does only
what the browser would: shrinks photos, looks up barcodes, keeps to the quota.

```
GEMINI_API_KEY=… node scripts/meal.ts [--language ru] [--time 13:00] [--out <dir>] [--verbose] <input>…
node scripts/meal.ts --replay <dir>
```

- **Inputs**, sent in the order given: a photo file, a product JSON file (Open Food Facts data),
  a barcode (looked up), else a text.
- **Output:** the text view on stdout; `entry.json` (the log entry, see the format doc) and
  `view.txt` in `test-results/meal/<time>/` (or `--out`). Everything analysable is in the files.
- **`--verbose`:** brief hints on stderr on what it's waiting for (a lookup, the quota, the
  answer, a busy retry). Why: a request may wait minutes on a busy Gemini; the hints say why,
  and nothing else is printed.
- **`--replay`** reads and processes the stored answer again with the code as it is now, with no
  model call. Why: most changes to the code's side (the reader, the threshold, splitting
  alternatives, labels) can be tried on stored answers in milliseconds, at no quota.
- **Busy Gemini** (429, 5xx) is tried again after 5, 15, 30, 60, 120 s; each try times out after
  120 s.

## The bench

`scripts/meal-bench.ts` runs the test meals (`scripts/meal-bench-cases.ts`) through the tool's
code and writes each answer's text view next to what a good answer would be, for judging by
reading.

```
GEMINI_API_KEY=… node scripts/meal-bench.ts --photos <dir with food1.jpg …> \
  [--only p7,t3] [--repeat 2] [--parallel 4] [--out <dir>] [--verbose]
node scripts/meal-bench.ts --replay <a run's dir>
```

- **Cases:** 9 of my photos (not in the repo: `--photos`) with what I know about them, and texts;
  a correction is more input in the same case (p2t "я ел только кальмара", p7t "тефтели
  куриные", t6t "съел 20 штук, сметану не ел", t8 "круассан был миндальный"). Why: no meal is
  sent back, so there are no steps; v4's cases with picks (p7u, t8) lost them.
- **Output** in `test-results/meal-bench/` (or `--out`): `<case>/entry.json` and `view.txt` per
  case (`p7#2` with `--repeat`), `run.log` with every view and its expectation and a summary
  (meals, failures, flags, questions asked, tokens, time). `--replay` reprocesses a whole run
  and writes `replay.log`.
- **Quotas:** the settings' 9 requests a minute, across the cases run in parallel. A run is about
  22 requests (44 with `--repeat 2`).

### Results

Prompt v5 has no runs yet. Prompt v4's runs, for what they taught (the rules above cite them):

| Run | What changed                                                                   | Main findings                                                                                       |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| v1  | prompt v4 draft, JSON example of one row kind                                  | all fit the schema; amounts multiplied twice (72,000 kcal omelette, 9 tacos); plates as dishes      |
| v2  | no dish size, named portions, a JSON example per row kind, the 3 kg check      | amounts all plausible; few kind questions, sushi as one row, plates as dishes                       |
| v3  | sections, checklist, no temperature; thinking minimal / low / medium           | structure fixed (rows per kind, no plates as dishes); thinking helps rules, not recognition         |
| v5  | all of it eaten; no removed rows; options that are different foods             | no leftover questions; real alternatives (chicken / pork); stated facts still asked                 |
| v6  | the rules in the schema's descriptions; pieces counted; size-and-count table   | eggs counted, stated facts in updates certain, no invented kinds; t1 milk still asked               |
| v7  | examples of stated and plainly visible things; at most 3 questions; ×2 samples | t1, p1, eggs, bread fixed (2/2); updates' stated kind (0/2), vague lunch (0/2), weighed plate (1/2) |

In every v4 run the answer fit the schema (154 of 154), picks were kept, texts were followed, the
background and condiments were left out.

### What to look at first

- **Does Gemini take the schema?** Nullable fields as `[type, "null"]`; if not, `anyOf`.
- **Dish names:** named foods, no containers or meals, the same name for the same dish across
  runs.
- **Alternatives:** different foods when unsure what a food is, one change each (how often the
  code has to fall back to a whole-row question), none for what is stated or plain.
- **What v4 broke at random:** vague input, a stated kind in a correction, the weighed plate.
- **Recognition** (grilled tuna as "beef", shrimp as "fish", dropped foods) can't be fixed by the
  prompt; I correct it in text.
- **Runs vary:** judge on `--repeat 2` or more.
