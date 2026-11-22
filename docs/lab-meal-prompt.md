# The lab: what the model must be told

What the model's instructions (the prompt and its examples) must say for the format of
[lab-meal-format.md](lab-meal-format.md) to be used well: what we learned writing 1,000 meals in it
([lab-meal-examples.md](lab-meal-examples.md), referred to as #N) and discussing their problems.
The format makes a wrong shape impossible or rejected; these rules are about choosing the right
shape and the right questions, which the format can't check.

Status (2026-11-22): **agreed in discussion; the prompt itself is not written yet.** Prompt v3
(`src/lab/composer/prompt-v3.txt`) has some of these rules for the old `parameters`.

Examples are in the screen form (see lab-meal-format.md, The screen form): `U` a kind with its own
size, `P` a kind, `S` a size, `C` a count; `[chosen]`; certain questions aren't shown.

## Rules

### 1. Make a best guess, always

Every answer is a complete meal: every row has its products (or parts), its size and its count, each
with the model's best guess chosen. A doubt never leaves a gap, and the model never asks in prose.
Vague input gets a best guess from the context: a matching past meal first, otherwise a typical
dish; if that isn't precise enough, I add text and the next update replaces the guess.

```
"business lunch, set B" (no photo, no history):
- Business lunch, average — 1
```

Not: questions invented to cover missing information ("set: soup + main + salad / soup + main +
dessert") when nothing tells which set B is. With a past meal named that way, its rows are
reused.

### 2. Ask only what I know better than the photo

A question is for a doubt I can settle with a tap: what I ordered, cooked or tasted; what was
inside; how many I ate; the size I ordered; what I added; how much I ate of a shared or served
thing. Not grams I can't know either.

```
- Pork-beef pelmeni — 20 pcs
  P filling: [pork-beef] / chicken          ← I know what I bought
  C count: 15 / [20] / 25                    ← I counted while eating
```

Not: "potatoes: 180 / 200 / 220 g" — I don't know grams. For loose food I know the portion, not
its weight, so the labels say it: "маленькая / обычная / большая" (#128).

From a photo the model's doubts are of three kinds, and so are the questions:

| Doubt                                                      | Question             |
| ---------------------------------------------------------- | -------------------- |
| what it is: look-alikes, a hidden filling, how it was made | `P` or `U` (a kind)  |
| how big: a menu size, a portion with no names              | `S`, or `C` in grams |
| how many: counting pieces                                  | `C`                  |

### 3. Ask only what matters

A doubt worth a question changes the meal by roughly 80+ kcal or 10+ g protein between its
options. Anything smaller is one option, the best guess, with no question. The threshold is
measured at the row's amount: 150 g of grilled vegetables "with or without oil" is about 70 kcal,
not worth asking (#49); 10 g of parmesan neither (#128).

### 4. The threshold applies to splitting too

Split a dish into parts only as far as needed to place material questions; a dish kept whole keeps
its kind and its parts together.

```
- Pho bo tái — 1 bowl
  P pho: [bo tái (rare beef)] / bo chín (brisket) / bo viên (meatballs) / ga (chicken)
  S bowl: small / [regular] / large
```

Not: pho split into noodles, meat and broth to ask "how much broth did you drink": pho broth is
light, half a bowl is ~30 kcal. Split, the kind "bo / ga" would have to change the meat and the
broth at once, which no question can (#371). A rich broth is different: tonkotsu ramen's broth is
~300 kcal, so "drank: a little / half / all" is worth a part (#327).

### 5. The size comes with the kind, or it is a choice of its own

Decide first, before writing options:

- **The size comes with the kind** (a café has one croissant of each kind; an almond one is
  bigger): `U`, each kind with its size; no size question.
- **The size is chosen on its own** (a menu's sizes, a glass, a pizza's diameter), the same for
  every kind: `P` without sizes, and `S`.
- **Loose food** (rice, soup, salad): `P`, no size; the count is the amount in g or ml.

```
- Croissant — 1
  U kind: [plain, 60 g] / almond, 90 g / pain au chocolat, 70 g

- Latte — 1
  P milk: [2 %] / whole / oat / skim
  S size: tall / [grande] / venti
```

`U` is easy to miss when a kind comes in its own pour or portion:

```
- Red wine toasts — 3
  U drink: [red wine, 100 ml] / brandy, 30 ml        (#531)
- Fröccs — 2
  U mix: [kisfröccs, 200 ml] / nagyfröccs, 300 ml    (#537)
- French onion soup — 1
  U starter: [onion soup, 350 g] / escargots, 6 pcs, 120 g / terrine, 100 g   (#502)
```

A kind with its own size and also an independent size choice doesn't happen: where a size choice
exists for some kinds only, it is one `U` question of the real combinations ("эспрессо / латте M /
латте L"; po'boy "shrimp full / shrimp half / roast beef full / roast beef half", #774).

### 6. One base per row: in g when in doubt

All products of a row share a base. When kinds would differ (soup in ml, fried lagman in g; a
set-menu starter that is soup or escargots), everything is in g: a soup's ml ≈ g (#40, #502).

### 7. Questions are independent

Any combination of answers must be valid and mean what its labels say:

- **count** is always independent: 8 meatballs stay 8 whether chicken or pork;
- **size** is either part of the kind (`U`) or its own question (`S`), never both;
- **two doubts about the kind of one food**: when they depend on each other, one question of the
  real combinations; when they are independent, split the food into parts, one kind on each.

```
- Fried pirozhok with meat — 2 pcs
  U kind: [fried, meat, 80 g] / fried, cabbage, 80 g / baked, meat, 70 g / baked, cabbage, 70 g   (#15)

- Döner ×1                                                                              (#61)
  - Bread — 1
    U kind: [bread, 120 g] / dürüm wrap, 90 g / box (no bread), 0 g
  - Döner meat — 120 g
    P meat: [veal] / chicken
```

### 8. A size question goes where the size changes

A dish's size (`S` on a dish row) multiplies every part, so it fits only dishes whose parts all
grow together: a sub 6″ / 12″, bunny chow ¼ / ½ loaf, a poke bowl regular / large.

- When "large" means more of one part, the size is on that part: a large ramen is more noodles,
  not two eggs (#327).
- A dish with nothing to ask inside stays whole, a product whose sizes are its own grams: gyudon
  nami 380 g / ōmori 500 g / tokumori 650 g (#329).
- A combo is not a dish: fries and a drink keep their own size questions, as they're usually
  chosen separately (#406, #565).

```
- Tonkotsu ramen ×1
  - Noodles — 150 g
    S portion: [regular 150 g] / large 225 g
  - Chashu — 2 slices
  - Ajitama egg — 1
  - Broth — 400 ml
    C drank: a little / [half] / all
```

### 9. A menu size that is a number of pieces is a count

"6 or 12 escargots", IKEA's 10 / 15 / 20 meatballs, "mala / velika porcija" of ćevapi (5 / 10)
are counts, not sizes: the number is the answer (#96, #880, #214).

```
- Köttbullar — 15
  C plate: 10 / [15] / 20
```

### 10. "None" is an answer

- **A kind can be "none"**: a product with all values 0 (water included), named so ("Без
  молока"), labelled "нет"; in `U`, with size 0. One question, the way I'd answer it (#885,
  #175, #431, #566):

  ```
  - Milk — 30 ml
    P milk: none / [whole] / oat / skim
    C milk: splash 15 ml / [usual 30 ml] / a lot 60 ml
  ```

  When "none" is chosen, the phone hides the row's other questions.

- **A count can be 0**: "no bun", "cup or cone", "burrito or bowl" are a 0 for that part (#407,
  #416). A row whose likely answer is "none" but which is worth asking has 0 chosen: the oil
  bottle on the table, the bread basket (#90, #898).
- **Never a confident 0**: a row that certainly isn't there isn't a row.

### 11. Labels are what I'd say

- Every option has a short label, the chip; `chosen` copies one.
- For a count, the number when that's how I'd say it ("8"), words when they say it better:
  "нет", "½", "всё", "немного / порция / много" (my share, a sauce), "маленькая / обычная /
  большая" (loose food).
- For a size, the menu's name ("grande", "0.5", "30 см", "nami"); with no names, relative words
  ("обычный / большой").
- For a kind, the difference only ("куриные", not "куриные тефтели").
- In the answer language.
- Order: natural where there is one (sizes small → large, counts ascending, sugar 0 → 100 %),
  otherwise most likely first.
- Usually 2–3 options; more only when they really exist (a menu's sizes, a dish's usual fillings),
  up to 5–6. A long list is the model hedging.

### 12. Names: what's certain, in full

- A product's `name` is its full name ("Куриные тефтели"); picking another kind swaps the name too.
- A dish's name is what's certain about it: "Тако" when its filling is a question, and the part
  shows the rest ("Мясо аль пастор"); "Тако с карнитас" when nothing is in doubt.
- A dish whose identity is in doubt stays whole: a product with kinds, not a dish.

### 13. Amounts are what is eaten

The amount excludes what isn't eaten: bones, shells, peel, pits, husks and leaves, khinkali tops,
ice. A whole fish, ribs, wings, mussels in shells: the edible part (#86, #55, #410). A drink with
ice: the liquid; with water (rakı, iced coffee), the drink, not the glass (#519).

A weight I give with the inedible part is a product named that way, with values as weighed: "T-bone,
raw with bone, 250 g" (#497).

### 14. Shared food: my share

A shared dish is a row of my share, never "⅓ of the platter of dishes". A count question asks it
when it's in doubt (#28, #49, #141, #229).

```
- Pork neck khorovats — 250 g
  C my share: a little 150 g / [portion 250 g] / a lot 350 g
```

### 15. Lump or drop small things

Many small things of similar weight in the meal are one row: banchan, mezze, garnish, a tasting
menu's courses, conveyor-belt sushi plates, dim sum baskets (#524, #572, #594, #821). Garnish and
condiments under the threshold are dropped (salsa, lime, herbs; #451).

### 16. Stated amounts are certain

An amount I state ("150 g chicken", "2 scoops") or a label gives (a scanned product, a receipt's
weight) has no question (#19, #113, #443). The model may still ask what I didn't say: which part of a
scanned pack I ate (#887).

### 17. Partly eaten or drunk: a row of its own

Something I may have left, drunk partly or eaten from a shared bowl is a row or part of its own,
so its count can ask how much: a rich broth, a dip, syrup in the bowl, leche de tigre, the chocolate
for churros (#144, #266, #392, #465).

```
- Gulab jamun — 2
- Syrup from the bowl — 15 g
  C syrup: none / [a little] / all
```

Food left on the plate is a count with fractions ("½ / ¾ / всё", #83, #134).

### 18. Add-ons are rows

An add-on is a row of its own, with 0 as an option: syrup in a latte, sugar in tea, an extra shot,
a sauce cup, whipped cream (#341, #433, #886). A count on the drink's row would count drinks.

When the drink or dish comes several times, the add-on goes with it in a dish, so it is per
serving:

```
- Tea with sugar ×3                                                  (#211)
  C glasses: 2 / [3] / 5
  - Tea — 100 ml
  - Sugar cubes — 1
    C cubes: none / [1] / 2
```

### 19. Cooking fat is part of the dish; how much of it is a kind

Frying oil, butter in the mash, coconut milk in a curry are folded into the dish's values. When the
amount is in doubt and material, it's a kind: "мало масла / обычно / жирно" (#6, #92, #115). Fat or
sauce I add myself is a row (oil from the table bottle, butter on bread; #116, #122).

### 20. An invisible influence is a row, asked in terms I know

When something changes many rows at once and I know it by name, it becomes one row with a kind
question in my terms, instead of a question on every row:

```
- Broth picked up with the food — 1 portion                         (#296, #527)
  P broth: [mala] / yuanyang (half and half) / clear
```

I know which broth I ordered, not how many grams of oil came out with the food; the kinds carry
the oil. When the photo shows the broth, no question.

### 21. Separate what can be told apart

Different pieces, meats or fillings that the photo (or I) can tell apart are separate rows: a
carvery plate with two meats, mixed chicken pieces, dumplings of two fillings, different drinks
over an evening (#423, #595, #915, #640). One row with a kind question only when they can't be told
apart.

### 22. "Seconds" and refills are the same count

More of the same is the count, not a second question: "порция / с добавкой" (#543, #876). Refills
(rice, sambar, soda, kaedama) are counts in servings, asked only where they matter, not on every
bowl of a thali (#530).

### 23. A weighed total stays exact

A total weight I give (a weighed plate, a per-kilo buffet, a box by weight) stays exact. When how it
splits matters to the values, the weighed thing is one product with a kind question on the
proportion; otherwise rows that divide the total, or one product with no question (#8, #470,
#762).

```
- Buckwheat with a pork cutlet — 350 g
  P proportion: mostly buckwheat / [half and half] / mostly cutlet
```

### 24. A dish only where it helps

Most meals are rows of foods (916 of 1,000 had no dish). A dish is for:

- a repeated assembly with questions inside: toasts ×2, tacos ×4, tea with sugar ×3;
- a food whose parts carry material questions: a burrito's fillings, a shawarma's sauce, a rich
  ramen's broth;
- a meal described part by part in text ("omelette: 3 eggs, 50 ml milk, 10 g butter").

Not for trays, thalis, bentos or buffet plates: those are the meal itself. Never a dish in a dish.

## Examples for the prompt

Short examples teach more than rules; one for each typical case, in the answer language:

1. a kind (meatballs: pork-beef / chicken) with a count;
2. a kind with its own size (`U`: croissant plain / almond);
3. a menu size with a kind (latte: milk, tall / grande / venti);
4. "none" as a kind (milk: none / whole / oat);
5. a count with 0 (oil from the table: none / 10 / 20 ml);
6. a dish with a part partly eaten (ramen: noodles with a size, broth "drank");
7. a repeated assembly (tea with sugar ×3);
8. shared food (my share of a platter);
9. a certain meal from text (no questions);
10. vague input (a best guess, no questions).
