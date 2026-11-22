# The lab: a meal's format

The format of a meal in the meal composer experiment (see [lab.md](lab.md)): what the model
returns, what the meal screen adjusts, what the lab stores and what is sent back on an update.
1,000 example meals in this format, with the problems they raised, are in
[lab-meal-examples.md](lab-meal-examples.md).

Status (2026-11-22): **agreed in discussion, not implemented.** Open questions lists what is
still undecided. The lab today uses prompt v3's `parameters`
(`src/lab/composer/types.ts`); this replaces it.

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
  round trip. Anything bigger (an exact weight, a different dish, something missed) is text, and
  a new request.
- **On the phone: choices and × only.** × removes a row (it isn't part of the meal); a count of 0
  is an answer ("none") and stays reversible, and tells the model on the next update that I
  answered "none". No typed amounts for now (may be revisited): a typed number can't be an
  option, and text survives updates where a local edit may not.
- **Easy for the model.** Fixed shapes with every field required (the schema guarantees them),
  values the model knows (absolute values per 100, never differences), no arithmetic, nothing
  written twice.

## Structure

```
meal → rows
row  = a food (its products) or a dish (a name and parts)
part = a food
```

**Two levels.** A dish's parts are foods, never dishes. In 1,000 example meals nothing needed a
dish in a dish: a tray, a thali, a bento or a buffet plate without a count of its own is the meal
itself.

**Split a dish only as far as needed to place its questions.** With no question inside it, a dish
is one food ("Цезарь с курицей", 320 g). A café caesar whose dressing amount is in doubt becomes
"Цезарь без заправки" + "Заправка" (0 / 30 / 60 g). Most meals need no dish at all (84 of 1,000
had one); a dish is mostly a repeated assembly (toasts ×2, tacos ×4, tea with sugar ×3), a wrap
or bowl with doubtful insides, or a meal described part by part in text.

## A row

A food row:

```jsonc
{
  "sized_products": { … },   // what it is, each kind with the size that comes with it
  // or "products": { … }    // what it is, without a size
  "sizes": { … },            // only with products, optional: how big, chosen on its own
  "counts": { … }            // how many (of the unit), or how much (in the base)
}
```

A dish row:

```jsonc
{
  "name": "Тако",            // a dish's name doesn't change: it has no "what" question
  "parts": [ … ],            // food rows
  "sizes": { … },            // optional: the dish's size, in servings (nami 1 / ōmori 1.4)
  "counts": { … }            // servings
}
```

A row has exactly one of `sized_products`, `products`, `parts`. `sized_products` comes first in
the field order, so the model decides whether the size comes with the kind before it writes any
options.

### Products, sizes, counts

A **product** (an option of `products` or `sized_products`):

```jsonc
{
  "label": "куриные", // the chip text
  "name": "Куриные тефтели", // the full name: of the row, in history, sent back
  "base": "g", // g or ml; all products of a row have the same base
  "per_100": { "kcal": 165, "protein": 18, "fat": 8, "carbs": 5, "water": 60 },
  "unit": { "name": "шт.", "size": 35 }, // in sized_products only, required there
}
```

A **size**: `{ "label": "grande", "size": 470 }`. The label is also the unit's name in the amount
("1 grande"); the size is in the product's base, or in servings for a dish row.

A **count**: `{ "label": "8", "count": 8 }`. 0 is valid, fractions are.

### Where the size is

The size is in exactly one place, and the field says what kind of size it is:

| Shape                  | When                                            | Examples                                                       |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `sized_products`       | the size comes with the kind                    | croissant plain 60 g / almond 90 g; wine 100 ml / brandy 30 ml |
| `products` and `sizes` | the size is chosen on its own (a menu, a glass) | latte tall / grande / venti, beer 0.33 / 0.5, pizza 30 / 40 cm |
| `products`, no sizes   | loose food: counts are in the base              | rice 150 / 220 / 300 g                                         |

A kind with its own size **and** an independent size choice doesn't occur: where a size choice
exists for some kinds only, it is one question of the real combinations ("эспрессо / латте M /
латте L", "po'boy shrimp full / shrimp half / roast beef full / roast beef half"), in
`sized_products`. When nothing is in doubt, either place is fine.

### Amounts, values, names

- **The amount** is count × size (the product's unit, or the chosen size), in the base; with no
  unit, the count is the amount. Values: amount × per_100 / 100.
- **A dish row's** amount multiplies its parts': each part's amount × the dish's count × the
  dish's size (in servings, 1 when there's no size).
- **Names are never composed.** A food row's name is its chosen product's name: picking another
  label swaps the whole product, name included. The label is only for the chips.
- **A dish's name** is what's certain about it. Where a dish's identity is in doubt, it stays whole,
  a food with products. Where a part is in doubt, the dish is named by what's certain ("Тако") and
  the part shows the rest ("Мясо аль пастор"). With nothing in doubt, the model writes the full
  name ("Тако с карнитас").

## Questions

`sized_products` / `products`, `sizes` and `counts` are each a question, always of the same shape:
`why`, `chosen`, `options`, all required. A certain question is one option with an empty `why`.
No optional fields and no "a value or a question": the schema can require every field, so the
model only decides what goes in them, and the field order follows its thinking (the doubt, the
guess, the alternatives).

```jsonc
{ "why": "", "chosen": "1", "options": [ { "label": "1", "count": 1 } ] }     // certain

{ "why": "фарш не виден",                                       // the hint, shown with the chips
  "chosen": "свино-говяжьи",                                    // the model's guess; then my answer
  "options": [ { "label": "свино-говяжьи", … }, { "label": "куриные", … } ] }
```

- **`chosen` is always a label**, copied from an option, never a position. Labels differ within a
  question; a single option has one too ("карнитас", "40"), so there are no exceptions.
- **Every option has a label**, the text of its chip. For a count it's often just the number ("8";
  the unit is shown on the row, not repeated), but about half the time words say it better:
  "нет" (0), "½" or "всё" (of a served portion), "немного / порция / много" (my share of a
  platter, a sauce), "маленькая / обычная / большая" (loose food, where I know the portion, not
  the grams).
- **`why` per question**: each question is shown on its own, with its own hint.
- **Order**: natural where there is one (sizes small → large, counts ascending, degrees such as
  sugar 0 → 100 %), otherwise most likely first. With `chosen` separate, the chips read naturally
  and the current one is highlighted.
- **Options**: usually 2–3; more only when they really exist (a menu's sizes, a dish's usual
  fillings), up to about 5–6. The chips scroll sideways, so the screen is not the limit; long
  lists mostly come from the model hedging. The reader rejects more than 8. In the 1,000
  examples: 2 options 469 times, 3 969 times, 4 79 times, 5 once.

**"None"** is an answer of any question, so "milk: none / whole / oat" is one question, the way
I'd answer it:

- **a "none" product**: a product (or sized product) whose values are all 0, water included, and,
  in `sized_products`, whose unit size is 0. Nothing real has all values 0: water has
  `water: 100`, a diet soda has water too. Its name says so ("Без молока"), its label is the
  chip ("нет");
- **a size or count of 0** ("no bun", "sauce: none").

When the chosen product is "none", or the chosen size or count is 0, the row is not eaten: the
phone shows it as "нет" and hides the row's other questions (a milk kind at count 0 means
nothing; an amount of "no milk" neither). On a dish row, a count of 0 hides its parts' questions
too. Switching back brings them back, with their answers.

