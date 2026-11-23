# The lab: what the model is told

How the meal composer asks the model for a meal in the format of
[lab-meal-format.md](lab-meal-format.md): the model and its settings, what a request holds, the
rules of prompt v4 and why each is there, and the bench that tests them. The rules come from
1,000 example meals ([lab-meal-examples.md](lab-meal-examples.md), #N) and seven bench runs on my
own photos (v1–v7, 2026-11-23).

Status (2026-11-23): **prompt v4 written and tested on the bench, not yet used by the lab's
screen.** `src/lab/composer/prompt-v4.md` (the system instruction), `request.ts` (the context and
the checklist), `schema.ts` (the schema's descriptions), `scripts/meal-bench.ts` (the bench).

## The model and its settings

- **Gemini Flash-Lite, the newest stable one** (`gemini-3.5-flash-lite` now). Why: the cheapest
  and fastest modern model with the most generous free quota (15 requests and 250k tokens a
  minute, 500 a day; Flash allows 5 a minute and far fewer a day); about 3–5 s per answer. Flash
  was set aside: slower, a low daily quota, and its quality on rules wasn't the problem to solve.
- **Thinking `low`.** Why: Flash-Lite's own default is `minimal` (near off). At `low` it thinks
  only when it judges a request hard (3 of 22 in one run, 1 of 44 in another), at almost no cost
  in time; at `medium` it thought on every request and followed the rules more consistently,
  but at 7.3 s per answer against 3.7 s. Speed matters more; `medium` is kept in mind for updates.
- **No temperature.** Why: Google's guide says Gemini 3 models reason worse away from their
  default; prompt v3 sent 0.2.
- **The answer as JSON in the schema** (`responseJsonSchema`, see the format doc). The schema
  guarantees the shape; the prompt is about choosing well within it.

## What a request holds

1. **The system instruction: `prompt-v4.md`**, the constant part, in XML sections: `<role>`,
   `<format>`, `<rules>`, `<examples>`. Why: Google's guide puts standing rules in the system
   instruction and asks for one consistent kind of delimiter.
2. **The context** (`contextText`): the answer language, the time, the meal so far (JSON, with my
   current answers) or "a new meal".
3. **The input**, each a part of its own, in the order attached: texts, photos, scanned products
   (Open Food Facts' data as JSON).
4. **The checklist** (`CHECKLIST`), last: the rules broken most, restated. Why: the guide says
   instructions after a large input are heeded best ("place your specific instructions at the very
   end").
5. **The schema's descriptions**: the same rules again, on the fields they govern (`options`:
   one option when certain or stated, 2–4 only for a material doubt, kinds that are different
   foods, pieces counted; a size's `label`: `г` only for 1). Why: without thinking, Flash-Lite
   writes the JSON field by field; the description is in front of it as it writes the field. This
   fixed stated facts in updates and invented kinds (v6) where the prompt and checklist hadn't.

## The rules, and why

In prompt v4's order (the numbers are the prompt's).

1. **Always a complete best guess**; vague input gets a typical meal with no kind questions
   invented. Why: a gap or a question in prose can't be shown as chips; "business lunch, set B"
   with invented "soup or salad" options is noise I can't answer better than the model (raised in discussing the examples).
   Still broken without thinking (v7: 0 of 2).
2. **Only the meal in focus**; several plates in focus are all included. Why: other people's
   cups and plates were the commonest wrong rows; I remove a whole plate with one word ("я ел
   только кальмара"), which the bench shows works.
3. **Table condiments are ignored** unless I say I used them. Why: "0 oil" rows for the bottle
   on the table (asked in the examples) were never produced by the model in two runs, and would be
   clutter I'd mostly ignore; I say "полил маслом".
4. **Ask what the photo can't tell**: look-alikes, hidden fillings, how it was cooked, how many
   when some are hidden, the size ordered; never what the photo shows clearly; named portions
   for loose food. **Unsure what a food is: options that are different foods** (cod / chicken /
   pork), up to 4. Why: questions on plainly visible counts (2 eggs, 3 rösti) were noise (v6);
   the model's alternatives were variants of its wrong guess (beef / horse for tuna, squid /
   cuttlefish), so the right answer wasn't a chip.
5. **Only what matters**: about 80+ kcal or 10+ g protein between the options; **never what I
   said** (a stated kind or amount has one option); **at most 3 questions in a meal**. Why: the
   examples' threshold (#49, #128); the model asked the bread kind for one slice and oat milk
   after "на овсяном" in every run until examples showed a stated kind with no question (v7); a
   number is easy for a small model to follow, and keeps the chips few.
6. **Split only as far as needed to place a question.** Why: a dish kept whole is one row to read
   and its values are the model's best (#371: pho split for an immaterial broth question).
7. **Where a size goes**: see the format's size-and-count table; a menu size that is a number of
   pieces is a count; in home cooking the number of pieces is a question when unclear. Why: the
   table (four cases, plainly) replaced prose the model mixed up (eggs weighed, "3 г").
8. **One base per row**, g when kinds differ (#40, #502).
9. **Questions are independent**: any combination of answers is valid.
10. **"None" is an answer**: a "none" kind, a count of 0.
11. **Labels are what I'd say**: short, the difference only; menu names or named portions;
    small amounts in words (`немного / обычно / много`). Why: grams in labels (15 / 30 / 50 g of
    sour cream) are what I can't answer; words I can.
12. **Names**: full product names, never composed; a dish's name is what's certain.
13. **Amounts are what is eaten**: no bones, shells, peel, ice.
14. **All of it, by me alone**: no questions about leftovers or sharing. Why: see the format's
    principles; "how much broth did you drink" was asked of every ramen.
15. **Each kind of piece is its own row**; a tray or set is never one row; only garnish under
    the threshold is dropped. Why: a sushi tray became one row "Набор суши" after a "lump small
    things" rule (v4b); with this rule it's a row per kind in every run since.
16. **Stated amounts are certain**; a stated total weight is one row, never split. Why: the
    model split "гречка с котлетой, 350 г" into rows (v6), and once wrote 350 g of cutlet alone,
    losing the buckwheat (v7). Still unreliable.
17. **Add-ons are rows**, 0 an option: sugar, syrup, butter on toast.
18. **Cooking fat is part of the food**; a kind question only when material.
19. **A dish is something I think of as one thing** (a sandwich, a burger, tacos ×3, toasts ×2
    with butter); a plate or tray of separate foods is not a dish; home cooking whose pieces I
    know is a dish of its parts. Why: the model wrapped whole plates (eggs, bacon, rösti) as a
    dish ×1; a sandwich, though, reads better wrapped than as bread, cheese and sausage rows.
20. **Updating a meal**: keep my answers unless the input says otherwise; my texts correct it
    (a stated kind becomes certain, what I didn't eat is left out, a wrong food replaced). Why:
    removed rows are no longer sent (see the format); text is the one way to correct.
21. **The answer language** for names, labels, `why` and the title.

## Examples

Short examples in the screen form, then four rows in full JSON (a sized food, a named portion,
grams, a dish). Why: Google recommends always including examples; Flash-Lite follows examples
more than rules (a stated-milk rule failed in every run until an example showed it).

**The examples are other foods than the bench's** (shashlik, vareniki, a raf, nigiri,
toasts with butter, cappuccino on almond milk, boiled eggs). Why: Flash-Lite copies examples:
with a meatball example the bench's meatballs got the example's words and sizes ("фарш не
виден", 35 g); a cutlet example turned meatballs into "котлеты". An example of a test meal only
shows that the model learned the answer.

## The bench

`scripts/meal-bench.ts` runs test meals (`scripts/meal-bench-cases.ts`) through Gemini with the
real prompt, schema, context and reader, and prints each answer in the screen form next to what a
good answer would be, for judging by reading.

```
GEMINI_API_KEY=… node scripts/meal-bench.ts --photos <dir with food1.jpg …> \
  [--only p7,t3] [--repeat 2] [--thinking low] [--model lite|flash|<id>] [--out <dir>]
```

- **Cases:** 9 of my photos (not in the repo: `--photos`) with what I know about them, 8 texts;
  some in two steps (my pick of an answer, then a text): keeping a pick (t8, p7u), a stated kind
  in an update (p7u), "сметану не ел" (t6), "я ел только кальмара" (p2t).
- **Quotas:** at most 9 requests a minute for Flash-Lite (2 for Flash), retries included; a busy
  Gemini (429, 5xx) is tried again after 5, 15, 30, 60, 120 s. A run is 22 requests (44 with
  `--repeat 2`), about 100k tokens.
- **Output:** each step logged as it's answered (`run.log`, readable while it runs), the raw
  answers as JSON, tokens and time per answer.

### Results

| Run | What changed                                                                   | Main findings                                                                                       |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| v1  | prompt v4 draft, JSON example of one row kind                                  | all fit the schema; amounts multiplied twice (72,000 kcal omelette, 9 tacos); plates as dishes      |
| v2  | no dish size, named portions, a JSON example per row kind, the 3 kg check      | amounts all plausible; few kind questions, sushi as one row, plates as dishes                       |
| v3  | sections, checklist, no temperature; thinking minimal / low / medium           | structure fixed (rows per kind, no plates as dishes); thinking helps rules, not recognition         |
| v5  | all of it eaten; no removed rows; options that are different foods             | no leftover questions; real alternatives (chicken / pork); stated facts still asked                 |
| v6  | the rules in the schema's descriptions; pieces counted; size-and-count table   | eggs counted, stated facts in updates certain, no invented kinds; t1 milk still asked               |
| v7  | examples of stated and plainly visible things; at most 3 questions; ×2 samples | t1, p1, eggs, bread fixed (2/2); updates' stated kind (0/2), vague lunch (0/2), weighed plate (1/2) |

In every run: the answer fits the schema (154 of 154 answers read without problems since v1),
picks are kept, texts are followed, the background and condiments are left out.

### What's left

- **Without thinking, some rules break at random:** a stated kind in an update still asked,
  kinds invented for vague input, the weighed plate split or a food lost. Next: an example of
  each (as stated milk was fixed), or `medium` thinking for updates only (rarer, and where these
  break).
- **Recognition:** grilled tuna is "beef" in every run, shrimp often "fish"; dropped foods
  (whipped cream, a Cola can). Prompts can't fix it; I correct it in text.
- **Runs vary:** a single run can't tell a fix from chance; judge on `--repeat 2` or more.
