# Kcal design

High-level design of Kcal, a personal nutrition tracker.

Status (2026-11-17): **UX agreed at a high level.** Items marked _(proposal)_ are suggestions
not discussed yet; Open questions lists what is still undecided. Technical details come
after the UX.

## Goals and principles

- **Purpose.** Hit daily nutrition goals (kcal, protein, other macros) by composing each meal
  against them: while putting a meal together I see how balanced it is and how it moves the
  day towards its goals.
- **The meal is the unit of logging.** A meal is composed (products and recipes with amounts),
  adjusted until it fits, and saved as one logged entry. It is usually saved **before** it is
  eaten: composing a meal is the planning, there is no separate plan.
- **Personal tool first.** Built for my own use. Friendliness to new users is secondary.
- **Own product library, not a global database.** I eat a limited, repeating set of products
  and recipes. Entering a product once from its label is fine.
- **Natural amounts.** Amounts are entered in the unit that is convenient for that product:
  grams, millilitres, pieces, cups, spoons, servings.
- **Offline-first, serverless.** A PWA hosted as static files; all data on the device.
- **Data stays easy to inspect, back up, and fix with scripts.** One versioned JSON document,
  strict import.

## Concepts

| Concept      | Meaning                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| **Nutrient** | a quantity in food: `kcal`, `protein`, `fat`, `carbs`                       |
| **Product**  | something with nutrients per 100 g, from its label                          |
| **Recipe**   | products (and recipes) with amounts; usable everywhere a product is         |
| **Unit**     | a way to measure a food, defined in grams: `piece`, `ml`, `cup`, `serving`… |
| **Meal**     | a logged entry: foods taken together, at a date and time                    |
| **Water**    | plain water I drink, logged separately from meals, in ml                    |
| **Goals**    | daily targets per nutrient                                                  |
| **Weight**   | my body weight, at most one value per day                                   |

"Food" below means a product or a recipe: wherever one can be used, so can the other.

### Nutrients

- `kcal`, `protein`, `fat`, `carbs` (g). The list is **built into the code**
  (`src/config.ts`), so adding `fiber` or `sugar` later is a config change plus an optional
  field.
- Water is **not a nutrient**: it is tracked on its own (see Water).
- `kcal` comes **from the label**, not from the macros (labels round and use other factors).

### Products

- **Grams are the only base.** Every product stores its nutrients **per 100 g**, and every
  amount is converted to grams for calculation.
- **All other units are defined by hand, per product**, as grams: `piece = 60 g`,
  `ml = 1.03 g` (milk), `cup = 250 g` (my mug of milk), `scoop = 30 g`. No standard volume
  units are built in: "cup" means whatever my cup holds of that product.

  ```json
  {
    "name": "egg",
    "per100g": { "kcal": 143, "protein": 12.6, "fat": 9.5, "carbs": 0.7 },
    "units": [{ "name": "piece", "grams": 60 }]
  }
  ```

- **Units belong to their food** (agreed): they are stored inside the product (or recipe)
  and mean nothing outside it ("cup" of oats ≠ "cup" of milk). Nothing about units is shared
  between foods except, as a typing aid, their names.
- **Built-in measurement units** are the exception: fixed conversions defined in the code,
  available for every food and never stored: `g` (the base) and `kg` = 1000 g. `ml` is
  **not** built in, since grams per ml depend on the product: it is a product unit like any
  other.
- **Every food can always be measured in `g` (and `kg`).**
- The **last unit and amount used** for a food are preselected the next time.
- **Nutrients can be entered and shown per any unit** of the product (agreed in principle):
  the product form has its units section right away, and the nutrient values are entered
  "per [100 g ▾]", where the selector also offers the product's units (`per bar` = 45 g,
  `per ml`…). So a label's per-serving or per-100-ml column is copied as printed, and the app
  converts. Internally a single scale is stored (per gram or per 100 g, a technical detail),
  and everything else is computed from it.
