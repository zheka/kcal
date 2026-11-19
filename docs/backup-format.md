# Kcal backup format

The format of Kcal's backup file and of the data the app saves in the browser: `kcal 0.1.0`.

Status (2026-11-19): **agreed, apart from the open questions at the end. Not implemented
yet:** the app still writes the earlier draft of `0.1.0` (per-100 g values, `kg`, `servings`
and `cookedGrams`, local `eatenAt`, `archived`). Since no real data exists yet, `0.1.0` is
changed in place, with no migration.

## Purpose and principles

- **The backup is for restoring the app**, nothing else. It is read by the app, not by
  people. Readable data for analysis by an AI is a separate export, to be designed.
- **Consistent, straightforward, deterministic.** The same data always gives the same file,
  byte for byte, apart from `exportedAt`.
- **The storage format is separate from the structures the code works with** (see Three
  forms of the data).

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
| **Stored data**      | consistent to store | the canonical data in exactly the format of this file; the single source of truth       |
| **In-memory tables** | easy to use         | foods by id, units with exact grams, nutrients per gram, meals by day; all derived      |

- **The stored data is primary**: the one source of truth, and every other form is converted
  to it (forms, on save) or derived from it (tables, and forms opened for editing). It is:
  - **normalized**: every fact is stored once; nothing derived, duplicated or cached is stored;
  - **consistent**: checked on every change and every load, so it is always valid.
- The app keeps the stored data in memory in exactly this format; saving writes it out,
  restoring reads it in.
- **Data flows one way.** Saving a form converts what was typed into stored data; the tables
  are then recomputed from the stored data. Tables are never edited and never written back;
  opening a form to edit starts from the stored data.
- **Conversion and rounding happen in one place**: form → stored. That is where "rounded once,
  when stored" lives.
- **One integrity check**, on stored data, for form saves and imports alike; forms only give
  friendly messages first.
- **No cascading writes**: an edit changes stored data, and everything derived is recomputed.
- **Only the stored format is versioned**; forms and tables can change freely.
- **Tests** cover the three conversions (form → stored, stored → form, stored → tables) and the
  round trip stored → file → stored, byte for byte.

## General rules

- **An omitted field is undefined**: never `null`, and never 0 or any other default. Each
  record type below lists its required and optional fields.
- **No fields that nothing uses yet.** A field is added when the feature that uses it is built
  (e.g. `archived` with archiving, `weights` with weight logging).
- **Lists are always written**, as `[]` when empty: an empty list is defined, so it is not
  omitted.
- **Fields are written in alphabetical order** in every object, the document and nutrient
  values included.
- **Lists are written in a fixed order:**

  | List                   | Order                                        |
  | ---------------------- | -------------------------------------------- |
  | `goals`                | by `from`                                    |
  | `meals`                | by `eatenAt` (then `id`, if ever equal)      |
  | `products`, `recipes`  | by `id`                                      |
  | `units`, `ingredients` | as the user ordered them (the order is data) |

  Strings are compared by code unit, never by locale, so the order is the same on every device.

- **Formatting:** JSON, UTF-8, 2-space indentation, a final newline.
- **Timestamps are UTC to the millisecond**, as JavaScript's `toISOString()` writes them:
  `2026-11-17T07:30:41.512Z`. No offset or time zone is stored. Local dates and times are
  computed in the device's current time zone.
- **Ids** of products, recipes, meals and units are random UUIDs, unique in the whole file.
- **Names** are cleaned (trimmed, whitespace collapsed, Unicode NFC) and keep their case.

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
| `meals`      | yes      | logged meals                                                         |
| `products`   | yes      | products                                                             |
| `recipes`    | yes      | recipes                                                              |
| `version`    | yes      | `kcal <semver>`: marks the file as Kcal data and versions its format |

Only the format version is recorded, not the version of the app that wrote the file.

## Products

```json
{
  "id": "6f1c2a9e-0b7d-4c55-9a3e-1d2f3a4b5c6d",
  "name": "egg",
  "per1g": { "carbs": 0.007, "fat": 0.095, "kcal": 1.43, "protein": 0.126 },
  "units": [{ "grams": 60, "id": "9b2e…", "name": "piece" }]
}
```

| Field   | Required | Meaning                                                               |
| ------- | -------- | --------------------------------------------------------------------- |
| `id`    | yes      | UUID                                                                  |
| `name`  | yes      | unique among products and recipes, ignoring case                      |
| `per1g` | yes      | nutrients in 1 g; `kcal` required, an omitted nutrient is **unknown** |
| `units` | yes      | the product's own units, in the user's order; `[]` when none          |

- **Everything goes through grams.** A unit that is not really a weight (a millilitre of a
  drink, an egg of size M) gets a reasonable figure in grams, corrected later if needed: the
  error is far below the tolerances of labels.
