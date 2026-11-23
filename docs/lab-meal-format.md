# The lab: a meal's format

The format of a meal in the meal composer experiment (see [lab.md](lab.md)): what the model
returns, what the meal screen adjusts, what the lab stores and what is sent back on an update.
1,000 example meals written in its first version, with the problems they raised, are in
[lab-meal-examples.md](lab-meal-examples.md); how the model is told to use it is in
[lab-meal-prompt.md](lab-meal-prompt.md).

Status (2026-11-23): **in code, tested on the bench, not yet in the lab's UI.**
`src/lab/composer/meal.ts` (types, the strict reader, amounts, the screen form),
`schema.ts` (the JSON Schema sent to Gemini), `request.ts` (what an update sends besides the
prompt). The lab's meal screen still uses prompt v3's `parameters` (`types.ts`); the new screen
is next. Each decision below says why ("Why:").

## Principles

- **The lab only.** Not bound by the app's data (products, recipes, the backup format).
- **One format.** The meal with its choices is the main format: the model's answer, the meal
  screen's state, the stored meal and the "meal so far" sent back are all the same thing. A
  certain meal is the same format with every question certain. Anything that only needs what was
  eaten (totals, the meals list, history) reads the current answers and ignores the alternatives.
  The lab's own wrapper around it: id, time, the attached context, the update state.
- **Products are local.** No product library: a product is a name with values, inside the row
  that uses it. A name may drift over time ("Овсянка" with milk, later with water), so past
  meals are examples for the model, never a database. Milk in g and in ml is two products.
- **Choices are shortcuts.** They let me fine-tune the model's answer in a few taps, with no
  round trip. Anything bigger (an exact weight, a different dish, something missed, something
  not eaten) is text, and a new request.
- **On the phone: choices only.** No typed amounts (a typed number can't be an option, and text
  survives updates where a local edit may not). Each row shows its kcal and macros, updated as
  chips are tapped, so what a choice is worth is seen without annotating every option.
- **All of it, by me alone.** By default everything served was eaten and drunk, by me alone: no
  questions about leftovers or sharing; I say otherwise in text. Why: questions about how much
  broth I drank or my share of a plate were guesses about what the photo can't show, cluttered
  every meal, and are rare; one line of text says them exactly.
- **Easy for the model.** Fixed shapes with every field required (the schema guarantees them),
  values the model knows (absolute values per 100, never differences), no arithmetic, nothing
  written twice.

## Structure

```
meal = { title, items: [row] }
row  = { sized_food } | { food } | { dish }
dish = { name, items: [{ sized_food } | { food }], counts }
```

**Rows are one-key wrappers in one list.** Each row is an object with a single key naming its
kind. Why:

- **Order:** one list keeps the model's order (the plate, or my text: "omelette, toast, coffee"),
  and an add-on next to what it's added to (a syrup row after its latte). Separate lists by kind
  (`sized_foods`, `foods`, `dishes`) were considered and set aside for this.
- **Well defined:** the schema says `anyOf` the three wrappers, each with its one key required,
  so the kind is the first thing the model writes and decides, and the reader knows the kind
  from the key. Plain `anyOf` of the three shapes would share field names (`sizes`, `counts`) and
  couldn't be told apart early.
- **Two levels by schema:** a dish's `items` allow only `sized_food` and `food`; a dish in a dish
  can't be written. (In 1,000 example meals nothing needed one.)

**`title`** is the only meal-level field: the meals list needs it. `dropped` and `out_of_focus`
(prompt v3) and `source` (visual / published / history) were dropped: nothing showed or used
them.

## A row

```jsonc
{ "sized_food": { "sized_products": Q<SizedProduct>, "counts": Q<Count> } }
{ "food":       { "products": Q<Product>, "sizes": Q<Size>, "counts": Q<Count> } }
{ "dish":       { "name": "Тако", "items": [ … ], "counts": Q<Count> } }
```