- **Unknown values are allowed** (agreed in principle; details to discuss): a nutrient left
  empty is **unknown**, not 0. Totals and the chart show when they include unknowns (e.g. a
  marker on the bar: "1 food without fat"), so the numbers never silently understate.
  _(proposal: kcal is required; protein, fat, carbs may be unknown.)_
- _(proposal)_ A soft warning when kcal and `4·P + 4·C + 9·F` differ by more than ~15%
  (catches typos like 25 for 2.5); it never blocks saving.
- Amounts are decimals (`0.5 cup`); no fractions.
- **Units are defined in two places** (agreed): in the product form (a units section:
  name + grams), and **on the fly in the composer**: the unit selector lists `g`, the food's
  units and **＋ new unit…**, which asks for a name and its grams, saves the unit on the food
  and selects it. _(proposal: the new-unit form offers names already used on other foods as
  chips, to keep names consistent.)_
- Grams are measured with a kitchen scale, so `g` is the everyday unit; other units are a
  convenience for things not worth weighing (an egg, a slice, my mug).

### Recipes

- A recipe lists **ingredients**: a food (product or recipe) + amount + unit, like a meal.
  "Oats with honey" = 60 g oats + 200 ml milk + 1 tsp honey.
- Its **total weight** is the sum of its ingredients in grams (every unit is defined in
  grams, so this is exact). It can be overridden by the weighed cooked weight, for dishes that
  lose water while cooking (soups, stews).
- Its **units**: `g` (of the finished dish), plus `serving` when the recipe says how many
  servings it makes (e.g. "oats with honey" makes 1 serving, so `1 serving` = the whole bowl),
  plus any custom unit (`bowl = 350 g`).
- Its nutrients per 100 g are **computed** from the ingredients, never typed.
- **Recipes are for things prepared as one dish**, not for repeating meals.
- **Recipes can contain recipes**: `oats` (oats + water, cooked), `oats with honey` (oats +
  honey), `oats with banana` (oats + banana). Cycles are refused.

### Meals

A meal is the logged entry: a group of products and recipes **taken together**, at a date
and time. It has no name; a standalone snack or a single product is a meal too.

```json
{
  "id": "6f1c…",
  "eatenAt": "2026-11-17T08:30",
  "ingredients": [
    { "food": "oats with honey", "amount": 1, "unit": "serving" },
    { "food": "egg", "amount": 2, "unit": "piece" }
  ]
}
```

- Meals are **live** (see Editing foods): their nutrients are computed from the current
  foods, not stored. (How a meal refers to a food is a technical detail; names are shown
  here for readability.)
- **No name.** An optional free-text name may be added later if a need shows up; nothing
  depends on it.
- **Date and time** (agreed): set in the meal composer with a date-time control. It defaults
  to **now** when the composer is opened from today, and to a time on that day when opened
  from another day: one minute after that day's last meal, or 12:00 if it has none. The
  date decides which day the meal counts towards; the time orders the meals within the day.
  It is the time the meal is (or will be) eaten, so it can be in the future.

### Goals

Agreed:

- **One daily target per nutrient**, and only for the nutrients I care about (likely `kcal`,
  `protein`, and water). Nutrients without a goal are counted and shown, just not compared with
  anything.
- **Goals change over time, simply by editing them** (agreed). There is one "my goals" form;
  saving it makes the new goals **effective from today** (the day of the edit), and the old
  ones stay valid for the days before. No start dates to enter, no past or future dates. A
  day is judged by the goals valid on that day, so changing goals never re-judges the past.
  The history of goals is kept, so past data can later be analysed to suggest better goals.
- **Old goals are explicit** when viewing a past day whose goals differ from the current
  ones: the chart says so _(proposal: a small "goals of 2026-11-01: 2000 kcal…" note under the
  chart)_.
- **Days before the first goals** show plain amounts, without goal lines.
- Goals change a few times a year: the goals form lives in the menu.
- **Nutrients without a goal are still shown** (agreed), e.g. to see the balance of protein,
  fat and carbs in the diet: **the chart has a bar for every nutrient** (agreed), plus the
  macro split as shares of the energy, e.g. `P 30% · F 30% · C 40%`.