- **Grams are built in**: every product can be measured in grams, which is not stored as a
  unit. There is no `kg`.
- **Product unit:** `grams` (positive), `id` (UUID), `name` (unique within the product,
  ignoring case; `g` is reserved, ignoring case).

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
- **Recipe unit:** `id` (UUID), `makes` (positive, decimals allowed), `name` (unique within the
  recipe, ignoring case). It means "the whole recipe makes this many of the unit": `makes 6`
  of `serving`, `makes 4` of `piece`.
- **A unit named `g`** is allowed for recipes and means grams of the finished dish:
  `makes 1600` of `g` is the weighed pot, so "350 g of soup" from the scale is right even when
  cooking changed the weight.
- Internally a recipe is measured by the sum of its ingredients in grams; that basis is
  never stored or shown. One of a unit is the sum divided by `makes`, divided last, so
  `makes` of a unit is exactly the whole recipe.
- Recipes may contain recipes; recipes that contain each other are refused.

## Meals

```json
{
  "eatenAt": "2026-11-17T07:30:41.512Z",
  "id": "0a7f…",
  "ingredients": [
    { "amount": 2, "food": "<egg id>", "unit": "<piece id>" },
    { "amount": 150, "food": "<skyr id>", "unit": "g" }
  ]
}
```

| Field         | Required | Meaning                                       |
| ------------- | -------- | --------------------------------------------- |
| `eatenAt`     | yes      | when the meal is (to be) eaten, UTC timestamp |
| `id`          | yes      | UUID                                          |
| `ingredients` | yes      | at least one (see Ingredients)                |

- A meal has nothing else: no name, no time zone.
- **Editing changes only the minute** of `eatenAt`; its seconds and milliseconds stay. A meal
  logged now gets the exact moment; a new meal with a chosen time gets that minute plus the
  current seconds and milliseconds; Eat again counts as new. So meals in the same minute are
  ordered as they were logged, without any second timestamp.
- The day a meal counts towards is its local date in the device's current time zone.

## Ingredients

The shared structure of a meal's and a recipe's ingredient list.

| Field    | Required | Meaning                                                     |
| -------- | -------- | ----------------------------------------------------------- |
| `amount` | yes      | positive (0 can't be saved)                                 |
| `food`   | yes      | id of a product or a recipe                                 |
| `unit`   | yes      | `"g"` (products only) or the id of one of that food's units |

- The same food may appear in several ingredients.

## Goals

```json
{ "from": "…", "targets": { "kcal": 2000, "protein": 150 } }
```

| Field     | Required | Meaning                                                                  |
| --------- | -------- | ------------------------------------------------------------------------ |
| `from`    | yes      | when the goals start (see Open questions)                                |
| `targets` | no       | daily target per nutrient, positive; an omitted nutrient has **no goal** |

- Without `targets`, a set means no goals from then on.
- Goal sets have no ids.
- **At most one goal set per day**: saving again on the same day replaces that day's set.
- Targets cover the nutrients. A water goal comes with water tracking.

## Numbers

- **Every stored number has a fixed precision, defined per field**, and is rounded once, when
  it is stored (round half up, computed on the decimal value so binary floats can't flip it).
- **Quantities are exact**: an amount times a unit's grams is computed in integer thousandths,
  so 100 g of a product and 4 × a 25 g unit of it are exactly the same.
- **Divisions that come from definitions are done last**: k of a recipe unit is
  whole × k / makes, so `makes` of it is exactly the whole recipe.
- Everything else is computed with ordinary floating-point numbers and rounded only for
  display.

## Integrity

Checked on every load and every import, with every problem reported and located:

- every record has its required fields and no others; values have the right types;
- ids are unique; names are clean; food names are unique (ignoring case); unit names are unique
  within their food (ignoring case); `g` is not a product unit name;
- every `food` refers to an existing product or recipe; every `unit` is `g` for a product or
  one of that food's units;
- recipes have at least one ingredient and one unit, and don't contain each other; meals have
  at least one ingredient;
- `per1g` has `kcal`; numbers are non-negative, and positive where stated (amounts, grams,
  `makes`, targets);
- timestamps are valid UTC timestamps in the form above; goal sets have strictly increasing
  `from`, at most one per day.

## Open questions

1. **Precision per field**: nutrients per 1 g (3 or 4 decimals), unit grams and amounts
   (3 proposed), `makes`, goal targets.
2. **Goals' `from`, and travelling**: a UTC timestamp, with "a day uses the last goal set
   saved before that day ended" (in the device's current time zone), or a calendar date
   (`2026-11-17`), which never shifts when viewed from another time zone. Goals belong to whole
   days, like the daily weights to come, which will have the same question.
3. **Field names**, to settle at the end (e.g. `per1g`, `makes`).
