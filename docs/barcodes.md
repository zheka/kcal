# Barcodes and packs

A discussion record: how barcodes relate to products, so that scanning finds the product I
already have, whichever pack, brand or size I'm holding.

Status (2026-11-20): **under discussion, nothing built.** Today a product has at most one
`barcode` (format `kcal 0.2.0`), scanned only when the product is new.

## The problem

- **One food, many barcodes.** The same jam in a 250 g and a 500 g jar has two barcodes, and so
  does milk 1.5% from two brands. Each barcode makes its own product today, so the Library
  fills with near-duplicates, and 100 g eaten from either jar is a different food.
- **Hand-entered products can't be found by scanning.** A product entered before scanning
  existed (or from a label without scanning) has no barcode, and scanning its pack later only
  offers to create a duplicate.

## Agreed so far

- **What "the same product" means for kcal: the same values.** A product is "a food with these
  values". Milk 1.5% from two brands differs by a kcal or two per 100 ml, far below the accuracy
  of a poured glass, so for tracking it is one product; the brand doesn't matter. Values that
  really differ (reduced sugar, a new recipe) make a different product, even under the same
  name.
- **Nothing can tell for sure that two barcodes are the same product.** A barcode's first
  digits name the manufacturer, not the product, and Open Food Facts doesn't link packs: each
  barcode is its own entry. So the app suggests, and I decide.
- **The product is the primary record; packs are links.** A **pack** is an item on a shelf
  (barcode, brand, size, label); a **product** is a food in my diet (name, values, units). The
  product's values are mine (typed, or copied once from a label when it was created, editable
  after) and are what is counted. A pack never changes its product: products are not derived
  from packs, since with everything live that would quietly change past meals whenever another
  brand's carton is scanned, packs disagree slightly, and many foods (bananas, home-made bread,
  a café's soup) have no pack at all.
- **Packs are stored inside their product**, as a list: a pack always belongs to exactly one
  product and never exists on its own, a backup reads naturally ("jam, with its two jars"), and
  deleting a product takes its packs. A separate top-level list would add references to check
  and orphans to prevent for no gain now (it might pay off with sync; a contained change then).
- **A pack keeps a snapshot of what Open Food Facts said when it was scanned**, frozen and
  never counted:

  | Field    | Example                   | For                                                          |
  | -------- | ------------------------- | ------------------------------------------------------------ |
  | `code`   | `4006040002093`           | the barcode (required, unique among all packs)               |
  | `name`   | `Confiture extra fraises` | matching other sizes of the same product, after a rename     |
  | `brand`  | `Bonne Maman`             | matching, with the name; telling packs apart                 |
  | `pack`   | `250 g`                   | showing which pack it is ("250 g · 4006…"); not for matching |
  | `per100` | `{ "kcal": 245, … }`      | the label's values: see below                                |

  A barcode Open Food Facts doesn't know keeps only its `code`. The label's values are not a
  duplicate to keep in sync: the product's values are mine and editable, the label's are a fact
  of the scan, and the two may differ. Keeping them makes editing a scanned product reversible
  (back to the label's values, offline, even if Open Food Facts changed meanwhile), makes a
  merge of products lossless (each pack still records its own label), and lets a new scan
  match the label of a pack scanned before, even after the product was edited.

  ```json
  "barcodes": [
    { "code": "4006040002093", "name": "Confiture extra fraises", "brand": "Bonne Maman", "pack": "250 g", "per100": { "kcal": 245, "protein": 0.5, "fat": 0.2, "carbs": 60 } },
    { "code": "4006040002109", "name": "Confiture extra fraises", "brand": "Bonne Maman", "pack": "500 g", "per100": { "kcal": 245, "protein": 0.5, "fat": 0.2, "carbs": 60 } }
  ]
  ```

- **A pack is not a unit.** Making every pack a unit with its size ("1 jar = 250 g") was
  considered: it would let single-serve packs (a yogurt cup, a bar) be eaten as "1 cup", but
  most packs are too big to eat at once, so their units would sit unused. Not for now; a
  single-serve pack can still get a unit by hand.
- **A match is always confirmed**, never attached silently: a wrong automatic match would
  mislabel every later scan of that pack (diet cola logged as sparkling water), and one tap on
  **Same product** happens once per pack.

## Scanning an unknown barcode (proposed)

1. Look it up on Open Food Facts: name, brand, pack size, values per 100 g or ml.
2. Rank my products as candidates:
   - **the same name and brand as a pack of mine**: almost surely another size of it (the
     strongest hint, and it survives renaming my product);
   - **values close to a product's** (my values, or a pack's label values): the "same milk,
     another brand" case, and the way hand-entered products are found.