**The three questions are independent**, so any combination of answers is valid and means what
its labels say:

- **count** is always independent: 8 meatballs stay 8 whether chicken or pork, 2 beers stay 2
  whether 0.33 or 0.5;
- **the size** either comes with the kind (in `sized_products`) or is a question of its own
  (`sizes`), never both;
- **two doubts about the kind** on one food are either one question of their real combinations
  (pirozhki: fried with meat / fried with cabbage / baked with meat …), or, when they are
  independent, the food split into parts (döner: bread kind on the bread, meat kind on the meat).

**What to ask** (for the prompt):

- **Only what I know better than the photo**: what it was (ordered, cooked, tasted), what's
  inside, how many I ate, the size I ordered, what I added, how much I ate of a shared or served
  thing. Not grams I can't know either.
- **Only what matters**: roughly 80+ kcal or 10+ g protein between options. This doesn't change
  the shape: an immaterial doubt is one option. _(option)_ The phone could also compute each
  question's spread at the current amounts and hide small ones.
- The model's doubts from a photo are: **what it is** (look-alikes, a hidden filling or layer, how
  it was made), **how many** (counting pieces), **how big** (a menu size, or a portion with no
  names).

## A whole meal

Street tacos: two groups, the first with its filling and the tortillas in doubt.

```jsonc
{
  "rows": [
    {
      "name": "Тако",
      "parts": [
        {
          "sized_products": {
            "why": "",
            "chosen": "тортилья",
            "options": [
              {
                "label": "тортилья",
                "name": "Кукурузная тортилья",
                "base": "g",
                "per_100": { "kcal": 218, "protein": 6, "fat": 3, "carbs": 45, "water": 45 },
                "unit": { "name": "шт.", "size": 20 },
              },
            ],
          },
          "counts": {
            "why": "двойная тортилья или одна",
            "chosen": "2",
            "options": [
              { "label": "1", "count": 1 },
              { "label": "2", "count": 2 },
            ],
          },
        },
        {
          "products": {
            "why": "начинку по фото не различить",
            "chosen": "аль пастор",
            "options": [
              {
                "label": "аль пастор",
                "name": "Мясо аль пастор",
                "base": "g",
                "per_100": { "kcal": 230, "protein": 18, "fat": 16, "carbs": 4, "water": 60 },
              },
              {
                "label": "асада",
                "name": "Говядина асада",
                "base": "g",
                "per_100": { "kcal": 210, "protein": 25, "fat": 12, "carbs": 0, "water": 60 },
              },
              {
                "label": "суадеро",
                "name": "Говядина суадеро",
                "base": "g",
                "per_100": { "kcal": 290, "protein": 18, "fat": 24, "carbs": 0, "water": 55 },
              },
            ],
          },
          "counts": { "why": "", "chosen": "40", "options": [{ "label": "40", "count": 40 }] },
        },
      ],
      "counts": {
        "why": "одно тако частично закрыто",
        "chosen": "3",
        "options": [
          { "label": "2", "count": 2 },
          { "label": "3", "count": 3 },
        ],
      },
    },
    {
      "name": "Тако с карнитас",
      "parts": [/* the tortilla part as above, and a certain carnitas part */],
      "counts": { "why": "", "chosen": "2", "options": [{ "label": "2", "count": 2 }] },
    },
  ],
}
```

