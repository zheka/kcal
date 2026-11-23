# The lab: a meal's format

The format of a meal in the meal composer experiment (see [lab.md](lab.md)): what the model
returns, what the code makes of it, and what the local tool logs. How the model is told to use it
is in [lab-meal-prompt.md](lab-meal-prompt.md). 1,000 example meals written in the format's first
version (questions written by the model), with the problems they raised, are in
[lab-meal-examples.md](lab-meal-examples.md).

Status (2026-11-23): **in code with the command-line tool and the bench, and the lab's meal
screen runs on it.**
`src/lab/meal/`: `schema.ts` (what the model answers), `read.ts` (the forgiving reader),
`process.ts` (amounts, totals, questions), `view.ts` (the text view), `request.ts` and
`settings.ts` (what is sent, see the prompt doc); the user's answers on the phone: `answered` in
`process.ts`. Prompt v3's `parameters` (the lab's screen before) are in git history up to commit
e3deb33. The previous format (v4: questions
written by the model) is in git history up to commit 381aee4. Each decision below says why
("Why:").

## Principles

- **The model perceives, the code decides.** The model says what was eaten, how much, its values
  per 100, and what else each food could be. The code adds up, decides which alternatives are
  worth asking about, turns them into questions and labels the chips. Why: in v4 the model wrote
  the questions itself (`why`, `chosen`, `options` on three axes) and had to judge "80+ kcal
  between options, at most 3 questions in the meal", which needs arithmetic and a view of rows it
  hadn't written yet; without thinking, Flash-Lite broke those rules at random. Code does them
  exactly.
- **Flat, forgiving, natural.** A schema the model writes the way it thinks ("it's X, 2 pieces of
  50 g; it could be Y"), and a reader that uses whatever it can. Why: v4's fixed shapes (wrappers,
  `sized_food` vs `food`, a size-and-count table with `г` only of 1) existed to make the model's
  answer a UI; with the code making the UI, the model needs none of them.
- **Only the input is sent, never the meal so far.** Every request perceives the whole context
  (texts, photos, scanned products) afresh. Why: one kind of request, no update rules in the
  prompt, nothing to keep in sync between the stored meal and the model. A correction is more
  input ("тефтели куриные"). What happens to choices tapped on the phone is open (below).
- **The lab only.** Not bound by the app's data (products, recipes, the backup format).
- **Products are local.** No product library: a product is a name with values, inside the dish
  that has it. Past meals will be examples for the model, never a database.
- **All of it, by me alone.** By default everything served was eaten and drunk, by me alone; I
  say otherwise in text. Why: questions about how much broth I drank or my share of a plate were
  guesses about what the photo can't show, cluttered every meal, and are rare.

## What the model returns

```
meal    = { title, dishes: [dish] }
dish    = { name, products: [product + alternatives] }
product = { name, base_unit, piece_count, piece_name, piece_size_name, base_units_in_piece,
            kcal_per_100_base_units, protein_g_per_100_base_units, carbs_g_per_100_base_units,
            fat_g_per_100_base_units, hydration_ml_per_100_base_units }
```

- **A dish is a food as a menu or a food diary names it** ("Борщ", "Тефтели с картофелем",
  "Капучино"), with what it is made of or served with as its part (a side, a sauce, the sour
  cream in the soup, the sugar in the tea). A food of its own is a dish of its own, even on the
  same plate (bread, a pampushka, a drink, a dessert); each kind in a sushi set too. The name is
  what is certain, the same each time: never the plate, cup or board, never the meal
  ("Завтрак"), no amounts, no doubts (vareniki of a filling in doubt: "Вареники"). Why: dish
  names are for finding the same dish in my history later; grouping by plate (the first idea)
  named containers ("Тарелка с завтраком"), which would never match.
- **Keys say everything**, unit and scale included, and the values are flat in the product.
  Why: the model follows the schema's names and descriptions more closely than the prompt.
  `hydration_ml` inside `per_100` was read as the ml drunk: a 330 ml can got 330, a 350 ml broth
  350, each a copy of the amount written just before in the same unit (run 4). Every value now
  says `_per_100_base_units` as it is written; the code still keeps them as `per_100`.
