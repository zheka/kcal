# kcal backup format

The format of kcal's backup file and of the data the app saves in the browser: `kcal 0.2.0`.

Status (2026-11-20): **agreed and implemented.**

| Version | Change                                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0.1.0` | the first format                                                                                                                                                                                    |
| `0.1.1` | products may have a `barcode` (an optional field: `0.1.0` files are read as they are)                                                                                                               |
| `0.2.0` | products per g and/or per ml; no built-in foods; quick buttons in `settings`; empty lists omitted; zeros stored. Not compatible: older files are refused, and older saved data means starting fresh |

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
| **In-memory tables** | easy to use         | foods by id, units with exact amounts, nutrients per g or ml, meals by day; all derived |

- **The stored data is primary**: the one source of truth, and every other form is converted
  to it (forms, on save) or derived from it (tables, and forms opened for editing). It is:
  - **normalized**: every fact is stored once; nothing derived, duplicated or cached is stored;
  - **consistent**: checked on every change and every load, so it is always valid.
- The app keeps the stored data in memory in this format, with omitted lists and objects
  filled in as empty; saving writes it out (omitting them again), restoring reads it in.
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
  and optional fields.
- **Whatever was entered is stored; only what is empty is omitted.** Zero is a value: a
  nutrient that is 0 is stored as `0`, and an omitted nutrient is "not given" (see Nutrients).
- **An omitted list or object means empty**, and empty ones are always omitted when written;
  a file may still contain `[]` or `{}`, read as omitted. Where something must not be empty
  (a meal's ingredients, a recipe's units, a product's values), it is required, and so is
  non-empty.
- What else an omitted field means is stated with each field.
- **No fields that nothing uses yet.** A field is added when the feature that uses it is built
  (e.g. `archived` with archiving, `weights` with weight logging).
- **Fields are written in alphabetical order** in every object, the document and nutrient
  values included.
- **Lists are written in a fixed order:**

  | List                                   | Order                                        |
  | -------------------------------------- | -------------------------------------------- |
  | `goals`                                | by `setAt`                                   |
  | `meals`                                | by `consumedAt` (then `id`, if ever equal)   |
  | `products`, `recipes`                  | by `id`                                      |
  | `units`, `ingredients`, `quickButtons` | as the user ordered them (the order is data) |

  Strings are compared by code unit, never by locale, so the order is the same on every device.

- **Formatting:** JSON, UTF-8, 2-space indentation, a final newline.
- **Timestamps are UTC to the millisecond**, as JavaScript's `toISOString()` writes them:
  `2026-11-17T07:30:41.512Z`. No offset or time zone is stored; local dates and times are
  computed in the device's current time zone.
- **Ids** of products, recipes, meals and units are random UUIDs, unique in the whole file.
  Nothing has a fixed id.
- **Names and labels** are cleaned (trimmed, whitespace collapsed, Unicode NFC) and keep their
  case.
- **Every stored number has at most 3 decimals**, rounded once, when it is stored (see
  Numbers).

## Import

- **Import replaces all data and is all-or-nothing**: a file with any problem is refused with
  the list of problems; nothing is silently fixed.
- **Order is not data**: a file whose fields or lists are in another order is accepted and
  stored in canonical order. The order of units, ingredients and quick buttons is taken from
  the file as it is.
- **Empty is not data either**: `[]` and `{}` are read as omitted.
- Everything else is strict: an unknown field, a missing required field, or a value that
  breaks a rule below refuses the file.
- **Version:** the app accepts its own `0.minor` with a patch up to its own; a newer file says
  "update the app", an older minor is refused as no longer supported.

## Document

```json
{
  "exportedAt": "2026-11-17T19:45:03.207Z",
  "goals": [],
  "meals": [],
  "products": [],
  "recipes": [],
  "settings": {},
  "version": "kcal 0.2.0"
}
```

All fields are shown here; as written by the app, the empty ones are omitted.

| Field        | Required | Meaning                                                              |
| ------------ | -------- | -------------------------------------------------------------------- |
| `exportedAt` | backups  | when the backup was written; the data saved in the browser has none  |
| `goals`      | no       | goal sets                                                            |
| `meals`      | no       | meals, drinks included                                               |
| `products`   | no       | products                                                             |
| `recipes`    | no       | recipes                                                              |
| `settings`   | no       | how the app is set up (see Settings)                                 |
| `version`    | yes      | `kcal <semver>`: marks the file as kcal data and versions its format |

Only the format version is recorded, not the version of the app that wrote the file.

### A fresh start

The app starts with one product and two quick buttons, as ordinary data: nothing in the code
depends on them, and they can be edited or removed like anything else.

```json
{
  "products": [
    {
      "id": "…",
      "name": "water",
      "perG": { "carbs": 0, "fat": 0, "kcal": 0, "protein": 0, "water": 1 },
      "perMl": { "carbs": 0, "fat": 0, "kcal": 0, "protein": 0, "water": 1 }
    }
  ],
  "settings": {
    "quickButtons": [
      { "amount": 250, "food": "<water id>", "label": "💧", "unit": "ml" },
      { "label": "🍽️" }
    ]
  },
  "version": "kcal 0.2.0"
}
```

## Nutrients

`carbs`, `fat`, `kcal`, `protein` (g; kcal) and `water` (ml). The list is built into the code;
adding a nutrient later is a new optional field.

- **A nutrient that is 0 is stored as `0`**: salt is
  `{ "carbs": 0, "fat": 0, "kcal": 0, "protein": 0, "water": 0 }`.
- **An omitted nutrient is not given**: the label (or Open Food Facts) didn't say. For now it
  counts as 0 in every total; because the data tells "zero" from "not given", totals can later
  show that they are incomplete without a format change.
- Water is mostly not on labels; drinks give it (water 1 ml per ml, coffee and tea about 0.99,
  milk about 0.88).

## Products

```json
{
  "id": "6f1c2a9e-0b7d-4c55-9a3e-1d2f3a4b5c6d",
  "name": "egg",
  "perG": { "carbs": 0.007, "fat": 0.095, "kcal": 1.43, "protein": 0.126 },
  "units": [{ "g": 60, "id": "9b2e…", "name": "piece" }]
}
```

```json
{
  "id": "…",
  "name": "milk 1.5 %",
  "perMl": { "carbs": 0.049, "fat": 0.015, "kcal": 0.47, "protein": 0.034, "water": 0.88 },
  "units": [{ "id": "…", "ml": 250, "name": "cup" }]
}
```

| Field     | Required  | Meaning                                                                |
| --------- | --------- | ---------------------------------------------------------------------- |
| `barcode` | no        | the barcode it was scanned with: 8 to 14 digits, unique among products |
| `id`      | yes       | UUID                                                                   |
| `name`    | yes       | unique among products and recipes, ignoring case                       |
| `perG`    | see below | nutrients in 1 g; present when the product can be weighed              |
| `perMl`   | see below | nutrients in 1 ml; present when the product can be measured in ml      |
| `units`   | no        | the product's own units, in the user's order                           |

- **A product has `perG`, `perMl` or both**, at least one, each with at least one nutrient.
  Each present one is a base the product can be measured in: `g` and `ml` are built in, not
  stored as units. A base exists because values were entered for it: an empty set of values
  is never stored.
- **The two are independent**: an amount in g uses `perG`, an amount in ml uses `perMl`, and
  nothing converts between them. A product with both (a label that prints both columns, milk
  you sometimes weigh and sometimes pour) has two sets of values that aren't checked against
  each other. A strict conversion (a density) may come later, as a new field.
- **Product unit:** in exactly one base, one the product has.

  | Field  | Required | Meaning                                                             |
  | ------ | -------- | ------------------------------------------------------------------- |
  | `g`    | one of   | how many grams one of the unit weighs; positive                     |
  | `id`   | yes      | UUID                                                                |
  | `ml`   | one of   | how many ml one of the unit holds; positive                         |
  | `name` | yes      | unique within the product, ignoring case; `g` and `ml` are reserved |

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

| Field         | Required | Meaning                                                    |
| ------------- | -------- | ---------------------------------------------------------- |
| `id`          | yes      | UUID                                                       |
| `ingredients` | yes      | at least one (see Ingredients)                             |
| `name`        | yes      | unique among products and recipes, ignoring case           |
| `units`       | yes      | at least one; how the recipe is eaten, in the user's order |

- **A recipe is eaten only in its own units**: there are no built-in units for recipes.
- **Recipe unit:**

  | Field   | Required | Meaning                                               |
  | ------- | -------- | ----------------------------------------------------- |
  | `id`    | yes      | UUID                                                  |
  | `makes` | yes      | how many of the unit the whole recipe makes; positive |
  | `name`  | yes      | unique within the recipe, ignoring case               |

  `makes 6` of `serving`, `makes 4` of `piece`. **A unit named `g`** (or `ml`) is allowed for
  recipes and is just a name: `makes 1600` of `g` is the weighed pot, so "350 g of soup" from
  the scale is right even when cooking changed the weight.

- **A recipe's nutrients are the sum of its ingredients'**; one of a unit is that sum divided
  by `makes`, divided last, so `makes` of a unit is exactly the whole recipe. A recipe has no
  weight or volume of its own: ingredients in g and in ml mix freely.
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

| Field    | Required | Meaning                                                                         |
| -------- | -------- | ------------------------------------------------------------------------------- |
| `amount` | yes      | how many of the unit; positive (0 can't be saved)                               |
| `food`   | yes      | id of a product or a recipe                                                     |
| `unit`   | yes      | `g` or `ml` for a product with `perG` or `perMl`, or the id of one of its units |

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
  This is a rule of saving, not of the integrity check: which day a timestamp falls on depends
  on the device's time zone, so a check of it would not be deterministic.
- Without `perDay`, a set means no goals from that day on.
- Goal sets have no ids.

## Settings

How the app is set up: configuration that belongs with the data (it refers to foods), so it is
backed up and restored with it. Preferences that are only about one device are not stored
here. Each setting is an optional field.

| Field          | Required | Meaning                                                         |
| -------------- | -------- | --------------------------------------------------------------- |
| `quickButtons` | no       | the day screen's buttons that start a meal, in the user's order |

### Quick buttons

```json
"quickButtons": [
  { "amount": 250, "food": "<water id>", "label": "💧", "unit": "ml" },
  { "amount": 1, "food": "<coffee id>", "label": "☕", "unit": "<cup id>" },
  { "label": "🍽️" }
]
```

| Field    | Required    | Meaning                                                              |
| -------- | ----------- | -------------------------------------------------------------------- |
| `amount` | with `food` | as in an ingredient                                                  |
| `food`   | no          | id of a product or a recipe                                          |
| `label`  | yes         | what the button shows: an emoji or a short text, up to 12 characters |
| `unit`   | with `food` | as in an ingredient                                                  |

- **A button opens a new meal**: with a food, the meal starts with that food and amount;
  without one, it starts empty. The meal is saved only from the composer, as any new meal.
- `food`, `amount` and `unit` are all present or all omitted, and follow the rules of an
  ingredient.
- A label's length is counted in characters as seen (grapheme clusters): `💧` and a flag are
  one each.
- A food used by a button counts as used: it can't be deleted.
- No button is required: without one that has no food, the day screen has no plain "eat"
  button.

## Numbers

- **Every stored number has at most 3 decimals**, rounded once, when it is stored: round half
  up, computed on the decimal value so binary floats can't flip it. A value converted from a
  label's column that rounds to 0 is stored as `0`.
- **Quantities are exact**: an amount times a unit's g or ml is computed in integer
  thousandths, so 100 g of a product and 4 × a 25 g unit of it are exactly the same.
- **Divisions that come from definitions are done last**: k of a recipe unit is
  whole × k / makes, so `makes` of it is exactly the whole recipe.
- Everything else is computed with ordinary floating-point numbers and rounded only for
  display.

## Integrity

Checked on every load and every import, with every problem reported and located:

- every record has its required fields and no others; values have the right types;
- ids are unique; names and labels are clean; food names are unique (ignoring case); unit
  names are unique within their food (ignoring case); `g` and `ml` are not product unit names;
  labels are at most 12 characters;
- a product has `perG`, `perMl` or both, each with at least one nutrient; each of its units
  has exactly one of `g` and `ml`, for a base the product has;
- every `food` refers to an existing product or recipe; every `unit` is `g` or `ml` for a
  product with that base, or one of that food's units;
- a quick button has `food`, `amount` and `unit` all together or none of them;
- recipes have at least one ingredient and one unit, and don't contain each other; meals have
  at least one ingredient;
- numbers are non-negative, positive where stated (amounts, g and ml of units, `makes`, daily
  targets), and have at most 3 decimals;
- timestamps are valid UTC timestamps in the form above; goal sets have strictly increasing
  `setAt`.