- Goals are **daily only**. Weekly and monthly averages are reports over the daily data, to
  add later, not goals.
- **Direction** (whether going over is bad, like kcal, or fine, like protein) only changes
  how the chart colours a bar. Added if cheap, as an optional property of a goal; not needed
  for v1.

```json
"goals": [
  { "from": "2026-11-01", "targets": { "kcal": 2000, "protein": 150, "water": 2500 } },
  { "from": "2027-01-15", "targets": { "kcal": 2200, "protein": 160, "water": 2500 } }
]
```

(`from` is the day the goals form was saved; it is never entered by hand.)

### Weight

Agreed:

- A **daily body weight**: at most one value per day (kg, one decimal); entering it again
  replaces it. Days without a weight are simply gaps.
- **Logged from the day screen**: a small weight button near the date that **shows the last
  weight** ("78.4 kg") and opens a number field prefilled with it, for the day on screen.
- **Weight charts belong to the Stats screen** (see Screens), with the weekly, monthly and
  yearly reports. _(proposal: daily points plus a trend line, e.g. a 7-day moving average,
  since daily weight jumps with water and food.)_
- **No built-in linking** of weight with kcal (no estimated burn, no goal suggestions): deeper
  analysis is done by exporting the data to an AI. So the export must carry everything:
  meals, foods, goals history and weights.

```json
"weights": [{ "date": "2026-11-17", "kg": 78.4 }]
```

### Water

Agreed:

- **Drinks are products.** Coffee, tea, milk, juice are products like any other, logged in
  meals, counting towards kcal and macros.
- **Water is tracked separately**: plain water I drink, in ml, with its own daily goal and its
  own bar in the day chart. It does not come from products: neither foods nor other drinks
  add to it. _(Assumption to confirm: coffee and tea do not count as water.)_
- Logged on its own, with a **＋ Water** button on the day screen, next to **＋ Eat**.
- **Not in the first prototype.** Details (one-tap amounts such as a glass, how water entries
  show in the day list) are decided when it is built.

### Editing foods: everything is live

Agreed:

- **Meals and recipes store only food + amount + unit.** All numbers are always computed from
  the current library: a recipe from its ingredients (all the way down), a meal from its
  foods.
- So **editing a food changes everything that uses it**: past meals, recipes, recipes that
  contain those recipes. That is what an edit is for: **a correction** (a typo, a better
  weight for a unit, a fixed recipe). Changing `oats` changes `oats with honey` and every
  meal with either.
- **When a food really changes** (a new recipe from the manufacturer, chili cooked with more
  beans, a different cup), it is a **new food** (or a **new unit**), and the past keeps the
  old one.
- **The UI makes the difference explicit.** Editing a food that is used says what it will
  change ("used in 14 meals and 2 recipes; saving changes them too"). Next to **Edit** there
  is **Copy as new**: a new food prefilled from this one, to change and save under a new name.
  _(proposal: Copy as new offers to archive the old food, so the chips show only the new one.)_
- The same holds for units: changing a unit's grams corrects every use; a different cup is a
  new unit.
- Foods that are used can be archived, never deleted.

## Screens

### Day (the main screen)

**The whole day fits on one phone screen** (agreed): the day chart plus 5–6 meals (snacks
included) and water, without scrolling. The target phone is a **Pixel 8a** (412 × 915 CSS px);
layouts are checked with screenshots at that size.

- **The main actions stay at the bottom**, within thumb reach: ＋ Eat on the day screen,
  Save/Cancel/… in the composer and the forms (a bar that stays in view while the screen
  scrolls).

- The **same chart as in the meal composer**, without a meal being edited: taken vs the
  daily goal for each nutrient that has one.
- The **day's meals**, **newest first** (the meal just logged sits right under the chart).
  A meal row is **compact** and shows **no
  ingredients**: its time and its totals, either as numbers (`690 kcal · 48 g protein`) or as
  a small inline chart of its share of each goal _(to decide when designing the screen)_.
