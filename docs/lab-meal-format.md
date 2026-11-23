# The lab: a meal's format

The format of a meal in the meal composer experiment (see [lab.md](lab.md)): what the model
returns, what the code makes of it, and what the local tool logs. How the model is told to use it
is in [lab-meal-prompt.md](lab-meal-prompt.md). 1,000 example meals written in the format's first
version (questions written by the model), with the problems they raised, are in
[lab-meal-examples.md](lab-meal-examples.md).

Status (2026-11-23): **prompt v6, in code with the command-line tool and the bench, and the
lab's meal screen runs on it.** `src/lab/meal/`: `schema.ts` (what the model answers), `read.ts`
(the forgiving reader), `process.ts` (amounts, totals, questions, the user's answers), `view.ts`
(the text view), `request.ts` and `settings.ts` (what is sent, see the prompt doc). Prompt v5
(whole alternative products for every doubt) is in git history up to commit 56e60c5; prompt v3's
`parameters` (the lab's screen before) up to e3deb33; v4 (questions written by the model) up to
381aee4. Each decision below says why ("Why:").

## Principles

- **The model perceives, the code decides.** The model says what was eaten, how much, its values per
  100, how far the amounts may be off and what else each food could be. The code adds up, decides
  which doubts are worth asking about, turns them into questions and labels the chips. Why: in v4
  the model wrote the questions itself (`why`, `chosen`, `options` on three axes) and had to judge
  "80+ kcal between options, at most 3 questions in the meal", which needs arithmetic and a view of
  rows it hadn't written yet; without thinking, Flash-Lite broke those rules at random. Code does
  them exactly.
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
dish    = { name, products: [product] }
product = { name, base_unit,
            piece_count, fewer_piece_count, more_piece_count, piece_name,
            size, values, alternative_products: [{ name, size, values }] }
size    = piece_size_name, base_units_in_piece,
          smaller_piece_size_name, smaller_base_units_in_piece,
          larger_piece_size_name, larger_base_units_in_piece
values  = kcal_per_100_base_units, protein_g_per_100_base_units, carbs_g_per_100_base_units,
          fat_g_per_100_base_units, hydration_ml_per_100_base_units
```

(`size` and `values` are fields of the object they are in, flat, in that order.)

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
  one piece). `piece_name` is the piece's usual short name (шт., ломт., стакан), or null;
  `piece_size_name` a size's name from a menu or a package (M, grande, 0,5), or null. `base_unit` (g
  or ml) comes before the amount, so it is decided before the number. Why: what the model writes
  anyway; `piece_count` null for loose food leaves no slot to fill with a weight twice. The three
  are named after the piece so they read as one thing, apart from `base_unit` (they were `count`,
  `unit_name`, `amount_alias`, `unit_amount`: "unit" meant both).
- **Values in 100 base units as eaten**, and the water to drink in them
  (`hydration_ml_per_100_base_units`): from drinks and soups, 0 for food, at most 100. Why: the
  app's water nutrient is hydration (design.md, Water); as `water_g` the model gave every food
  its water content (squid 75, waffles 22), which would have filled the water bar with food.
- **How sure, next to each number:** the fewest and the most pieces (`fewer_piece_count`,
  `more_piece_count`), when pieces are hidden or hard to count; the smallest and the largest a
  piece likely is (`smaller_…`, `larger_…`, with their size names), or the next sizes on the
  menu; 0 as the smallest or fewest for an add-on that may not be there. null when stated,
  weighed, a package or in plain view. Why: as whole alternative products (v5), amounts got few
  alternatives and those one way: 15 of 62 products on runs 5–6, 28 of 150+ kcal with none
  (salo, bacon, meatballs, a croissant guessed from a photo), and steak 200 → 250 g only, never
  smaller. A slot for each bound, right after its number, asks for both sides every time; a
  product's guessed size is where it is least sure (an egg 50–65 g, a meatball 20–35), its count
  of pieces in view the surest. Two bounds, not every likely value (41, 42, 43…), not steps.
- **Alternative products: other foods or drinks it may be**, at the same count, each with its own
  size and range (an almond croissant 90 g, a classic one 60) and its own values; no `base_unit`
  of their own (rule 10: one per product). Why: "it could be X" is how the model thinks about
  what a food is; with sizes and counts in their own fields, an alternative product is only
  that, and the code no longer has to work out what each one changed.
- **Examples in English, the answer in the answer language**; a size name as on the menu (S, M,
  grande). Why: the model copied example words: Russian portions ("большая") came out
  uninflected next to masculine names; and the lab asks in other languages too.
- **No words to copy for piece names and sizes.** A size has a name only from a menu or a
  package; any other is null, and the code labels it by its amount (`45 г`). A piece has its
  usual short name, or null, and the amount is then the count alone (`2 × 50г`). No examples of
  either. Why: with English examples (pc., cup, small, large, portion) the first v6 runs answered
  "1 cup M × 250 мл", "20 pc. × 10 г" and sizes "small" / "large" in a Russian answer; and an
  amount tells a size apart better than "small" does.
- **Nothing about what matters.** The schema and the prompt say what the model perceives, never
  that something decides after it. Why: the model has no use for knowing; v5's "the app decides
  what to ask" was there to stop it filtering its doubts, which the bounds' own slots now do.
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

- **Filled in:** a missing value is 0; a missing bound is none; an unknown base is g. Answers
  of earlier schemas aren't read (no backward compatibility: a bench run before is read with the
  code of its time).
- **Repaired:** water to drink over 100 in 100 base units is 100; a bound equal to its guess is
  none.
- **Dropped:** a product with no `base_units_in_piece`, a dish left empty, an alternative
  product named as one before it, a bound on the wrong side of its guess (a smaller over it),
  a size name with no size, a count's bounds when there is no count.
- **Kept but flagged:** kcal that don't match the macros (4·P + 4·C + 9·F, off by more than 30
  %), more than 105 g in 100 g, a product over 3 kg or 3,000 kcal (the model multiplying twice: a
  weight as both count and size), a count of 0.

## Processing: what the code makes of it

`process.ts`: each product's amount and values, each dish's and the meal's totals, and the
questions.

**Up to three questions a product**, in this order:

| Axis    | Options                                                                  | Example         |
| ------- | ------------------------------------------------------------------------ | --------------- |
| `kind`  | the product and its alternative products, each at its own default size   | с картошкой / … |
| `size`  | the chosen product's smaller, own and larger sizes (named or in g or ml) | S / M / L       |
| `count` | the fewest, the guess and the most pieces                                | 8 / 10 / 12     |

- **Independent**, as v4's were: the product chosen, at the size and the count chosen. What it
  is comes first because another product has its own sizes: chosen, it shows at its own
  default size and its own size question. Why: a classic croissant isn't an almond one's 130 g.
- **The user's answers** (`ItemAnswers`): the product chosen (by name), the size chosen for each
  product (by its amount: each product keeps its own, for when it is chosen again), the count
  chosen. An answer no option has any more is ignored.
- **A question's change** is its largest at the model's guesses; for the size, the largest of
  any of the products' (whichever is chosen, its size question is the one shown).
- **Asked: the largest first, until what is left fits the meal's budget**, the budget being
  **12 % of its kcal, at least 15 and at most 120** (at the model's guesses: 60 kcal in a 500-kcal
  lunch, 15 for a coffee alone, 120 from 1,000 kcal up). Each question counts its largest change;
  what is left counts as independent errors do, the root of the sum of squares (some guesses are
  over, some under). A change under 15 kcal is never asked. No cap on the number. Why:
  - **The budget, not a threshold per question.** A day can't be counted better than about 5–10
    % whatever is asked: foods vary 10–20 % from their table values, labels may be about 20 % off,
    careful weighing is 5–10 % off, a day's burn is known to about ±10 %. A question is worth a
    tap only if what is left without it would be more than that. A flat 80 kcal or 10 g protein
    (from the examples, #49, #128) left 9 of the bench's 20 meals asking nothing, the model's
    alternatives being one step either way (S/M/L, ±2 dumplings, ±50 g: 40–70 kcal); and two
    doubts each just under it (the p8 borscht's meat, 60, and its sour cream, 64) were never
    asked though together 15 % of the meal.
  - **12 % a meal for 5–10 % a day.** A day's meals are independent errors too: with about four,
    the day is off about half as much as each meal (√4). At 8 % and at most 80, run 8 (v6, every
    guessed amount with its range) asked 56 questions in 20 meals, 6 in the busiest, leaving
    ±3.4 % a meal unasked, about ±2 % a day: finer than counting can be. At 12 % and at most 120:
    38, at most 4 a meal, ±7.7 % a meal, about ±4 % a day. The maximum matters as much as the
    share: meals of 1,000 kcal and more were at it. Set aside: at most one amount question a
    product (size or count): the doubt left unasked made the budget ask more of the others (57
    questions, 7 in one meal) and left 8 meals over it.
  - **As independent errors**, not a plain sum: a plain sum assumes every guess wrong the same
    way, and a set of ten sushi, each ±15 kcal, would ask five questions of 15 kcal.
  - **The minimum** lets a coffee alone ask about its milk (30 ml, 18 kcal) or sugar (a teaspoon,
    20); and nothing smaller is worth a tap in any meal.
  - **Kcal only:** what changes protein a lot changes kcal too.
  - **No cap:** the budget bounds the questions by itself; a cap of 3 never bit on the bench.

  On runs 5–6 (v5, at 8 %): 19 questions in 20 meals, at most 3 in one, 6 meals asking nothing
  (4 with no alternatives at all). On run 8 (v6, at 12 %): 38, at most 4, 2 asking nothing.

- **Labels** come from the difference: the words names share are dropped ("Вареники с
  картошкой" / "Вареники с творогом" → "с картошкой" / "с творогом"; a preposition stays with
  its word), a size's name or grams, a count's number; amounts are added when labels would
  repeat.
- **Order:** sizes and counts small to large; products as the model gave them, most likely
  first.

## The text view

How the tool and the bench show a meal (`view.ts`), for judging by reading:

```
# Обед: 736kcal, 18.8p, 19.5f, 118c, 309.6w
## Вареники: 736kcal, 18.8p, 19.5f, 118c, 309.6w
- Вареники с картошкой — 10 шт. × 45г: 450g, 675kcal, 18p, 13.5f, 117c, 288w
  ? что
    * с картошкой
    ~ с творогом: +135kcal, +27p, +4.5f, -3c, -20w
  ? сколько
    * 10
    ~ 12: +90g, +135kcal, +3.6p, +2.7f, +23.4c, +57.6w
- Сметана 20 % — 30г: 30g, 61kcal, 0.8p, 6f, 1c, 21.6w
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
- A question: its axis (`что`, `размер`, `сколько`), then its answers in order (sizes and
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
13. **Keys say everything** (2026-11-23): flat values with their unit and scale in the name,
    `hydration_ml_per_100_base_units`, the piece fields named after the piece.
14. **How sure, next to each number; alternatives only for what it is** (2026-11-23, prompt v6):
    the whole alternatives of v5 left most guessed amounts without a range, and the rest one
    way. Considered first: lists of other counts and sizes (an empty list was an easy way out,
    and "every likely one" lists every gram), an error in % (symmetric, but it leaves the code to
    invent the sizes and drops the menu's names), min and max of every value (nutrient ranges
    the user can't answer). The budget (12 % of the meal, as independent errors) decides what is
    asked.

## Open questions

- **Choices tapped on the phone, and a new request.** With no meal sent back, a new answer may
  differ where I already chose. One way: a tap becomes a small text in the context ("Вареники: с
  творогом").
- **History:** past meals as examples for the model, matched by dish name: which, in what form.
- **The `why`:** questions show their axis ("что"), not the model's reason ("начинка"). A short
  reason on each alternative would read better, for a few tokens.