- **The amount** is `piece_count` × `base_units_in_piece` for pieces (eggs, slices, dumplings,
  drinks), else `base_units_in_piece` alone with `piece_count` null (loose food, a stated weight:
  one piece). `piece_name` is the piece as counted (шт., ломт., стакан), `piece_size_name` its
  size by name when there is one (M, grande, обычная). `base_unit` (g or ml) comes before the
  amount, so it is decided before the number. Why: what the model writes anyway; `piece_count`
  null for loose food leaves no slot to fill with a weight twice. The three are named after the
  piece so they read as one thing, apart from `base_unit` (they were `count`, `unit_name`,
  `amount_alias`, `unit_amount`: "unit" meant both).
- **Values in 100 base units as eaten**, and the water to drink in them
  (`hydration_ml_per_100_base_units`): from drinks and soups, 0 for food, at most 100. Why: the
  app's water nutrient is hydration (design.md, Water); as `water_g` the model gave every food
  its water content (squid 75, waffles 22), which would have filled the water bar with food.
- **Alternatives are whole products**, each as it would be if that reading were right: another
  food (cod / chicken / pork, another filling), another size, another count when pieces are
  hidden; one change per alternative. Why: "it could be X" is how the model thinks; it doesn't
  judge whether a doubt matters, the code does.
- **No notes.** Why: prose can't be shown as chips, and a free-text field invites questions in
  prose.

**The schema** (`schema.ts`) is Gemini's `responseJsonSchema`, every field required, nullable
ones as `[type, "null"]`, no number or array limits (Gemini rejected those as "too many states"
in v4). The rules broken most are in the fields' descriptions, where the model is as it writes
them (see the prompt doc).

## Reading: forgiving

`readMeal` (`read.ts`) never rejects an answer: what can be used is used, and each repair is a
flag (kept in the log, shown in the text view). Why: in v4 any problem lost the whole answer; a
slip in one product shouldn't cost a meal.

- **Filled in:** an alternative's missing fields are its product's (an alternative of
  `{piece_count: 12}` is the product with 12); a missing value is 0; an unknown base is g;
  products with no dishes are one dish. An answer of the schema before (nested `per_100`, the
  old names) is read with today's names, its `water_g` (the water content) as 0.
- **Repaired:** water to drink over 100 in 100 base units is 100.
- **Dropped:** a product with no `base_units_in_piece`, a dish left empty, an alternative that
  is the same as the product or one before it.
- **Kept but flagged:** kcal that don't match the macros (4·P + 4·C + 9·F, off by more than 30
  %), more than 105 g in 100 g, a product over 3 kg or 3,000 kcal (the model multiplying twice: a
  weight as both count and size), a count of 0.

## Processing: what the code makes of it

`process.ts`: each product's amount and values, each dish's and the meal's totals, and the
questions.

**Questions from alternatives.** Each alternative is compared with the model's guess and sorted
by what it changes:

| Axis    | Changes                                                           | Example           |
| ------- | ----------------------------------------------------------------- | ----------------- |
| `kind`  | what it is (name and values; may bring its own piece size)        | картошка / творог |
| `size`  | how big (`base_units_in_piece`, `piece_size_name`), the same food | S / M / L         |
| `count` | how many, the same food and size                                  | 10 / 12           |
| `whole` | more than one of these                                            | творог, 8 шт.     |

- When every alternative changes one axis, they become **independent questions** (what, how
  big, how many), as v4's were: any combination of answers is valid. Otherwise (an alternative
  changes two things, or kinds bring their own sizes while a size is also asked) the product
  gets **one question of whole products**. Why: the model's alternatives usually change one
  thing, as asked; when they don't, a whole-row choice still works.
- **Asked** when an answer changes the product by **80+ kcal or 10+ g protein**; at most **3 in
  a meal**, those that change the most. The rest are kept, not asked ("more"). Why: the
  threshold from the examples (#49, #128); the limit keeps the chips few.
- **Labels** come from the difference: the words names share are dropped ("Вареники с
  картошкой" / "Вареники с творогом" → "с картошкой" / "с творогом"; a preposition stays with
  its word), a size's alias or grams, a count's number; amounts are added when labels would
  repeat.
- **Order:** sizes and counts small to large; kinds as the model gave them, most likely first.

## The text view

How the tool and the bench show a meal (`view.ts`), for judging by reading:

```
# Обед: 736kcal, 18.8p, 19.5f, 118c, 309.6w
## Вареники: 736kcal, 18.8p, 19.5f, 118c, 309.6w
- Вареники с картошкой — 10 шт. × 45 г: 450g, 675kcal, 18p, 13.5f, 117c, 288w
  ? что
    * с картошкой
    ~ с творогом: +135kcal, +27p, +4.5f, -3c, -20w
  ? сколько
    * 10
    ~ 12: +90g, +135kcal, +3.6p, +2.7f, +23.4c, +57.6w
- Сметана 20 % — обычно, 30 г: 30g, 61kcal, 0.8p, 6f, 1c, 21.6w
! dishes[0].products[1]: …
```

- A line's kind by its first mark: `#` the meal, `##` a dish, `-` a product, `?` a question,
  `*` the model's guess, `~` another answer, `!` a note (the reader's flags).