- A small **edit icon** on the right of a meal row opens it in the meal composer (edit mode),
  which also offers **Eat again** and **Delete** (two-tap). _(What tapping the row itself does,
  if anything, is open.)_
- **＋ Eat** opens the composer for the day on screen (see the meal time defaults); **＋ Water**
  logs water (see Water).
- A small **weight button** near the date, showing the last weight; tapping it logs the
  day's weight (see Weight).
- **Other days**: small ‹ › arrows next to the date, in the header bar. No swiping: going
  back is rare. Moving between days replaces the screen, so the back button leaves the day
  rather than stepping through days. Today is `#/`, other days `#/day/YYYY-MM-DD`. A date
  picker may be added to the menu.
- _(proposal)_ Library, goals and backup are reached from a menu.

### Meal composer

Where the planning happens.

- A list of ingredients, each with an amount and a unit, and its nutrients.
- **Finding a food** (agreed): a text field with a row of chips (one line, scrolling
  sideways); typing filters the chips, ignoring case. Products and recipes are in the same
  list. _(proposal: chips ordered by recency, most recently used first.)_
- **Added inline** (agreed): tapping a food adds it to the ingredient list at once, with its
  last-used unit and amount prefilled. Amounts are adjusted right there in the list while the
  chart updates, so a whole meal can be added first and tuned after.
- **Amount** is typed (numeric keypad). **Unit** is a selector of the food's units (`g` plus
  its own, e.g. `piece`, `cup`).
- **One line per ingredient**: name with its kcal below, amount, unit, remove.
- Ingredients can be removed from the list.
- **The day's chart is the guidance** (agreed). **One bar per nutrient, all of them**, in three
  parts from the bottom: **faded** = already taken today (other meals of the day), **bright**
  = this meal, **empty** = what remains to reach the goal. Updated on every change, so adding
  an ingredient or changing an amount shows at once how the meal moves the day. No per-meal
  target and no suggestions: I judge the meal's size myself.
- **Built so:** vertical bars side by side, each in its nutrient's colour, labelled with its
  numbers (`1200 + 690` over `/ 2000`). A total with unknown values shows `≥`.
- **Bars of the same unit share one scale** (agreed), so equal amounts are equally high: 10 g
  of protein is as high as 10 g of fat. The full height of the gram bars is the largest goal
  or total among protein, fat and carbs; kcal has its own scale, set apart by a thin divider.
  Going over a goal: the bar passes its goal line, and the numbers turn red.
- A nutrient **without a goal** has a bar too, with a dashed outline and no goal line
  (`46`, `g · no goal`). Under the bars, the macro split (`P 30% · F 30% · C 40% of energy`,
  from 4/9/4 kcal per gram).
- The chart stays at the top of the composer while the ingredients scroll, with a line of
  the meal's own totals (`This meal: 690 kcal · 48 g protein · …`).
- **Save** logs the meal. Cancel discards it.
- **Eat again** (agreed): open any past meal and press **Eat again**; the composer opens with a
  copy of its ingredients and amounts as a new meal for **now**, to adjust and save. This is how
  repeated meals are logged; there are no meal templates or recent-meal chips (a meal has no
  name to show on a chip).

### Library

- **Products can be created from several places** (agreed): from the library (to add a
  product without eating it) and from the composer, when the typed name matches nothing (a
  "＋ create" chip opens the product form with the name filled in; after saving, the product
  is added to the meal).
- **Product form**: name, units, and nutrients entered per any unit (see Products).
- **Recipe form = the meal composer** (agreed): ingredients with amounts and units, inline,
  with live totals. After composing, the recipe gets its **yield**: how many servings it makes
  (giving it a `serving` unit) and/or the weighed total weight.
- No "save meal as recipe": a meal and a dish are different things.
- Products and recipes can be edited and archived.
- Archived foods are hidden from the chips but kept, since meals and recipes refer to them. A
  food in use cannot be deleted.

### Stats and reports

