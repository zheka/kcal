# Kcal backup format

The format of Kcal's backup file and of the data the app saves in the browser: `kcal 0.1.0`.

Status (2026-11-19): **agreed, not implemented yet.** The app still writes an earlier draft of
`0.1.0`. Since no real data exists yet, `0.1.0` is changed in place, with no migration.

## Purpose and principles

- **The backup is for restoring the app**, nothing else. It is read by the app, not by
  people. Readable data for analysis by an AI is a separate export, to be designed.
- **Consistent, straightforward, deterministic.** The same data always gives the same file,
  byte for byte, apart from `exportedAt`.
- **The storage format is separate from the structures the code works with** (see Three forms
  of the data).

## Three forms of the data

The data exists in three forms, each made for one job:

```
forms ──(save: check, convert, round)──▶ stored data ──(derive)──▶ in-memory tables
  ▲                                          │
  └────────────(open a form to edit)─────────┘
```

| Form                 | Made for            | What it holds                                                                           |
| -------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| **Forms**            | easy to enter       | text as typed, values per a label's column ("per bar"), "makes 6 servings", local times |
| **Stored data**      | consistent to store | the canonical data in exactly the format of this file                                   |
| **In-memory tables** | easy to use         | foods by id, units with exact grams, nutrients per gram, meals by day; all derived      |

- **The stored data is primary**: the one source of truth, and every other form is converted
  to it (forms, on save) or derived from it (tables, and forms opened for editing). It is:
  - **normalized**: every fact is stored once; nothing derived, duplicated or cached is stored;
  - **consistent**: checked on every change and every load, so it is always valid.
- The app keeps the stored data in memory in exactly this format; saving writes it out,
  restoring reads it in.
- **Data flows one way.** Saving a form converts what was typed into stored data; the tables
  are then recomputed from the stored data. Tables are never edited and never written back.
- **Conversion and rounding happen in one place**: form → stored.
- **One integrity check**, on stored data, for form saves and imports alike; forms only give
  friendly messages first.
- **No cascading writes**: an edit changes stored data, and everything derived is recomputed.
- **Only the stored format is versioned**; forms and tables can change freely.
- **Tests** cover the three conversions (form → stored, stored → form, stored → tables) and the
  round trip stored → file → stored, byte for byte.

## General rules

- **An omitted field is undefined**, never `null`. Each record type below lists its required
  and optional fields. For nutrient values, undefined counts as 0.
- **No fields that nothing uses yet.** A field is added when the feature that uses it is built
  (e.g. `archived` with archiving, `weights` with weight logging).
- **Lists are always written**, as `[]` when empty: an empty list is defined, so it is not
  omitted.
- **Fields are written in alphabetical order** in every object, the document and nutrient
  values included.
- **Lists are written in a fixed order:**

  | List                   | Order                                        |
  | ---------------------- | -------------------------------------------- |
  | `goals`                | by `setAt`                                   |
  | `meals`                | by `consumedAt` (then `id`, if ever equal)   |
  | `products`, `recipes`  | by `id`                                      |
  | `units`, `ingredients` | as the user ordered them (the order is data) |

  Strings are compared by code unit, never by locale, so the order is the same on every device.

- **Formatting:** JSON, UTF-8, 2-space indentation, a final newline.
- **Timestamps are UTC to the millisecond**, as JavaScript's `toISOString()` writes them:
  `2026-11-17T07:30:41.512Z`. No offset or time zone is stored; local dates and times are
  computed in the device's current time zone.
- **Ids** of products, recipes, meals and units are random UUIDs, unique in the whole file.
  Built-in foods have fixed ids (see Built-in foods).
- **Names** are cleaned (trimmed, whitespace collapsed, Unicode NFC) and keep their case.
- **Every stored number has at most 3 decimals**, rounded once, when it is stored (see
  Numbers).

## Import

- **Import replaces all data and is all-or-nothing**: a file with any problem is refused with
  the list of problems; nothing is silently fixed.
- **Order is not data**: a file whose fields or lists are in another order is accepted and
  stored in canonical order. The order of units and ingredients is taken from the file as it
  is.
- Everything else is strict: an unknown field, a missing required field, or a value that
  breaks a rule below refuses the file.
- **Version:** the app accepts its own `0.minor` with a patch up to its own; a newer file says
  "update the app", an older minor "needs an upgrade".

## Document