- A line is words, then after `: ` its numbers, if it has any: what stays words on the phone
  (names, the amount as said, chip labels) apart from what would be a chart. The numbers never
  hold a `:`, so a line splits at its last `: `.
- Numbers in one form, each with its unit:
  `<amount>g|ml, <kcal>kcal, <protein>p, <fat>f, <carbs>c, <water>w`; kcal, g and ml whole, the
  rest to a tenth. `w` is the water to drink (`hydration_ml_per_100_base_units`), ml. The
  amount for a product only: a dish's or a meal's would add g to ml.
- A question: its axis (`что`, `размер`, `сколько`, `или`), then its answers in order (sizes and
  counts small to large). Another answer shows what it changes against the guess in the same
  form, signed, with only what changes, aligned within the question.
- Only the questions asked are shown: the rest aren't worth asking (under the threshold, or over
  the meal's 3).

With `--verbose` the tool's and the bench's stats on stderr: the model, time, tokens, and how
many questions there were and were asked. On the phone the values update on a tap instead of
changes.

## The log entry

What the tool and the bench write for each request with `--out` (one JSON file, see the prompt
doc): the lab's log entry (time, build, the request, the response with the raw answer) plus the
inputs as given, the answer as read with its flags (`read`), and the processed meal
(`processed`).

## How we got here

Decisions in order, with what was set aside:

1. **Not the app's model.** At first a saved meal was to become an app meal with ingredients
   pointing at products; set aside to keep the experiment free.
2. **Meal → dish → product, two levels**, products local; a dish describes a serving.
3. **Choices as patches** ("options set fields of the row", generic questions): it worked, but
   the model had to choose fields itself, and the row duplicated the chosen option.
4. **Three questions**: what it is, how big, how many, from the model's side: its doubts from a
   photo are look-alikes, hidden contents and preparation (what), size (how big), counting (how
   many).
5. **Size in one place**, set aside: a scale factor on the use (product size × "large ×1.5"),
   because named sizes would need the model to compute ratios; and "what" options that may also
   set the unit, because size then had two sources.
6. **`sized_products` vs `products`** as separate fields, so the shape is explicit.
7. **Fixed question shape** (`why`, `chosen`, `options`, all required): no optional fields, no
   union of "a value or a question".
8. **`chosen` by label**, labels on every option; **full names on products**, never composed.
9. **Typed amounts set aside** for now: choices only.
10. **1,000 example meals** (2026-11-22) and their five problems, all settled without changing the
    shape: "none" as a kind; no linked questions; a size where it changes; one base per row;
    weighed totals stay exact (see lab-meal-examples.md, Problems).
11. **From running v4 on real meals** (2026-11-23): rows as one-key wrappers in
    one list; `responseJsonSchema` without limits; no dish size; `sizes` always present; named
    portions; pieces counted; the 3 kg / 3,000 kcal check; `title` only at the meal level; all of
    it eaten by me alone; no removed rows sent.
12. **The model perceives, the code decides** (2026-11-23): the questions (3–8) leave the model.
    It writes products with whole alternatives; the code splits them into the three questions
    where they fit (4 survives, now derived), applies the threshold and the limit, and labels the
    chips. The strict reader becomes forgiving; the meal so far is no longer sent; dishes are
    named foods, for matching against history (grouping by plate was considered first, and set
    aside: it names containers). v4's `sized_food`, `sizes` always present, `г` only of 1 and
    dish servings are gone with the shapes that needed them.

## Open questions

- **Choices tapped on the phone, and a new request.** With no meal sent back, a new answer may
  differ where I already chose. One way: a tap becomes a small text in the context ("Вареники: с
  творогом").
- **History:** past meals as examples for the model, matched by dish name: which, in what form.
- **The `why`:** questions show their axis ("что"), not the model's reason ("начинка"). A short
  reason on each alternative would read better, for a few tokens.
- **The meal screen** on this format: dishes with their products, asked questions as chips,
  values updated on a tap.