A separate screen (from the menu) for looking back: weekly, monthly and yearly averages of
the nutrients against the goals, and weight charts. _(Contents to design later; the day
screen stays about today.)_

### Goals and menu

- Goals: one form with a target per nutrient (empty = no goal); see Goals.
- Menu: backup export/import, app version and update.

## Technical design

### Stack

A static PWA with no server (see UI rendering for the choice of Preact):

- **TypeScript + Vite**; one-way data flow (UI event → store action → new state → saved →
  views update).
- **Preact + `@preact/signals`** for views, written as JSX components.
- `src/core/` pure logic (units, nutrient maths, recipes, goals, integrity checks), no DOM,
  storage or Preact; `src/data/` storage, backup and exports; `src/ui/` components. Charts are
  hand-drawn SVG, no chart library.
- **Vitest** for unit tests and jsdom UI tests (with Preact's testing library); ESLint +
  Prettier.
- **vite-plugin-pwa**: installable, offline, updates applied on the next launch.
- **GitHub Pages**, deployed by GitHub Actions on push to `main`; CI runs lint, tests, build
  and `npm audit --omit=dev`.

### Stored data: sources only, references by id

The data holds **only what was entered**; every number shown is derived (see Derived data).

- **Records refer to each other by id, never by name.** Names are for display, so renaming
  never touches meals or recipes. Products, recipes and meals get random UUIDs, unique
  across all three.
- **Food names are unique** across products and recipes, ignoring case (`Skyr` = `skyr`),
  since they share one list of chips. Names are cleaned (trimmed, whitespace collapsed,
  Unicode NFC); case is kept for display.
- **Units live inside their food**, with an id unique within that food (`u1`, `u2`, …). An
  ingredient refers to a unit through its food, or to a built-in unit (`g`, `kg`, a recipe's
  `serving`) by its code name. A food's own units may not be named like a built-in unit
  (ignoring case); a product may have its own `serving` (from its label), a recipe may not.
- **Nutrients are stored per 100 g** _(proposal)_: label-like and readable; values entered per
  another unit are converted when the product is saved.
- **Unknown is absent**: a nutrient the label does not give is missing from `per100g`, not 0.

```json
{
  "version": "kcal 0.1.0",
  "exportedAt": "2026-11-17T09:00:00.000Z",
  "goals": [{ "from": "2026-11-01", "targets": { "kcal": 2000, "protein": 150 } }],
  "products": [
    {
      "id": "p-6f1c…",
      "name": "egg",
      "per100g": { "kcal": 143, "protein": 12.6, "fat": 9.5, "carbs": 0.7 },
      "units": [{ "id": "u1", "name": "piece", "grams": 60 }],
      "archived": false
    }
  ],
  "recipes": [
    {
      "id": "r-91ab…",
      "name": "oats with honey",
      "ingredients": [
        { "food": "r-77c0…", "unit": "g", "amount": 300 },
        { "food": "p-3d2e…", "unit": "u1", "amount": 1 }
      ],
      "cookedGrams": null,
      "servings": 1,
      "units": [],
      "archived": false
    }
  ],
  "meals": [
    {
      "id": "m-0a7f…",
      "eatenAt": "2026-11-17T08:30",
      "ingredients": [
        { "food": "r-91ab…", "unit": "serving", "amount": 1 },
        { "food": "p-6f1c…", "unit": "u1", "amount": 2 }
      ]
    }
  ]
}
```

(Ids shortened for readability; `serving` is the recipe's built-in unit from its `servings`.
Schema `kcal 0.1.0` holds exactly these four lists; water and weights are added later as new
optional lists, a patch version.)

### Derived data: computed, never stored

"Live" means **no cascading writes**: editing a product changes one record, and everything
that uses it is recomputed on the next render.

```
product → per gram          (stored per100g / 100)
recipe  → per gram          Σ(ingredient grams × ingredient per gram) / total grams
meal    → nutrients         Σ(ingredient grams × food per gram)
day     → nutrients         Σ meals of that date
```

- **Food table.** One derived map `foodId → { perGram, missing, units }` for all foods,
  built by recursion with memoisation (recipes resolve their ingredients first) and a cycle
  guard. It is **rebuilt from scratch whenever any food changes**: a few hundred foods take
  well under a millisecond, so there is no smart invalidation.
- **Meals, days, stats** are plain sums over the food table. A day is ~30 lookups; a year of
  stats ~10 000, still under a millisecond. Nothing else is cached.
- **Unknowns** travel with every value: a nutrient is `{ value, missing }`: the known part,
  and how many products (all the way down through recipes) lacked it. With `missing > 0` the
  amount is shown as `≥ value`. An ingredient with amount 0 counts nothing, unknowns included.
- **"Used in N meals and M recipes"** is a scan over meals and recipes on demand
  (milliseconds), not a stored index.
- **Total weight of a recipe** is the sum of its ingredients in grams, unless `cookedGrams` is
  set. _(Open: when ingredients change, the stored cooked weight may no longer match; the
  recipe form should probably ask to re-check it.)_

### Integrity

Checked on every load and on every import:

- every record has exactly its fields (unknown fields are refused, which catches typos);
- every food reference resolves; every unit reference exists on its food (or is built in);
- recipes have no cycles, and a positive total weight;
- products have `kcal`; nutrient values and amounts are non-negative numbers; unit grams,
  cooked weight, servings and goal targets are positive;
- ids are unique; names are clean and unique as described above;
- meals and recipes have at least one ingredient;
- `eatenAt` is a local `YYYY-MM-DDTHH:mm`, goal dates are `YYYY-MM-DD` and strictly
  increasing.

Every problem is reported with where it is (`product #3 "egg", unit #2: grams must be a
positive number`). References are checked only once everything else is well-formed, so each
message has a single cause.

A food or unit that is used is never deleted, only archived.

### Storage

- The whole state lives **in memory** as one object, and every change saves the whole
  document.
- Size: meals hold only references and amounts, so the data grows by roughly 0.5–1 MB a year;
  serialising it takes a few milliseconds.
- **`localStorage`** (agreed): the document is stored as one value under the key `kcal`. It
  loads synchronously at startup (no loading state), is simple to test and easy to inspect in
  the browser's tools. Its cap of about 5 million characters is roughly 5+ years of data away;
  the menu shows the saved size and warns past 3 million. Storage sits behind
  `loadSaved()`/`saveData()`, so moving to IndexedDB later is a contained change: read the old
  key once, write it to IndexedDB, remove the key. Eviction and persistent storage are the same
  for both.
- **Every change is checked before it is saved**: the store runs the integrity check on the new
  data and saves it before showing it; an invalid change or a failed save changes nothing.
- **Versioning.** The document carries `"version": "kcal <semver>"`, which marks it as a Kcal
  file and versions its schema (independent of app releases). While `0.x`, a minor bump may
  break (needs a migration) and a patch only adds optional fields. The app accepts the same
  `0.minor` with a patch up to its own; saved data of an older version is migrated silently on
  load once migrations exist.
- **Strict import.** Import replaces all data and is all-or-nothing: a file with any problem
  (see Integrity) is refused with the list of problems; nothing is silently fixed.
- **Check on load.** Saved data is checked like an import on every start. If it fails, the
  app shows a **problem screen** with the problems and two actions: download the saved data
  unchanged (to fix it at the desk), or start fresh (two-tap confirmation).
- Persistent storage is requested, so the browser does not evict the data.
- Later sync fits this model: records with ids, plus `updatedAt` and tombstones.

### Backup vs analysis export

Two different files for two different readers:

- **Backup**: the stored data exactly (ids, references). For restore and scripts.
- **Analysis export** (for an AI): flattened and self-explanatory: each meal with its time, food
  names, grams and computed nutrients; daily totals with the goals valid that day; weights.
  Generated from the derived data, never imported. This keeps the backup exact without making
  analysis depend on joining ids.

### UI rendering

Agreed: **Preact** from the start.

- Kcal's UI is highly interactive: the meal composer (an inline editable list
  with a live chart), product and recipe forms with unit selectors, the goals form, stats.
  Writing each screen as a function of the data avoids hand-written DOM syncing, which is
  where bugs would come from, and typing in an amount never loses focus.