On the screen (the form the examples use, see below):

```
- Тако ×3
  C одно тако частично закрыто: 2 / [3]
  - Кукурузная тортилья — 2 шт.
    C двойная тортилья или одна: 1 / [2]
  - Мясо аль пастор — 40 g
    P начинку по фото не различить: [аль пастор] / асада / суадеро
- Тако с карнитас ×2
  - Кукурузная тортилья — 2 шт.
  - Карнитас — 40 g
```

### The screen form

[lab-meal-examples.md](lab-meal-examples.md) writes meals in this form: a row is `- name —
amount`, a dish `- name ×count` with its parts indented, and each question with more than one
option is a line under its row, marked by its kind:

| Mark | Question                                   |
| ---- | ------------------------------------------ |
| `U`  | `sized_products`: a kind with its own size |
| `P`  | `products`: a kind                         |
| `S`  | `sizes`: how big                           |
| `C`  | `counts`: how many, or how much            |

`P why: option / [chosen] / option`. Certain questions aren't shown.

## Checks

One strict reader for the model's answers and the stored meals; any problem and the answer isn't
used.

- A row has exactly one of `sized_products`, `products`, `parts`; parts are food rows; a dish row
  has a name.
- `sized_products` have a unit each, `products` none; `sizes` only with `products`. Sizes and
  units are in the product's base; all products of a row have the same base.
- Every question has `why`, `chosen` and at least one option; every option has a label, labels
  differ, and `chosen` is one of them; a single option has an empty `why`.
- Counts ≥ 0, sizes and values ≥ 0 and finite; at most 8 options.

`scripts/check-meal-examples.py` checks the examples' screen form against the same rules (and
prints counts): `python3 scripts/check-meal-examples.py docs/lab-meal-examples.md`.

## What the prompt says

The rules the model must be told for the format to be used well (when to ask, where a size goes,
"none", splitting, shared food, add-ons, …), each with its reasons and examples, are in
[lab-meal-prompt.md](lab-meal-prompt.md).

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
9. **Typed amounts set aside** for now: choices and × only.

## Problems from the examples

The 1,000 examples (see [lab-meal-examples.md](lab-meal-examples.md), Problems) raised five;
all are settled without changing the format's shape:

1. **"None" as one of the kinds** (6 meals: milk none / whole / oat): a "none" product, see
   Questions, "None".
2. **One choice that should move several rows** (4 meals): **no linked questions.** Each case
   turned out to need none:
   - a combo's "make it large": fries and drink are sized separately in most places, so two size
     questions; a combo is not a dish;
   - pho bo / ga (meat and broth): pho stays whole with a kind question, since drinking more or
     less of its light broth is immaterial; the dish had been split for an immaterial question;
   - a set lunch "set B": vague input; the model's best guess from the context (history first),
     else a typical lunch; more text if that isn't enough;
   - the hot pot's broth (mala or clear makes everything pulled out oilier): one row "broth
     picked up with the food" with a kind question, mala / yuanyang / clear;
   - a thali, veg or non-veg: one row changes; a bento of unknown kind: kept whole.
3. **A dish's size scales every part** (2 meals: a large ramen would double the egg): the size
   question goes where the size changes: on the noodles ("large" in a ramen shop is more
   noodles); a dish with nothing to ask inside stays whole, a product with sizes (gyudon nami /
   ōmori / tokumori, each its own grams); a dish size only when every part grows together (a sub
   6″ / 12″, bunny chow ¼ / ½).
4. **Kinds with different bases** (2 meals: a set-menu starter, soup or escargots): everything in
   g (a soup's ml ≈ g), and when kinds differ in portion, each brings its own in
   `sized_products` (onion soup 350 g / escargots 6 pcs ≈ 120 g / terrine 100 g).
5. **A known total weight across rows** (3 meals: a weighed plate, a per-kilo buffet): the total
   stays exact. When the split matters to the values (cutlet or buckwheat), the weighed thing is
   one product with a kind question on the proportion ("mostly buckwheat / half and half /
   mostly cutlet"); otherwise rows that divide the total, and an edit to one may let the sum
   drift.

## Open questions

- **Where values come from**: today's `source` (visual, published, history): is it needed, and
  what for (showing it, linking a scanned code, history)?
- **The meal level**: `title`, `dropped`, `out_of_focus`.
- **What is sent back on an update**: the rows with my answers, and what I removed (so it doesn't
  come back).
- **The threshold**: the model's judgement, or the phone hiding questions with a small computed
  spread.
- Later: the UI, pots and home recipes, the Gemini schema for this shape.
