# The lab: what the model is told

How the meal composer asks the model for a meal in the format of
[lab-meal-format.md](lab-meal-format.md): the model and its settings, what a request holds, the
rules of prompt v6 and why each is there, and the command-line tool and the bench that run it.
The rules come from 1,000 example meals ([lab-meal-examples.md](lab-meal-examples.md), #N) and
from runs of prompts v4 and v5 on real meals.

Status (2026-11-23): **prompt v6 written, to be run; the lab's screen sends it too**, the same
request with the same settings, retries and timeout (the lab is a manual test, see lab.md).
`src/lab/meal/prompt.md` (the system instruction), `settings.ts` (the model and its settings),
`request.ts` (the context and the checklist), `schema.ts` (the schema's descriptions);
`scripts/meal.ts` (the tool), `scripts/meal-bench.ts` (the bench). Prompt v5 (whole alternative
products for every doubt, examples in Russian) is in git history up to commit 56e60c5; v4 (the
model wrote the questions) up to 381aee4.

This repo tests the code only (deterministic and quick: `npm test`, `npm run e2e`). How the
model behaves is tested apart from it, with the tool and the bench on tests of real meals that
aren't kept here.

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
  only when it judges a request hard (in v4, about one request in ten or fewer), at almost no
  cost in time; at `medium` it thought on every request and followed v4's rules more
  consistently, but at 7.3 s per answer against 3.7 s. With the judging moved to code, fewer
  rules depend on thinking.
- **No temperature.** Why: Google's guide says Gemini 3 models reason worse away from their
  default; prompt v3 sent 0.2.
- **9 requests a minute**, retries included: under the free tier's 15 (the tool and the bench;
  the lab sends one at a time, as tapped).
- **Retries: 5 more tries after 5, 15, 30, 60 and 120 s**, for a busy Gemini (429, 500, 503,
  504), one that doesn't answer within **120 s**, or can't be reached; the lab's too. Why: 503s
  at a busy hour are common (run 5 lost 3 of 20 after these); a timed-out request is as worth
  another try as a 503.
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
5. **The schema's descriptions**: the same rules again, on the fields they govern (a dish's name;
   `piece_count` only for pieces; `base_units_in_piece` one piece; the bounds and when they're null;
   alternative products for real doubt only, different foods). Why: without thinking, Flash-Lite
   writes the JSON field by field; the description is in front of it as it writes the field. In v4
   this fixed stated facts in updates and invented kinds where the prompt and checklist hadn't.

## The rules, and why

