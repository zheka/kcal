# Dishes, and the meal composer with AI

A discussion record: graduating the lab's meal composer into the app (a photo of a meal or a
product fills the forms), and the data model that needs (meals made of dishes, products matched
against my library, barcodes of their own).

Status (2026-11-26): **under discussion, nothing built. The data model is reviewed; the UI is
next.** Nothing in [design.md](design.md), [barcodes.md](barcodes.md) or [lab.md](lab.md) changes
until the whole is agreed. The reasoning and the rejected options are written up when it is final.

**The principle over all of it:** everything works offline, with no model; the model only takes
the hassle when it is there, and never holds up a quick action (no waiting for it after a scan).
It runs behind an explicit [ai] tap, where waiting is chosen, or in the background.

## Data model (reviewed)

### Stored (the backup)

| Entity          | Fields                                                                          | Notes                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product**     | `id, name, perG?, perMl?, units[]`                                              | As now, without `barcode`. The only live thing: fixing it changes every meal that uses it. Its name is descriptive; no category, no hidden description, no record of where its values came from.                                                                                                        |
| **ProductUnit** | `id, name, g \| ml`                                                             | As now ("piece = 55 g", "cup = 250 ml").                                                                                                                                                                                                                                                                |
| **Barcode**     | `code, label: { name, brand?, pack?, per100?, categories? }, product?`          | **New, a top-level list.** `code` unique. `label`: Open Food Facts' data as scanned (`categories`: its tags, for finding close products offline), or typed from the pack when it doesn't know it; never counted. `product`: a **hint**, the product chosen last time for this barcode; optional.        |
| **Meal**        | `id, consumedAt?, title?, dishes[]`                                             | Without `consumedAt`: a **template**, never counted. `title` kept for context.                                                                                                                                                                                                                          |
| **Dish**        | `name?, items[], makes?: { amount, unit }, eaten?`                              | **New**, inside its meal, never shared. No `makes`: eaten whole. With `makes` (one per dish): the items are the whole batch, counted × `eaten` / `makes`. Its unit is `g`, `ml` or a free name (`servings` suggested, `slices`, `bowls`), `eaten` in the same: nothing has to be weighed (a pie isn't). |
| **Item**        | `product, amount, unit`                                                         | Was `Ingredient`. **Products only.** `unit`: `g`, `ml` or one of the product's unit ids.                                                                                                                                                                                                                |
| **GoalSet**     | as now                                                                          |                                                                                                                                                                                                                                                                                                         |
| **Settings**    | as now, and the AI context's expiry; quick buttons as now (a product, or empty) |                                                                                                                                                                                                                                                                                                         |

### On the device only (not in the backup)

| What                     | Holds                                                                                                            | Kept                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **AI context**, per meal | photos, texts, scans, facts; the last answer with the chips chosen; the last Use result (facts are made from it) | deleted with its meal; the whole context expires after a set time      |
| **Log**                  | each request and its response, for **Download logs** and the bench                                               | expires; a photo is kept while a context or a log entry still needs it |

### Removed

- **Recipe** (and its units): dishes (copied) and templates do its job.
- **`Product.barcode`**: the Barcode entity.
- Today's data (`kcal 0.2.0`) is dropped, with no migration: a future-proof model comes first.

### How one turns into another

1. **A scan → Barcode.** A known code: its label and its hint, offline, at once. An unknown one:
   Open Food Facts' label, kept as a new Barcode; offline, the barcode is kept without a label (a
   product picked or made by hand; the label filled in at a later lookup).