- **Signals fit the derived-data model**: the state is a few signals (products, recipes,
  meals, goals, weights); the food table, day totals and stats are `computed` signals over
  them, so only what depends on a change updates.
- `src/core/` stays framework-free: the signals wrap plain functions, which are tested
  without Preact.

**Runtime libraries are allowed**, since Vite bundles them into the app and the service
worker caches them with it, so they work offline and update together with the app. A library
is added only when it is small, widely used, actively maintained, has few dependencies of its
own, and solves a real problem. Not needed so far: a chart library (a few bars and a line,
drawn in SVG), a date library (`Intl` and `Date` suffice). Never loaded from a CDN at runtime;
fonts and icons are bundled too.

## Later

- Stats screen contents: weekly/monthly/yearly averages against goals, weight charts.
- More nutrients (`fiber`, `sugar`, `salt`).
- Product lookup in Open Food Facts (search, barcode) to prefill a new product.
- Sync between devices.
- Analysis export for AI (see Technical design), CSV if useful.

## Open questions

UX details still to decide:

1. **Unknown nutrient values**: which nutrients may be unknown (kcal too?), and how the chart
   and totals show them. Agreed in principle (see Products).
2. **New food replacing an old one**: when `milk` is copied as new and the old one archived,
   may the new one also be called `milk` (names repeating among archived foods)?