Prompt v6 is about perceiving only. The `<role>` says what the model does (what was eaten, how
much, how far off, what else it may be) and what for (the user's nutrition tracking), and
nothing of what comes after it: not a step of something, not what the app does with the answer.
Why: v5's role said "the app decides which alternatives matter", to stop the model filtering
its doubts; the model has no use for knowing, and the bounds' own slots now ask for every
doubt. The whole prompt, the checklist and the schema were audited for this (2026-11-23): what
the model can't perceive or check was taken out (see the dish names below, and the examples).

**The format section:**

- **Dishes are named foods**, as a menu or a food diary names them, by their plainest usual
  name, without containers, the meal, amounts or doubts; a food of its own is a dish of its own.
  Why: the names are for matching against history later (see the format doc). The prompt said so
  and asked for "the same name each time", but the model never sees its earlier answers, so it
  can't keep names the same; the plainest usual name is what it can do that makes names match
  most often. Matching itself is for the code, or for past names sent as input.
- **The amount, as a table**: pieces counted (`piece_count` × one piece, `piece_name` its usual
  short name, never shown), menu sizes (`piece_size_name`), loose food and stated weights as one `base_units_in_piece` with
  `piece_count` null. Never a weight in two
  places. Why: a table of plain cases worked in v4 where prose was mixed up (eggs weighed, "3
  г"); the 72,000 kcal omelette was a weight written twice.
- **How sure**: the fewest and most pieces when hidden or hard to count; the smallest and
  largest size, or the next on the menu, always for a size guessed from a photo or a vague text;
  null only for what is stated, weighed, a package or in plain view; 0 as the smallest for an
  add-on that may not be there. Why: see the format doc (How sure).
- **Alternative products** are other foods only, at the same count, with their own piece name,
  size, range and values. Why: amounts have their own fields.
- **Examples and the schema's examples in English**, names in the answer language, a size name
  as on the menu; no words at all for sizes and pieces (piece names null in the examples). Why:
  Russian example words were copied uninflected ("большая" next to a masculine name), and
  English ones untranslated ("cup", "pc.", "small"): see the format doc.
- **`hydration_ml_per_100_base_units`: the water to drink**, from drinks and soups; food 0, a
  soup's sour cream included, and so is a food or drink cooked into a food. Only what it means,
  no values: how much water a drink gives is the model's to find, as kcal are. Why: the field was
  `water_g` and the model gave food its water content; the app counts drinks and soups only
  (design.md, Water). In run 3 the milk in an omelette got 44 ml (hence cooked-in), and with a
  list of values in the prompt (coffee 99) a cappuccino got 99 where its milk makes it about 90.
  Without the list (run 4) the scale went instead: as `hydration_ml` it got a can's 330 ml, hence
  the full name and "at most 100" in the schema (see the format doc, Keys say everything).

**The rules** (the numbers are the prompt's):

1. **Always a complete best guess**; vague input gets a typical meal with no alternative products
   invented, its guessed amounts still with their range. Why: a gap can't be shown; "business lunch"
   with invented options is noise I can't answer better than the model. Broken in v4 without
   thinking.
2. **Only the meal in focus**; several plates in focus are all included. Why: other people's cups
   and plates were the commonest wrong rows; I remove a whole plate with one sentence.
3. **Table condiments are ignored** unless I say I used them. Why: "0 oil" rows for the bottle on
   the table would be clutter I'd mostly ignore; I say "полил маслом".
4. **All of it, by me alone.** Why: see the format's principles.
5. **Each kind of piece is its own product**, a set's kinds are dishes of their own; garnish
   dropped. Why: in v4 a sushi tray became one row after a "lump small things" rule; a row per
   kind once it was gone.
6. **A food I think of as one thing is one product** (a sandwich, a Caesar, a ramen), split only
   when I list its parts or a part is in doubt; home cooking whose pieces I know is its parts, so
   they're counted. Why: a dish kept whole has the model's best values (#371: pho split for an
   immaterial question); a question needs its own product.
7. **Stated is certain**: no range and no alternative products for a stated kind, amount or
   size; a stated total
   weight is one product, never split. Why: in v4 the model asked about oat milk after "на
   овсяном" until an example showed it, and split "гречка с котлетой, 350 г" into rows, once
   losing the buckwheat.
8. **Alternative products for real doubt only**, about what the photo can't tell; never for
   what it shows clearly; **different foods, not variants** of the first guess. Why: questions
   on plainly visible counts were noise; v4's alternatives were variants of a wrong guess
   (beef / horse for tuna), so the right answer wasn't a chip.
9. **Amounts are what is eaten** (no bones, shells, peel, ice); cooking fat is part of the food.
10. **One `base_unit` per product, its alternative products included**, g when they'd differ (#40,
    #502). Why: the code compares their values.
11. **Names in full** (an alternative product's too), piece and size names short, in
    the answer language. Why: a chip's label is computed from the names' difference.

**What v4's rules became:** the threshold (now a share of the meal's kcal), "at most 3 questions",
labels in words, the order of options, independent questions and "none" as an answer are now
the code's (format doc, Processing); "updating a meal" is gone with the meal so far; size
wrappers and `г` only of 1 are gone with the shapes.

## Examples

Examples of how fields are filled for common inputs, each only the fields its input decides,
as JSON fragments; one of how a meal splits into dishes, products by name only; then one dish
in full JSON, all in English. Why: Google recommends always including examples; Flash-Lite
follows examples more than rules (in v4 a stated-milk rule failed in every run until an example
showed it).

**In the schema's own terms, not a short form.** The examples were in a short text form
(`- product — amount (smaller – larger)`), cheaper than JSON but the app's text view's
notation: the model had to map it back to fields, and display choices leaked into the input (`1
M × 300 ml`, from before size names and amounts were shown as they are now). Fragments say which
field gets what, need no notation of their own, and don't change when the display does; the
schema makes every field required, so fragments don't invite partial answers. A few hundred
tokens more than the short form.

**The cappuccino has no size names.** It said `1 M × 300 ml (S, 200 ml – L, 400 ml)` for the
text "almond milk cappuccino", where no menu names a size: against the rule that a size has a
name only from a menu or a package. In p3 (a tool run, 2026-11-23) a café cappuccino photo
got M, S and L, likely from it. It stays for what it shows (a stated kind: no alternative
products; an unstated size: a range), now with no names, and **"grande hot chocolate"** shows
a size named by the input: stated, so no range.

**The examples are foods the tests don't have** (a hot chocolate, a cappuccino on almond
milk, boiled eggs, rice, shashlik, oatmeal with honey, toasts with butter, cottage cheese,
vareniki). A latte (t1, t8) and tea with sugar (t3) are in the tests, so they aren't here. Why: Flash-Lite
copies examples: in v4 a meatball example gave a photo's meatballs the example's words and
sizes, and a cutlet example turned meatballs into "котлеты".

## The tool

`scripts/meal.ts` sends one meal from the command line with the lab's own code (the prompt,
schema, request, reader and processing; Gemini through `src/lab/ai/gemini.ts`), and does only
what the browser would: shrinks photos, looks up barcodes, keeps to the quota.

```
GEMINI_API_KEY=… node scripts/meal.ts [--verbose] [--test=<file>] [--out=<file>] [<input>…]
```

Kept to the minimum: what's needed to run a meal and keep what came of it; no tuning from the
command line (the model and its settings are `settings.ts`, the language `ru`, the time now).

- **Inputs**, sent in the order given: a photo file, a product JSON file (Open Food Facts data),
  a barcode (looked up), else a text.
- **`--test=<file>`:** a test's inputs, sent before any on the command line. A test is a JSON
  file, `{ "description": "…", "inputs": [...] }`, the description saying what's hard about it;
  texts (`text`) and barcodes (`barcode`) inline, files (`photo`, `product`, `textFile`) as paths
  relative to the test file, or absolute.
- **Output:** the meal as text on stdout, and nothing else; no meal, why on stderr and exit code 1.
- **`--out=<file>`:** everything as one JSON file: the inputs, the request, the answer, the
  reader's meal and flags, the processed meal. Nothing is written without it.
- **`--verbose`:** on stderr, the settings first, brief notes on what it's waiting for (a lookup,
  the quota, the answer, a busy retry), and the stats at the end (time, tokens, dishes, items,
  questions, flags). Why: a request may wait minutes on a busy Gemini; the notes say why.
