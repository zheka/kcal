# Kcal design

High-level design of Kcal, a personal nutrition tracker.

Status (2026-11-19): **UX agreed at a high level; backup format agreed** (see
[backup-format.md](backup-format.md), not implemented yet). Items marked _(proposal)_ are
suggestions not discussed yet; Open questions lists what is still undecided.

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

| Concept      | Meaning                                                                       |
| ------------ | ----------------------------------------------------------------------------- |
| **Nutrient** | a quantity in food: `kcal`, `protein`, `fat`, `carbs`                         |
| **Product**  | something with nutrients per gram, from its label                             |
| **Recipe**   | products (and recipes) with amounts; usable everywhere a product is           |
| **Unit**     | a way to measure a food: `piece`, `ml`, `cup` (in grams), `serving` (a share) |
| **Meal**     | a logged entry: foods taken together, at a date and time                      |
| **Water**    | a nutrient (ml): the water in drinks, counted towards a daily goal            |
| **Goals**    | daily targets per nutrient                                                    |
| **Weight**   | my body weight, at most one value per day                                     |

"Food" below means a product or a recipe: wherever one can be used, so can the other.

### Nutrients

- `kcal`, `protein`, `fat`, `carbs` (g). The list is **built into the code**
  (`src/config.ts`), so adding `fiber` or `sugar` later is a config change plus an optional
  field.
- **`water`** (ml) is a nutrient too (see Water).
- **An omitted nutrient counts as 0** (agreed); nothing is required, kcal included.
- `kcal` comes **from the label**, not from the macros (labels round and use other factors).

### Products

- **Everything goes through grams** (agreed). Every product stores its nutrients **per 1 g**,
  and every amount is converted to grams for calculation. A unit that is not really a weight
  (ml of a drink, an egg of size M) gets a reasonable figure in grams, corrected later if
  needed: that error is far below the tolerances of labels.
- **All other units are defined by hand, per product**, as grams: `piece = 60 g`,
  `ml = 1.03 g` (milk), `cup = 250 g` (my mug of milk), `scoop = 30 g`. No standard volume
  units are built in: "cup" means whatever my cup holds of that product.
- **Units belong to their food** (agreed): they are stored inside the product and mean
  nothing outside it ("cup" of oats ≠ "cup" of milk). Nothing about units is shared between
  foods except, as a typing aid, their names.
- **Grams are built in** (agreed): every product can be measured in `g`, which is never stored
  and is reserved as a unit name. There is no `kg`.
- How products are stored: see [backup-format.md](backup-format.md).
- The **last unit and amount used** for a food are preselected the next time.
- **Nutrients can be entered and shown per any unit** of the product (agreed in principle):
  the product form has its units section right away, and the nutrient values are entered
  "per [100 g ▾]", where the selector also offers the product's units (`per bar` = 45 g,
  `per ml`…). So a label's per-serving or per-100-ml column is copied as printed, and the app
  converts it to per gram, rounded once when stored.
- **A nutrient left empty counts as 0** (agreed). This replaces the earlier "unknown values":
  no markers, no `≥`. The four macros are on every EU label; a nutrient added later (fiber)
  simply counts 0 for products without it.
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
- **A recipe is eaten only in its own units** (agreed): the form asks what it makes
  ("makes 6 servings", "makes 4 pieces"), and a recipe has at least one such unit. There is no
  built-in unit for recipes, not even grams.
- **"Makes 1600 g"** is one more unit: the weighed pot. Then "350 g of soup" from the scale is
  right even when cooking changed the weight.
- Its nutrients are **computed** from the ingredients, never typed. Internally a recipe is
  measured by the sum of its ingredients in grams; one of a unit is that sum divided by what
  it makes.
- **Recipes are for things prepared as one dish**, not for repeating meals.
- **Recipes can contain recipes**: `oats` (oats + water, cooked), `oats with honey` (oats +
  honey), `oats with banana` (oats + banana). Cycles are refused.

### Meals

A meal is the logged entry: a group of products and recipes **taken together**, at a date
and time. It has no name; a standalone snack or a single product is a meal too.

- Meals are **live** (see Editing foods): they store only their foods, amounts and units;
  their nutrients are computed from the current foods. How meals are stored: see
  [backup-format.md](backup-format.md).
- **No name.** An optional free-text name may be added later if a need shows up; nothing
  depends on it.
- **Date and time** (agreed): set in the meal composer with a date-time control. It defaults
  to **now** when the composer is opened from today, and to a time on that day when opened
  from another day: one minute after that day's last meal, or 12:00 if it has none. The
  date decides which day the meal counts towards; the time orders the meals within the day.
  It is the time the meal is (or will be) eaten, so it can be in the future.