2. **Any new product candidate → my data**, in every flow (a scan, an AI answer, the product
   form, the food search), by code, offline:
   - **a strict match** (the same barcode; or the same name, exactly but for case and spacing,
     and macros within the strict tolerance): used, nothing asked;
   - **close products** (values near, name words or Open Food Facts categories in common): a few
     suggested, and **New**; linking and New both with the name editable (three protein desserts
     become "Protein dessert"); in the AI screen they are the "what is it" chips;
   - **nothing close:** a new product (from a scan: Open Food Facts' name without the brand).

   A scanned barcode's hint is set to the product chosen.

3. **Another product chosen for a scanned barcode** moves its hint, said with Undo.
4. **An AI answer → a meal (Use):** dishes, items, title. Each product is mine (the model's
   library key, or a code match) or a **pending** new product from the model's name, values per
   100 and units (pieces and menu sizes become units); a scan the model linked to a product
   gives its values from the label (by code). Pending products are saved with the meal.
5. **An AI answer → the product form:** the one product chosen fills it.
6. **A dish → another meal (the picker):** the latest dish of that name is **copied** (items,
   `makes`, `eaten`); edits stay in the copy.
7. **A meal → a meal (Eat again):** all dishes copied, for now; the AI context starts empty.
8. **A template** is a meal without `consumedAt`; its dishes are in the picker like any.
9. **Edits → facts:** the composer's changes since the last Use become facts in the AI context
   when [ai] is opened again; edits in the AI screen become facts at once.

### Settled in the review

- **Quick buttons** stay as now: a product with its amount, or empty. A quick button for a dish
  ("🥪", the latest Sandwich copied) can be added later as an optional field.
- **Deleting a product** a Barcode hints at clears the hint; the barcode and its label stay (the
  next scan matches from the stored label). Products used in meals can't be deleted, as now.
- **Dish names** aren't unique; "the latest of that name" compares names exactly but for case
  and spacing, as the strict product match does.
- **A flavour or a brand is not a variant** when the values are within the strict tolerance
  (three protein desserts of 86 kcal are one product); a kind is (water and tea, both 0 kcal),
  and so is what changes the values (fat %, light).
- **From one week of real data** (2026-11-20 to 26: 34 products, 59 meals, no recipes): half the
  meals are one glass of water (the 💧 button), so a one-item meal stays as light as now; the
  same items recur with other amounts (cheese 1 or 0.5, Frikadellen 5 or 8), the "latest dish,
  tweaked" case; products have menu-size units (eggs M and L, cannoli мини and piece), so "my
  unit" may be one of several.

## Agreed so far (to write up with reasons)

- **Dishes replace recipes.** Reuse is always a copy: the picker offers the latest dish of a name;
  a correction lands only where it is made. The same name means close enough (a ham sandwich and
  a tuna sandwich are named apart). A product counts by its amount, a batch by `eaten`; servings
  made apart are separate dishes.
- **The AI screen**, opened by [ai] in the meal composer (the camera at once the first time):
  - two panes: the **context** (photos, scans, texts, facts, each removable; **Update**) and the
    **meal** (dishes with the question chips; **(edit)** on each product: amount and unit, my
    library or New, Remove, each edit a fact; **Use**); each shows the other as a bar;
  - sending is always a tap; Use fills the composer, which stays the app's own screen (and the
    way to add by hand, offline too); opening it again lands in the context, with the composer's
    edits as facts; the model decides how to take the facts;
  - offline: photos and texts are kept, Update works when back online.
- **Matching:** the rule of the data model (2 above), the same in every flow. A wrong merge is worse than a duplicate; ask rather than pollute the library, but
  rarely, with very few clear options (a question and a proposal with Undo are the same thing).
  Daily and weekly averages must stay precise: errors of linked products are systematic and
  don't cancel out, so they must stay well under the noise (tens of kcal a day, never 200).
  - **The library is in the meal prompt:** every product's name, values per 100, base and units,
    first in the request. The model answers a short library key per product and alternative (or
    none); my values count; unsure: the likelier first, the other an alternative; my unit when
    the pieces look like mine, grams with a size range when not. A key only for the same food
    and variant; the bench gets decoys.
  - **One chip mechanism:** my products are always offered in "what is it", even when the
    difference is too small to ask; code adds those the model missed. The default is mine when
    it is the same food (an estimate) or the same food within the strict tolerance (a label or a
    scan); otherwise new, with mine as a chip.
  - No automatic averaging of products, names never change by themselves.
- **The product photo:** a label, the food itself, or words; through the same AI screen; the
  product form takes one product (with several, one is chosen).
- **The lab is retired** when the AI screen is in the app; experiments move to the tool and the
  bench, on meals from **Download logs**.

## Next

1. The UI, in detail.
2. Deferred: the tolerance's numbers; my recent dishes in the meal prompt (after product matching
   works); minor UI (Use on an out-of-date answer, [ai] on the day screen, the expiry's details).