3. If there is a candidate, ask: "Looks like **milk 1.5%** (47 kcal · 3.4 g protein · 1.5 g
   fat / 100 ml; this pack: 46 · 3.3 · 1.5)" with **Same product** (the barcode joins that
   product; its values stay) and **New product** (the form, filled from the label, as now).
4. If there is none, straight to the new-product form, as now.
5. Wherever the scan happened (a meal, a recipe, the Library), **Same product** then does what
   scanning a known barcode does there: adds the product, or opens it.

Matching is a suggestion with known weak spots:

- **Foods near zero** (water, black coffee, tea, diet cola, sparkling water) all match each
  other by values; relative differences mean nothing near 0. They need the name too, or to be
  offered as candidates for me to choose among rather than as "looks like".
- **No values to compare**: Open Food Facts doesn't know the barcode, or has no values. Then a
  manual **Same as one I have…** is needed: picking the product from my foods.
- **Small differences** (rounding: 63 vs 63.5 kcal, or a typo in Open Food Facts) need a
  tolerance, with the difference shown so I can judge. The tolerance is still open.

## Open

- **Adding a barcode to a product I have.** Scanning an unknown barcode and choosing **Same
  product** (or **Same as one I have…**) is the main way. Should the product form also have a
  scan button for an existing product? Probably yes, attaching only, with no lookup filling the
  values (they are mine); the label's values are kept on the pack and could be offered next to
  mine ("Use the label's values"), never filled in by themselves.
- **Removing a barcode.** Each pack in the product form with its × (as everywhere). Removing
  only unlinks the barcode: the next scan of that pack is unknown again. No effect on meals.
- **Moving a barcode** that was attached to the wrong product: remove it here and scan again
  ("Same as…" the right product), or a direct "move to…". Is the first enough?
- **A barcode already on another product**, scanned in a product form: say so and offer to
  open that product (as now); moving it is the case above.
- **How the product form shows packs**: a list under the name ("Bonne Maman · 250 g ·
  4006040002093", ×), the label's values on request.
- **The match tolerance**, and how the near-zero foods are handled.
- **Merging products** that turn out to be the same (two milks entered before this existed): a
  feature of its own. Meals and recipes are re-pointed to the kept product; units are combined
  (meals refer to a unit by id); I choose whose values win; packs join the kept product, each
  keeping its label. The pack model makes it possible and lossless; whether and when to build
  it is open.
- **The product's name from a scan**: today "Skyr Natur (Arla)", the name with the first brand
  (see `productName` in `src/data/openFoodFacts.ts`). With the brand kept on the pack, should
  a new product's name drop the brand ("skyr natur"), since the product isn't a brand's any
  more? Renaming stays free either way.
- **Data format.** `barcode` (one string) becomes `barcodes` (a list of packs). Adding a list
  of objects can be compatible, but the old field has to go: either a minor version with the
  **first migration** (`"barcode": "x"` → `"barcodes": [{ "code": "x" }]`, losing nothing,
  since nothing else was kept), or a patch that adds `barcodes` and reads `barcode` until a
  later minor drops it. The phone has real data, so starting fresh is not an option (see
  [design.md](design.md), Storage, Versioning). Barcodes stay unique across all packs of all
  products.