```json
{
  "exportedAt": "2026-11-17T19:45:03.207Z",
  "goals": [],
  "meals": [],
  "products": [],
  "recipes": [],
  "version": "kcal 0.1.0"
}
```

| Field        | Required | Meaning                                                              |
| ------------ | -------- | -------------------------------------------------------------------- |
| `exportedAt` | backups  | when the backup was written; the data saved in the browser has none  |
| `goals`      | yes      | goal sets                                                            |
| `meals`      | yes      | meals, drinks included                                               |
| `products`   | yes      | products                                                             |
| `recipes`    | yes      | recipes                                                              |
| `version`    | yes      | `kcal <semver>`: marks the file as Kcal data and versions its format |

Only the format version is recorded, not the version of the app that wrote the file.

## Nutrients

`carbs`, `fat`, `kcal`, `protein` (g; kcal) and `water` (ml; 1 g of water = 1 ml). The list
is built into the code; adding a nutrient later is a new optional field, which counts as 0
where omitted.

**Nothing is required: an omitted nutrient counts as 0.** Water is counted by the water
content of drinks (water 1 ml per g, coffee and tea about 0.99, milk about 0.88); foods omit
it.

## Products

```json
{
  "id": "6f1c2a9e-0b7d-4c55-9a3e-1d2f3a4b5c6d",
  "name": "egg",
  "perGram": { "carbs": 0.007, "fat": 0.095, "kcal": 1.43, "protein": 0.126 },
  "units": [{ "grams": 60, "id": "9b2e…", "name": "piece" }]
}
```

| Field     | Required | Meaning                                                                      |
| --------- | -------- | ---------------------------------------------------------------------------- |
| `id`      | yes      | UUID                                                                         |
| `name`    | yes      | unique among products and recipes, ignoring case; not a built-in food's name |
| `perGram` | yes      | nutrients in 1 g of the product; an omitted nutrient counts as 0             |
| `units`   | yes      | the product's own units, in the user's order; `[]` when it has none          |

- **Everything goes through grams.** A unit that is not really a weight (a millilitre of a
  drink, an egg of size M) gets a reasonable figure in grams, corrected later if needed: the
  error is far below the tolerances of labels.
- **Grams are built in**: every product can be measured in grams, which is not stored as a
  unit.
- **Product unit:**

  | Field   | Required | Meaning                                                   |
  | ------- | -------- | --------------------------------------------------------- |
  | `grams` | yes      | how many grams one of the unit weighs; positive           |
  | `id`    | yes      | UUID                                                      |
  | `name`  | yes      | unique within the product, ignoring case; `g` is reserved |

  A drink defines its own `ml` unit with its grams: coffee 1, milk 1.03, oil 0.92.

## Built-in foods

Four foods are defined in the code, not stored, and referred to by fixed ids:

| Id        | Per 1 g             | Units             |
| --------- | ------------------- | ----------------- |
| `water`   | 1 ml water          | `g`, `ml` (= 1 g) |
| `protein` | 1 g protein, 4 kcal | `g`               |
| `fat`     | 1 g fat, 9 kcal     | `g`               |
| `carbs`   | 1 g carbs, 4 kcal   | `g`               |

- They can be used in any meal or recipe like a product (`"food": "water", "unit": "ml"`), but
  they are read-only and have no custom units. A cup of your own is a recipe (330 ml of water,
  makes 1 cup) or a product with a water value.
- Their ids and names are reserved, ignoring case: no product or recipe can be called `water`,
  `protein`, `fat` or `carbs`.

## Recipes

```json
{
  "id": "91ab…",
  "ingredients": [
    { "amount": 60, "food": "<oat flakes id>", "unit": "g" },
    { "amount": 1, "food": "<milk id>", "unit": "<cup id>" }
  ],
  "name": "oats with honey",
  "units": [{ "id": "…", "makes": 1, "name": "bowl" }]
}
```

| Field         | Required | Meaning                                                                      |
| ------------- | -------- | ---------------------------------------------------------------------------- |
| `id`          | yes      | UUID                                                                         |
| `ingredients` | yes      | at least one (see Ingredients)                                               |
| `name`        | yes      | unique among products and recipes, ignoring case; not a built-in food's name |
| `units`       | yes      | at least one; how the recipe is eaten, in the user's order                   |