- **Stored as a UTC timestamp** (agreed); the day and time are shown in the device's current
  time zone. The composer edits only the minute; the hidden seconds keep meals in the same
  minute in the order they were logged.

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
  { "perDay": { "kcal": 2000, "protein": 150, "water": 2000 }, "setAt": "2026-11-01T18:20:05.114Z" },
  { "perDay": { "kcal": 2200, "protein": 160, "water": 2000 }, "setAt": "2027-01-15T07:02:44.590Z" }
]
```

(`setAt` is when the goals form was saved, a UTC timestamp; it is never entered by hand. A set
applies from the start of the local day containing `setAt`, so goals saved at 15:00 apply to the
whole of that day. See [backup-format.md](backup-format.md).)

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

- **Water is counted by the water content of drinks**, as hydration and kidney-health guidance
  count it: total fluid matters, coffee and tea included (their diuretic effect is small),
  while sugary sodas are a matter of sugar, not fluid. Food is left out (its water, about 20%
  of total intake, is covered by the margin in fluid targets).
- **Water is a nutrient** (ml; 1 g of water = 1 ml). Drink products carry a water value by
  their content: water 1 per g, coffee and tea about 0.99, milk about 0.88. Foods omit it,
  which counts as 0.
- **The water goal** is a target like the others (e.g. 2000 ml), and water has its own bar in
  the day chart, on its own scale (ml).
- **Built-in foods**, defined in the code and read-only: `water` (units g and ml), `protein`,
  `fat`, `carbs` (pure, with 4/9/4 kcal per gram). Their names are reserved. Besides water,
  they let a meal be estimated as macros ("40 g protein + 20 g fat + 60 g carbs").
- **＋ Water** on the day screen, next to ＋ Eat, opens the composer with built-in water at the
  last amount used. Drinks are meals in storage. _(Later: the button may become configurable.)_
- Built-in foods have no custom units; recent amounts appear as chips. "My cup of water" is a
  recipe (330 ml of water, makes 1 cup) or a product with a water value.
- Drinks are rows in the day list like any meal; every row shows the nutrients that have
  goals, so a glass of water shows its `330 ml water`.

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
  ingredients**: its time and **the nutrients that have goals** that day (agreed), e.g.
  `690 kcal · 48 g protein · 300 ml water`, so every meal, a glass of water included, shows
  how it moves each goal. Drinks are rows like any other meal. _(Before the first goals:
  kcal, proposal.)_
- A small **edit icon** on the right of a meal row opens it in the meal composer (edit mode),
  which also offers **Eat again** and **Delete** (two-tap). _(What tapping the row itself does,
  if anything, is open.)_
- **＋ Eat** opens the composer for the day on screen (see the meal time defaults); **＋ Water**
  opens it with built-in water (see Water).
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
  numbers (`1200 + 690` over `/ 2000`).
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
  with live totals. After composing, the recipe gets its **units**: what it makes ("6
  servings", "4 pieces", "1600 g" if the pot is weighed), at least one.
- No "save meal as recipe": a meal and a dish are different things.
- Products and recipes can be edited. A food in use cannot be deleted.
- _(Later)_ Archiving: archived foods are hidden from the chips but kept, since meals and
  recipes refer to them.

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

### Stored data

**The format of the stored data and the backup is specified in
[backup-format.md](backup-format.md).** In short: only what was entered is stored, every
number shown is derived; records refer to each other by UUID; units live inside their
product; the file is deterministic (fixed field and list order).

**Three forms of the data** (agreed, the guiding principle):

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

### Derived data: computed, never stored

"Live" means **no cascading writes**: editing a product changes one record, and everything
that uses it is recomputed on the next render.

```
product → per gram          (stored per gram)
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
- **"Used in N meals and M recipes"** is a scan over meals and recipes on demand
  (milliseconds), not a stored index.
- **The weight basis of a recipe** is the sum of its ingredients in grams; one of its units
  is that sum divided by what the unit makes, divided last.
- **The in-memory food table** holds, for every product and recipe, the exact grams of each
  of its units (integer thousandths) and the nutrients per gram, so an amount becomes exact
  grams first and nutrients last: 100 g and 4 × 25 g give exactly the same result.

### Integrity

Checked on every load and every import: see [backup-format.md](backup-format.md). Every
problem is reported with where it is (`product #3 "egg", unit #2: grams must be a positive
number`). References are checked only once everything else is well-formed, so each message
has a single cause.

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

1. ~~Unknown nutrient values~~: decided, an omitted nutrient counts as 0.
2. **New food replacing an old one**: when `milk` is copied as new and the old one archived,
   may the new one also be called `milk` (names repeating among archived foods)?
3. **Meal rows** on the day screen: totals as numbers or as a small inline chart; what tapping
   the row itself does.
4. ~~Water in the day list~~: decided, drinks are rows like any meal, showing the nutrients
   that have goals.
5. The _(proposal)_ items above, to confirm or change while building.

Technical questions (see Technical design):

- Recipe cooked weight when ingredients change: ask to re-check it?

## First prototype

Agreed scope: the smallest app I can use every day for eating against my goals.

| In                                                                                    | Later                                                     |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Products with units, nutrients entered per any unit; created from library or composer | Water: next, see Water                                    |
| Recipes (composer + yield), recipes inside recipes                                    | Weight, Stats screen, analysis export                     |
| Meal composer: chips, inline amounts, unit selector, date/time, the live chart        | Copy as new, archiving (editing with "used in N" warning) |
| Day screen: chart, meal rows, ‹ › days, ＋ Eat, Eat again, delete                     |                                                           |
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