- **Busy Gemini** (429, 5xx) is tried again after 5, 15, 30, 60, 120 s; each try times out after
  120 s.

## The bench

`scripts/meal-bench.ts` runs tests (the tool's `--test` files) through the tool's code, one after
another, and reports which failed. A test passes when a meal comes back; expectations come later.

```
GEMINI_API_KEY=… node scripts/meal-bench.ts [--verbose] [--repeat=N] [--out=<dir>] <test>…
```

- **Tests:** test files, or folders of them (their `*.json`, not subfolders, where a test's
  files can be); a test's id is its file name. A correction is more input in the same test. Why:
  no meal is sent back, so there are no steps.
- **One at a time,** at a fixed time (13:00), so runs differ only by the model, the output is in
  order, and the quota (the settings' 9 requests a minute) is no worse off: a run of 20 tests is
  some 2–4 minutes.
- **Output:** each failed test and why, and a summary (passed, failed, flags, questions asked,
  tokens, time); exit code 1 when any failed. `--verbose` adds each test's meal as text on
  stdout, and on stderr the settings, notes as it goes and each test's stats.
- **`--out=<dir>`:** each test's everything, as the tool's `--out`, in `<dir>/<test>.json`;
  nothing is written without it.
- **`--repeat=N`:** each test N times (`<test>-1`, `<test>-2`, …), to tell a rule from chance.