- **A recipe is eaten only in its own units**: there are no built-in units for recipes.
- **Recipe unit:**

  | Field   | Required | Meaning                                               |
  | ------- | -------- | ----------------------------------------------------- |
  | `id`    | yes      | UUID                                                  |
  | `makes` | yes      | how many of the unit the whole recipe makes; positive |
  | `name`  | yes      | unique within the recipe, ignoring case               |

  `makes 6` of `serving`, `makes 4` of `piece`. **A unit named `g`** is allowed for recipes and
  means grams of the finished dish: `makes 1600` of `g` is the weighed pot, so "350 g of soup"
  from the scale is right even when cooking changed the weight.

- Internally a recipe is measured by the sum of its ingredients in grams; that basis is never
  stored or shown. One of a unit is the sum divided by `makes`, divided last, so `makes` of a
  unit is exactly the whole recipe.
- Recipes may contain recipes; recipes that contain each other are refused.

## Meals

A meal is anything consumed together, drinks included: a glass of water is a meal with one
ingredient.

```json
{
  "consumedAt": "2026-11-17T07:30:41.512Z",
  "id": "0a7f…",
  "ingredients": [
    { "amount": 2, "food": "<egg id>", "unit": "<piece id>" },
    { "amount": 150, "food": "<skyr id>", "unit": "g" }
  ]
}
```

| Field         | Required | Meaning                                    |
| ------------- | -------- | ------------------------------------------ |
| `consumedAt`  | yes      | when it is (to be) consumed, UTC timestamp |
| `id`          | yes      | UUID                                       |
| `ingredients` | yes      | at least one (see Ingredients)             |

- A meal has nothing else: no name, no time zone.
- **Editing changes only the minute** of `consumedAt`; its seconds and milliseconds stay. A
  meal logged now gets the exact moment; a new meal with a chosen time gets that minute plus
  the current seconds and milliseconds; Eat again counts as new. So meals in the same minute
  are ordered as they were logged, without any second timestamp.
- The day a meal counts towards is its local date in the device's current time zone.

## Ingredients

The shared structure of a meal's and a recipe's ingredient list.

| Field    | Required | Meaning                                                                     |
| -------- | -------- | --------------------------------------------------------------------------- |
| `amount` | yes      | how many of the unit; positive (0 can't be saved)                           |
| `food`   | yes      | id of a product, a recipe or a built-in food                                |
| `unit`   | yes      | `g` (products and built-in foods), `ml` (water), or one of the food's units |

- The same food may appear in several ingredients.

## Goals

```json
{
  "perDay": { "kcal": 2000, "protein": 150, "water": 2000 },
  "setAt": "2026-11-01T18:20:05.114Z"
}
```

| Field    | Required | Meaning                                                              |
| -------- | -------- | -------------------------------------------------------------------- |
| `perDay` | no       | daily target per nutrient, positive; an omitted nutrient has no goal |
| `setAt`  | yes      | when the goals were saved, UTC timestamp                             |

- **A goal set applies from the start of the local day containing `setAt`** (in the device's
  current time zone): goals saved at 15:00 apply to the whole of that day. Each day uses the
  latest set that applies to it; days before the first set have no goals.
- **At most one goal set per local day**: saving again on the same day replaces that day's set.
- Without `perDay`, a set means no goals from that day on.
- Goal sets have no ids.

## Numbers

- **Every stored number has at most 3 decimals**, rounded once, when it is stored: round half
  up, computed on the decimal value so binary floats can't flip it.
- **Quantities are exact**: an amount times a unit's grams is computed in integer thousandths,
  so 100 g of a product and 4 × a 25 g unit of it are exactly the same.
- **Divisions that come from definitions are done last**: k of a recipe unit is
  whole × k / makes, so `makes` of it is exactly the whole recipe.
- Everything else is computed with ordinary floating-point numbers and rounded only for
  display.

## Integrity

Checked on every load and every import, with every problem reported and located:

- every record has its required fields and no others; values have the right types;
- ids are unique and don't use a built-in food's id; names are clean; food names are unique
  and not a built-in food's name (ignoring case); unit names are unique within their food
  (ignoring case); `g` is not a product unit name;
- every `food` refers to an existing product, recipe or built-in food; every `unit` is `g` for
  a product or built-in food, `ml` for water, or one of that food's units;
- recipes have at least one ingredient and one unit, and don't contain each other; meals have
  at least one ingredient;
- numbers are non-negative, positive where stated (amounts, grams, `makes`, daily targets), and
  have at most 3 decimals;
- timestamps are valid UTC timestamps in the form above; goal sets have strictly increasing
  `setAt`, at most one per local day.