- **A product:** `label` (the chip), `name` (the full name: the row's name when chosen), `base`
  (`g` or `ml`; all kinds of a row have the same base), `per_100` (kcal, protein, fat, carbs,
  water per 100 g or ml as eaten). A sized product adds `unit`: its name and size.
- **A size:** `{ label, size }` in the product's base. The label is the unit in the amount ("1
  grande", "150 г").
- **A count:** `{ label, count }`; 0 is valid, fractions are.
- **The amount** is count × size (the product's unit, or the chosen size); values are amount ×
  per_100 / 100. A dish's count multiplies its parts, each given per serving.

**`sizes` is always there** on a food (one certain option when nothing is asked). Why: a fixed
shape with every field required; the model never decides whether to write a field.

**A dish has no size** of its own, only a count of servings. Why: in the examples a dish size was
only ever asked with a count of 1 (11 of 84 dishes), and the bench's first runs showed the model
misusing a dish's size and count together; a dish's "large" is its count (`[6-inch] 1 /
footlong 2`) or a size on the part that grows (a ramen's noodles).

### Size and count

The size is how big one is; the count is how many. Four cases, as the prompt states them:

| What it is                                                      | Size (one of it)                                    | Count                                      |
| --------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Pieces: eggs, slices, cutlets, dumplings, a croissant           | `sized_food`, unit `шт.` of its grams, one per kind | how many pieces                            |
| A drink or dish in a menu size                                  | `sizes`: tall 350 / grande 470                      | how many drinks                            |
| Loose food, the portion unknown (rice, soup, salad)             | `sizes`: маленькая 150 / обычная 200 / большая 300  | 1                                          |
| Loose food by weight: a stated weight, a small amount (a sauce) | one size `г` (or `мл`) of 1                         | the grams, small amounts labelled in words |

`г` and `мл` are only ever a size of 1. Why each:

- **Pieces are counted, also in a dish.** The model wrote eggs in a dish as "110 g" (and once "3
  яйца" as 180 g): I can't fix that with a tap (no 1 / 2 / 3 eggs), a stated count is lost, and
  4 eggs hidden in "110 g × 2" go unnoticed. As pieces, I see them and the count is a chip.
- **Named portions for loose food.** I know the portion, not the grams; the model wrote loose
  food this way by itself, and it's what I'd answer. A weight I state stays grams.
- **`г` of size 1 only.** A "г" label on a 50 g size showed an egg as "3 г" (the amount right,
  the text wrong).
- **Size in one place.** A kind with its own size (a croissant plain 60 g / almond 90 g) is a
  `sized_food`; a size chosen on its own (a menu size) is `sizes`. Never both: where a size
  choice exists for some kinds only, it's one `sized_products` question of the real
  combinations.

## Questions

`sized_products` / `products`, `sizes` and `counts` are each a question of the same shape:
`why`, `chosen`, `options`, all required. A certain question is one option with an empty `why`.

```jsonc
{ "why": "", "chosen": "1", "options": [ { "label": "1", "count": 1 } ] }       // certain
{ "why": "начинка", "chosen": "картошка", "options": [ … ] }                      // in doubt
```

- **`chosen` is a label**, copied from an option, never a position; labels differ within a
  question. Why: a position breaks when options are reordered; a label is what I tapped.
- **`why` per question**: each question is shown with its own hint.
- **Options**: usually 2–3, up to 4 for what a food is; the reader rejects more than 8. Order:
  natural where there is one (small → large, counts ascending), else most likely first.
- **"None"** is an answer: a "none" product (all values 0, water too; in `sized_products` a unit
  of 0), or a count of 0. A row whose answer is "none" isn't eaten, and the phone hides its other
  questions.
- **The three questions are independent**: any combination of answers is valid and means what
  its labels say.

What is asked, and when, is the prompt's (see [lab-meal-prompt.md](lab-meal-prompt.md)).

## What the model gets and returns

- **Gemini's `responseJsonSchema`** (standard JSON Schema), not `responseSchema` (Google's
  OpenAPI subset). Why: it's the current form; it keeps the schema's key order (Gemini 2.5 and
  later), so the fields come in the order the model should decide them (`why`, then `chosen`,
  then `options`; the kind's key first); and it takes `anyOf` for the wrappers.
- **No number or array limits in the schema** (`minimum`, `minItems`, `maxItems`). Why: with
  them Gemini rejected the schema as "too many states for serving"; without them it is
  accepted, with the wrappers, the dish inside and every field required. The reader checks them
  instead.
- **Descriptions in the schema** carry the rules broken most (one option when certain or
  stated, options that are different foods, pieces counted, `г` only for 1). Why: without
  thinking, Flash-Lite writes field by field and doesn't re-read the prompt; a field's
  description is where it is when it writes the field. It fixed stated facts and invented kinds
  in the bench where the prompt alone hadn't.
- **The update** sends the meal so far (my current answers) as JSON in the context, and the whole
  attached context again. **Nothing about rows I removed:** what I didn't eat, or a guess too far
  off for the choices, I say in text. Why: simpler, and text is exact; a list of removed names
  needed matching against renamed rows, and the model brought rows back anyway in one run.

## Checks

One strict reader for the model's answers and the stored meals (`readMeal`); any problem and the
answer isn't used, the meal stays as it was.

- A row is one wrapper with one key; a dish's items are foods; a dish has a name and items.
- Every question has `why`, `chosen` and options; labels differ; `chosen` is one of them; at most
  8 options.
- Counts, sizes and values are numbers ≥ 0; all kinds of a row have the same base.
- **No row over 3 kg or 3,000 kcal at any of its answers.** Why: it catches the model
  multiplying twice (a weight written as both count and size: an omelette of 72,000 kcal; a
  dish's servings counted again in a part: 9 tacos for 3), which the first bench run had twice.

Notes, not problems (the answer is used; the bench shows them): a `why` on a certain question
(dropped), a choice without a `why`, a size labelled `г`/`мл` that isn't 1. Why notes: a slip in
a hint or a label shouldn't cost me an update; the prompt is what fixes them, not the reader
("no smart post-processing": the reader doesn't rewrite the model's answer).

## The screen form

How the bench prints a meal, and the form the examples and the prompt use: a row is
`- name — amount (kcal · P · F · C)`, a dish `- name — ×count` with its parts indented, each
question with more than one option a line under its row, `[chosen]`; certain questions aren't
shown.

| Mark | Question                                   |
| ---- | ------------------------------------------ |
| `U`  | `sized_products`: a kind with its own size |
| `P`  | `products`: a kind                         |
| `S`  | `sizes`: how big                           |
| `C`  | `counts`: how many, or how much            |

```
# Обед
- Тефтели куриные — 6 шт. (324 kcal · 27 P · 18 F · 9 C)
  U мясо в тефтелях: [курица, 30 g] / свинина, 30 g
  C количество тефтелей: 5 / [6] / 7
- Картофель отварной — 1 обычная (164 kcal · 4 P · 0.2 F · 34 C)
  S порция: маленькая 150 / [обычная 200] / большая 300
- Бутерброд с колбасой и сыром — ×1 (278 kcal · 15.7 P · 17.8 F · 13.5 C)
  - Хлеб ржано-пшеничный — 1 ломт. (63 kcal · …)
  - Сыр полутвердый — 2 ломт. (140 kcal · …)
  - Колбаса вареная — 2 ломт. (75 kcal · …)
= 750 kcal · 46.3 P · 35.9 F · 53.1 C
```

[lab-meal-examples.md](lab-meal-examples.md) uses the first version of this form (amounts only,
dish sizes, partly eaten and shared rows), checked by `scripts/check-meal-examples.py`.

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
11. **On the bench** (2026-11-23, see lab-meal-prompt.md, The bench): rows as one-key wrappers in
    one list; `responseJsonSchema` without limits; no dish size; `sizes` always present; named
    portions; pieces counted; the 3 kg / 3,000 kcal check; `title` only at the meal level; all of
    it eaten by me alone; no removed rows sent.

## Open questions

- **History:** past meals as examples for the model (prompt v3 sent "history matches"; prompt
  v4 sends none yet): which rows, in what form.
- **The meal screen:** rows with their chips and values, "none" shown as нет, × on a row (and
  what it means now that removed rows aren't sent: likely just "not eaten", local).
- **Totals across a weighed plate** split into rows may drift when one row's answer changes; the
  prompt keeps a stated weight as one row.