3. **Meal rows** on the day screen: totals as numbers or as a small inline chart; what tapping
   the row itself does.
4. **Water** details, when it is built (see Water).
5. The _(proposal)_ items above, to confirm or change while building.

Technical questions (see Technical design):

- Recipe cooked weight when ingredients change: ask to re-check it?

## First prototype

Agreed scope: the smallest app I can use every day for eating against my goals.

| In                                                                                    | Later                                                     |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Products with units, nutrients entered per any unit; created from library or composer | Water                                                     |
| Recipes (composer + yield), recipes inside recipes                                    | Weight, Stats screen, analysis export                     |
| Meal composer: chips, inline amounts, unit selector, date/time, the live chart        | Copy as new, archiving (editing with "used in N" warning) |
| Day screen: chart, meal rows, ‹ › days, ＋ Eat, Eat again, delete                     | Markers for unknown values in the chart                   |
| Goals form (effective from today, history kept)                                       |                                                           |
| Backup export/import, installable PWA, deploy to GitHub Pages                         |                                                           |

- **No existing data to import**: the library starts empty, so creating products quickly
  (from the composer, label values copied as printed) matters most in the first days.
- **Built directly, no mockup**: the feel of the composer and whether the day fits on one
  screen are judged on the phone, then adjusted in rounds.
- Prototype defaults for open questions: kcal required, other nutrients optional; meal rows
  show time and `kcal · protein`; tapping a row opens it like the edit icon; storage in
  `localStorage`.

## Implementation plan

1. **Done:** scaffold: Vite, TypeScript, Preact + signals, Vitest, ESLint + Prettier, PWA,
   deploy.
2. **Done:** core: units, food table, nutrient maths with unknowns, recipes, goals, integrity
   checks (pure logic + tests, `src/core/`); backup format and strict import
   (`src/data/backup.ts`).
3. **Done:** storage (`localStorage`, check on load, problem screen), the app state
   (`src/state/store.ts`), backup export/import in the menu; library: product form (values per
   any unit, units, typo hint), recipe form (ingredient editor with food chips, create product
   from the picker, new unit from a row, live totals, yield); delete unused foods.
4. **Done:** day screen (chart, meal rows, ‹ › days, ＋ Eat), meal composer (ingredient editor,
   date and time, live chart, Eat again, two-tap delete).
5. **Done:** goals form in the menu (effective from today, history listed); past days show
   their own goals and say so.
6. Water.
7. Weight logging; then the Stats screen (reports, weight charts) and the analysis export.
