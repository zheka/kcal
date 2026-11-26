# Dishes, and the meal composer with AI

A discussion record: graduating the lab's meal composer into the app (a photo of a meal or a
product fills the forms), and the data model that needs (meals made of dishes, products matched
against my library, barcodes of their own).

Status (2026-11-26): **under discussion, nothing built. The data model summary below is not yet
reviewed**; nothing in [design.md](design.md), [barcodes.md](barcodes.md) or [lab.md](lab.md)
changes until it is. The reasoning and the rejected options are written up when it is final.

## Data model (summary, to review)

### Stored (the backup)

| Entity          | Fields                                                    | Notes                                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product**     | `id, name, perG?, perMl?, units[]`                        | As now, without `barcode`. The only live thing: fixing it changes every meal that uses it. Its name is descriptive; no category, no hidden description, no record of where its values came from.                                    |
| **ProductUnit** | `id, name, g \| ml`                                       | As now ("piece = 55 g", "cup = 250 ml").                                                                                                                                                                                            |
| **Barcode**     | `code, label: { name, brand?, pack?, per100? }, product?` | **New, a top-level list.** `code` unique. `label`: Open Food Facts' data as scanned, or typed from the pack when it doesn't know it; never counted. `product`: a **hint**, the product chosen last time for this barcode; optional. |
| **Meal**        | `id, consumedAt?, title?, dishes[]`                       | Without `consumedAt`: a **template**, never counted. `title` kept for context.                                                                                                                                                      |
| **Dish**        | `name?, items[], makes?: { amount, unit }, eaten?`        | **New**, inside its meal, never shared. No `makes`: eaten whole. With `makes` (one per dish: `1600 g`, `8 slices`): the items are the whole batch, counted × `eaten` / `makes`.                                                     |
| **Item**        | `product, amount, unit`                                   | Was `Ingredient`. **Products only.** `unit`: `g`, `ml` or one of the product's unit ids.                                                                                                                                            |
| **GoalSet**     | as now                                                    |                                                                                                                                                                                                                                     |
| **Settings**    | as now, and the AI context's expiry                       |                                                                                                                                                                                                                                     |

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

1. **A scan → Barcode.** A known code: its label and its hint, offline. An unknown one: Open
   Food Facts' label (or typed), kept as a new Barcode.
2. **Barcode → Product, the first time.** A candidate (the same food, values within a strict
   tolerance of the label) is offered as the default; otherwise a new product from the label,
   named as Open Food Facts names it without the brand. Either way the hint is set.
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

### Open in the data model

- **Quick buttons** point to `{ food, amount, unit }`: products only, or also a dish ("Sandwich",
  the latest copied)?
- **Deleting a product** a Barcode hints at: the hint is cleared, the barcode and its label kept
  (assumed). Products used in meals can't be deleted, as now.
- **`makes.unit`:** `g`, `ml` or a free name ("slices", "bowls"), `eaten` in the same unit.
- **Dish names** aren't unique; "the latest of that name" ignores case and spacing.

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
- **Matching:** a wrong merge is worse than a duplicate; ask rather than pollute the library, but
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

1. Review the data model above.
2. The UI, in detail.
3. Deferred: the tolerance's numbers; my recent dishes in the meal prompt (after product matching
   works); minor UI (Use on an out-of-date answer, [ai] on the day screen, the expiry's details).
