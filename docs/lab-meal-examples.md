# The lab: 1,000 example meals

1,000 meals written in the format of [lab-meal-format.md](lab-meal-format.md), each with the most
uncertainty a photo (or a vague text) plausibly leaves: every material doubt I could answer is a
question. Written by hand (by Claude, in discussion), not by the model, to test the format's
shape: they are not model runs, and amounts are typical, not measured.

Status (2026-11-22): **all 1,000 pass the format's checks**
(`python3 scripts/check-meal-examples.py docs/lab-meal-examples.md`); the problems they raised are
listed below and in lab-meal-format.md, Open problems.

## How to read them

```
#### N. Title · cuisine · where
- Food row — amount
  P why: option / [chosen] / option
- Dish row ×count
  C why: option / [chosen]
  - Part — amount
    U why: [chosen, its size] / option, its size
! tag: a note on a problem or a modelling choice
```

| Mark | Question                                   |
| ---- | ------------------------------------------ |
| `U`  | `sized_products`: a kind with its own size |
| `P`  | `products`: a kind                         |
| `S`  | `sizes`: how big                           |
| `C`  | `counts`: how many, or how much            |

The row's amount shows the chosen options. Certain questions aren't shown. Names are in English
(the app would answer in my language); a product's full name is the row's name, its label the
chip.

## Coverage

- 1–500: the first set, by cuisine: Russian, Ukrainian, Belarusian; the Caucasus and Central Asia;
  German, Austrian, Swiss, Czech, Polish; French, Belgian, Dutch; Italian; Spanish, Portuguese;
  British, Irish, Nordic; Greek, Turkish, Balkan; the Middle East, North Africa, Iran; the Indian
  subcontinent; Chinese, Taiwanese, Hong Kong; Japanese; Korean; Southeast Asian; the USA and
  Canada; Latin America; Africa; home cooking.
- 501–1000: complex and everyday meals: full restaurant dinners (Italian, French, steakhouse,
  Georgian supra, Chinese banquet, kaiseki, Korean BBQ, tapas, tasting menus, …); set menus,
  business lunches, canteens, chains, airline and train meals; buffets, brunches, weddings,
  holidays, parties; drinks, bars and cafés; snacks, packaged and street snacks; home cooking,
  family meals, leftovers; diets, fitness, vegan; more regional cuisines (Caribbean, Pacific,
  Mongolian, Tibetan, Baltic, Balkan, Cajun, Andean, …); breakfasts around the world; edge cases
  (a dark photo, before and after photos, text only, history, a closed container, eating from
  the pot).

In numbers: 2,525 rows, at most 11 in a meal; 86 meals with a dish, none with a dish in a dish.
Questions: 1,017 counts, 268 kinds, 191 sizes, 39 kinds with sizes. Options per question: 2 in
472, 3 in 965, 4 in 77, 5 in 1. Rows by their questions: none 1,520, C 856, P 135, S 111, CP 92,
CS 39, PS 31, CU 20, U 19, CPS 10.

## Problems and notes, by tag

**Open problems of the format (see lab-meal-format.md, Open problems)**

- `presence+kind`: "None" as one of the kinds: one question to a person, two in the format. #59, #87, #175, #431, #566, #885
- `linked-kinds`: one kind choice should change several rows (pho bo / ga). #371
- `linked-sizes`: one size choice should change several rows (a combo). #406, #565
- `linked-unknown`: a related row with its own unknown kind. #529
- `dish-size`: a dish size scales every part, some shouldn't. #327, #329
- `bases`: kinds that would be in different bases. #40
- `menu-choice-kinds`: a set-menu course of unknown kind: very different dishes as kinds. #502, #551, #948
- `total-weight`: a known total weight across rows. #8, #470, #762

**Modelling choices the prompt must teach**

- `two-whats`: two independent kinds on one food: split into parts. #61
- `two-whats-merged`: two dependent kinds: one sized question of the combinations. #774
- `kind-sets-size`: a kind whose size comes with it is sized_products (U), easy to miss. #531, #537
- `kind-as-size`: the same: a corner piece of cake. #905
- `size-vs-count`: a menu size that is a number of pieces is a count. #96, #273, #880
- `size-as-fraction`: sizes labelled as fractions (¼ / ½ chicken). #468
- `add-on-row`: an add-on is its own row. #341
- `per-serving-across-rows`: an add-on per serving × servings needs a dish. #180, #934
- `dish-size+part-question`: a dish size and a part question together need the dish split. #321
- `dish-size-on-part`: a size asked on a part applies to every serving of the dish. #708
- `fold-oil-into-kind`: oil picked up with the food is a degree of the food. #843
- `two-counts-one-row`: "seconds" are the same count. #543
- `two-counts-one-row-again`: the same. #876
- `presence-as-kind`: with or without, where it is a kind (Mexico City quesadilla). #458
- `partly-eaten-liquid`: a liquid eaten with bread: counted in the bread. #161
- `spit-as-count`: samples spat out: labels on the count. #615
- `diluted-drink`: a drink with water: the size is of the drink. #519
- `as-weighed`: a raw weight with the bone: a product named that way. #497
- `leftover-tops`: parts not eaten (khinkali tops) are not in the size. #27
- `mixed-pieces`: different pieces in one row: separate rows when visible. #423
- `mixed-meats`: the same. #595
- `mixed-fillings`: the same. #915
- `mixed-drinks`: different drinks over time in one row. #861
- `repeated-unknowns`: a list of drinks is a list of rows. #640
- `label-fraction`: fractions of a scanned pack. #887
- `unit-from-pack`: a unit from the pack (a square of chocolate). #662
- `handful-size`: "a handful" is a unit with a size. #664

**Notes: fine as they are**

- `label-only`: labels carry the meaning (thin / usual / generous). #4, #86
- `lumped-courses`: lumped courses of a tasting menu. #524
- `lumped-plates`: lumped conveyor sushi plates. #572
- `lumped-baskets`: lumped dim sum baskets. #594
- `lumped-meze`: lumped meze. #821
- `many-rows`: many small rows. #531
- `many-stalls`: one row per stall. #590, #836
- `refills-everywhere`: refills on every bowl: ask only those that matter. #530
- `plate-as-dish`: buffet plates as dishes. #288
- `repeated-plate`: "a second plate like this": a count on the plate dish. #899
- `long-toasting`: glasses over an evening of toasts. #873
- `pours-unknown`: a host's pours: size and count both in doubt. #901
- `long-meal`: one meal for an evening of snacking. #894
- `after-photo`: a photo after eating. #892
- `two-photos`: photos before and after. #893
- `nothing-visible`: a closed container: only text helps. #900
- `pot-unknown`: eating from the pot: ladles as the unit. #919
- `zero-kcal`: zero-kcal drinks. #653

## The meals

### Russian, Ukrainian, Belarusian

#### 1. Borscht, sour cream, bread · Russian · home

```text
- Borscht — 400 ml
  C bowl size: 300 ml / [400 ml] / 500 ml
- Sour cream — 20 g
  C spoonful: none / [20 g] / 40 g
- Rye bread — 1 slice
  C slices: [1] / 2
```

#### 2. Pelmeni with sour cream · Russian · café

```text
- Pork-beef pelmeni — 20 pcs
  P filling: [pork-beef] / chicken
  C count: 15 / [20] / 25
- Sour cream — 30 g
  C amount: none / [30 g] / 60 g
```

#### 3. Varenyky with fried onion · Ukrainian · home

```text
- Potato varenyky — 10 pcs
  U filling: [potato, 25 g] / cherry, 20 g / tvorog, 25 g
  C count: 8 / [10] / 12
- Fried onion with butter — 15 g
  C topping: none / [15 g] / 30 g
```

#### 4. Three blini with different fillings · Russian · café

```text
- Blin with condensed milk — 1
- Blin with tvorog — 1
- Blin with caviar — 1
  C caviar: thin / [usual] / generous
! label-only: "thin / usual / generous" caviar is a count in g; fine, labelled
```

#### 5. Stack of blini with sour cream · Russian · home

```text
- Blini — 4 pcs
  C count: 3 / [4] / 5
- Sour cream — 40 g
  C amount: 20 g / [40 g] / 60 g
```

#### 6. Olivier salad · Russian · home

```text
- Olivier, usual mayo — 200 g
  P mayo: light / [usual] / heavy
  C portion: 150 g / [200 g] / 300 g
```

#### 7. Herring under a fur coat · Russian · café

```text
- Herring under a fur coat — 1 portion
  S portion: small / [usual] / large
```

#### 8. Buckwheat with cutlet, weighed together 350 g · Russian · home

```text
- Buckwheat — 200 g
- Pork cutlet — 150 g
! total-weight: the plate was weighed whole; the split between rows is the model's
```

#### 9. Syrniki with sour cream and jam · Russian · café

```text
- Syrniki — 3 pcs
  C count: 2 / [3] / 4
- Sour cream — 30 g
  C amount: none / [30 g] / 50 g
- Jam — 20 g
  C amount: none / [20 g] / 40 g
```

#### 10. Okroshka · Russian · home

```text
- Okroshka on kvass — 400 ml
  P base: [kvass] / kefir
  C bowl: 300 ml / [400 ml] / 500 ml
```

#### 11. Golubtsy with sour cream · Russian · canteen

```text
- Golubtsy — 2 pcs
  U size: [usual, 150 g] / large, 220 g
  C count: 1 / [2] / 3
- Sour cream — 30 g
```

#### 12. Solyanka · Russian · café

```text
- Solyanka — 350 ml
  C bowl: 250 ml / [350 ml] / 450 ml
```

#### 13. Chicken Kiev · Russian · restaurant

```text
- Chicken Kiev — 1 pc, 200 g
- Mashed potatoes — 150 g
  C portion: 100 g / [150 g] / 200 g
```

#### 14. Shashlik · Russian · picnic

```text
- Pork shashlik — 1 skewer
  P meat: [pork neck] / chicken / lamb
  C skewers: [1] / 2 / 3
- Lavash — 1 sheet
  C sheets: none / [1] / 2
```

#### 15. Pirozhki · Russian · street

```text
- Fried pirozhok with meat — 2 pcs
  U kind: [fried, meat, 80 g] / fried, cabbage, 80 g / baked, meat, 70 g / baked, cabbage, 70 g
  C count: 1 / [2] / 3
```

#### 16. Cheburek, one big · CIS · café

```text
- Cheburek with meat — 1
  P filling: [meat] / cheese
  S size: usual 120 g / [big 180 g] / huge 250 g
```

#### 17. Kholodets with horseradish · Russian · home

```text
- Kholodets — 150 g
  C portion: 100 g / [150 g] / 200 g
```

#### 18. Draniki with sour cream · Belarusian · café

```text
- Draniki — 4 pcs
  C count: 3 / [4] / 5
- Sour cream — 40 g
  C amount: 20 g / [40 g] / 60 g
```

#### 19. Oats "50 g oats, 200 ml milk, 1 tsp sugar" · text · home

```text
- Oats with milk — 1 bowl
  - Oats — 50 g
  - Milk — 200 ml
  - Sugar — 1 tsp
```

#### 20. Tea with sugar and candies · Russian · home

```text
- Black tea — 250 ml
- Sugar — 1 tsp
  C spoons: none / [1] / 2
- Chocolate candies — 3 pcs
  C count: 2 / [3] / 5
```

#### 21. Salo with rye bread and garlic · Ukrainian · home

```text
- Salo — 40 g
  C amount: 20 g / [40 g] / 60 g
- Rye bread — 2 slices
  C slices: 1 / [2] / 3
```

#### 22. Kvass, a bottle · Russian · shop

```text
- Kvass — 500 ml
  S bottle: 330 ml / [500 ml] / 1 l
```

#### 23. Blini with caviar as a starter · Russian · restaurant

```text
- Blin with caviar ×2
  C blini: 1 / [2] / 3
  - Blin — 1 pc
  - Butter — 5 g
    C butter: none / [5 g] / 10 g
  - Red caviar — 15 g
    C caviar: 10 g / [15 g] / 25 g
```

#### 24. Pelmeni in broth · Russian · home

```text
- Pelmeni — 15 pcs
  C count: 12 / [15] / 20
- Broth — 200 ml
  C drank: none / half / [all]
```

#### 25. Vinegret · Russian · canteen

```text
- Vinegret, usual oil — 150 g
  P oil: light / [usual] / generous
  C portion: 100 g / [150 g] / 200 g
```

### Caucasus, Central Asia

#### 26. Khachapuri Adjaruli · Georgian · restaurant

```text
- Khachapuri Adjaruli ×1
  S boat: small / [medium] / large
  - Bread boat with cheese — 1
  - Egg — 1
  - Butter — 20 g
    C butter: none / [20 g] / 40 g
```

#### 27. Khinkali · Georgian · restaurant

```text
- Beef-pork khinkali — 5 pcs
  P filling: [beef-pork] / lamb / mushroom / cheese
  C count: 4 / [5] / 6 / 8
! leftover-tops: the dough tops aren't eaten; the size of a khinkali is the eaten part
```

#### 28. Imeruli shared by three · Georgian · restaurant

```text
- Imeruli khachapuri — 2 slices
  C my slices: 1 / [2] / 3
```

#### 29. Lobio with mchadi · Georgian · restaurant

```text
- Lobio — 250 g
  C portion: 150 g / [250 g] / 350 g
- Mchadi — 2 pcs
  C count: 1 / [2] / 3
```

#### 30. Lyulya kebab with lavash and onions · Caucasus · restaurant

```text
- Lamb lyulya kebab — 2 skewers
  P meat: [lamb] / beef / chicken
  C skewers: 1 / [2]
- Lavash — 1 sheet
- Pickled onion — 50 g
```

#### 31. Pkhali assortment · Georgian · restaurant

```text
- Pkhali assortment — 120 g
  C my share: 60 g / [120 g] / 200 g
```

#### 32. Chakhokhbili · Georgian · home

```text
- Chakhokhbili — 300 g
  C portion: 200 g / [300 g] / 400 g
```

#### 33. Satsivi · Georgian · restaurant

```text
- Satsivi — 200 g
  C portion: 150 g / [200 g] / 300 g
```

#### 34. Dolma with matsoni · Armenian · restaurant

```text
- Dolma — 6 pcs
  C count: 4 / [6] / 8
- Matsoni — 50 g
  C amount: none / [50 g] / 100 g
```

#### 35. Kharcho · Georgian · café

```text
- Kharcho — 350 ml
  C bowl: 250 ml / [350 ml] / 450 ml
```

#### 36. Churchkhela · Georgian · market

```text
- Churchkhela — 1
  S size: small 50 g / [usual 90 g] / large 130 g
```

#### 37. Lavash wrap with cheese and herbs · Armenian · street

```text
- Lavash wrap with cheese — 1
  U wrap: [cheese and herbs, 180 g] / cheese and ham, 220 g
```

#### 38. Plov · Uzbek · café

```text
- Lamb plov — 350 g
  P kind: [lamb] / beef / chicken
  C portion: 250 g / [350 g] / 450 g
```

#### 39. Manty with sour cream · Uzbek · café

```text
- Lamb manty — 4 pcs
  P filling: [lamb] / beef / pumpkin
  C count: 3 / [4] / 5
- Sour cream — 30 g
  C amount: none / [30 g] / 60 g
```

#### 40. Lagman · Uyghur · café

```text
- Soup lagman — 450 g
  P kind: [soup] / fried (kovurma)
  C bowl: 350 g / [450 g] / 550 g
! bases: soup lagman would be in ml, fried in g; both in g here
```

#### 41. Samsa · Uzbek · street

```text
- Tandoor samsa with beef — 1
  U kind: [tandoor, beef, 150 g] / tandoor, lamb, 150 g / puff, beef, 90 g / pumpkin, 130 g
  C count: [1] / 2
```

#### 42. Belyashi · Tatar · street

```text
- Belyash — 2 pcs
  U kind: [belyash, 100 g] / vak-belyash, 60 g
  C count: 1 / [2] / 3
```

#### 43. Beshbarmak from a shared platter · Kazakh · home

```text
- Beshbarmak — 300 g
  C my share: 200 g / [300 g] / 400 g
```

#### 44. Shurpa · Uzbek · café

```text
- Shurpa — 400 ml
  C bowl: 300 ml / [400 ml] / 500 ml
- Lamb on the bone — 100 g
  C meat eaten: 60 g / [100 g] / 150 g
```

#### 45. Non torn and shared · Uzbek · home

```text
- Non — ½
  C my share: ¼ / [½] / whole
```

#### 46. Chak-chak and kazy with tea · Kazakh · home

```text
- Chak-chak — 50 g
  C amount: 30 g / [50 g] / 80 g
- Kazy — 40 g
  C slices: 20 g / [40 g] / 60 g
- Tea with milk — 250 ml
```

#### 47. Kuurdak · Kyrgyz · café

```text
- Kuurdak — 250 g
  C portion: 200 g / [250 g] / 350 g
```

#### 48. Qutab with butter · Azerbaijani · café

```text
- Qutab with herbs — 3 pcs
  P filling: [herbs] / meat / pumpkin
  C count: 2 / [3] / 4
- Butter — 10 g
  C butter: none / [10 g] / 20 g
```

#### 49. Armenian khorovats, shared · Armenian · restaurant

```text
- Pork neck khorovats — 250 g
  P meat: [pork neck] / pork ribs / lamb / chicken
  C my share: a little 150 g / [portion 250 g] / a lot 350 g
- Grilled vegetables with oil — 150 g
  P oil: no oil / [with oil]
- Lavash — 1 sheet
  C sheets: none / [1] / 2 / 3
```

#### 50. Tan with lunch · Armenian · café

```text
- Tan — 300 ml
  S glass: 200 ml / [300 ml] / 500 ml
```

### German, Austrian, Swiss, Czech, Polish

#### 51. Wiener Schnitzel with potato salad · Austrian · restaurant

```text
- Wiener Schnitzel — 1
  S size: [usual 180 g] / large 300 g
- Potato salad, vinegar — 200 g
  P dressing: [vinegar] / mayo
- Lingonberry jam — 30 g
  C amount: none / [30 g] / 50 g
```

#### 52. Bratwurst in buns · German · street

```text
- Bratwurst in a bun ×2
  C count: 1 / [2]
  - Bun — 1
  - Bratwurst — 1
  - Ketchup — 15 g
    C sauce: none / [15 g] / 30 g
```

#### 53. Currywurst with fries · German · street

```text
- Currywurst — 1
- Fries — 150 g
  C portion: small 100 g / [regular 150 g] / large 200 g
```

#### 54. Butterbrezel · German · bakery

```text
- Butterbrezel ×1
  - Brezel — 1
  - Butter — 15 g
    C butter: thin 8 g / [usual 15 g] / thick 25 g
```

#### 55. Schweinshaxe · German · restaurant

```text
- Schweinshaxe, meat eaten — 450 g
  C meat eaten: 300 g / [450 g] / 600 g
- Sauerkraut — 150 g
- Knödel — 1
  C count: none / [1] / 2
```

#### 56. Käsespätzle with fried onions · German · restaurant

```text
- Käsespätzle — 350 g
  C portion: 250 g / [350 g] / 450 g
- Fried onions — 20 g
```

#### 57. Sauerbraten with Knödel · German · restaurant

```text
- Sauerbraten — 200 g
- Knödel — 2 pcs
  C count: 1 / [2]
- Gravy — 100 g
  C gravy: 50 g / [100 g] / 150 g
```

#### 58. Apfelstrudel · Austrian · café

```text
- Apfelstrudel — 1 slice
  S slice: small / [usual] / large
- Vanilla ice cream — 1 scoop
  C scoops: none / [1] / 2
```

#### 59. Kaffee und Kuchen · German · café

```text
- Cake — 1 slice
  P cake: [Black Forest] / cheesecake / apple
  S slice: small / [usual] / large
- Whipped cream — 1 portion
  C cream: none / [1 portion]
- Coffee with milk — 200 ml
  C milk: [little] / a lot
! presence+kind: "milk: none / whole / oat" would need a kind and a 0 in one question
```

#### 60. Leberkäse Semmel · German · street

```text
- Leberkäse Semmel — 1
  S slice: [usual] / thick
```

#### 61. Döner · German-Turkish · street

```text
- Döner ×1
  - Bread — 1
    U kind: [bread, 120 g] / dürüm wrap, 90 g / box (no bread), 0 g
  - Döner meat — 120 g
    P meat: [veal] / chicken
  - Salad — 60 g
  - Garlic sauce — 40 g
    C sauce: little 20 g / [usual 40 g] / extra 70 g
! two-whats: bread kind and meat kind are both "what" on one food; splitting into parts makes them independent
```

#### 62. Pierogi · Polish · restaurant

```text
- Pierogi ruskie — 8 pcs
  P filling: [ruskie] / meat / cabbage-mushroom
  C count: 6 / [8] / 10
- Fried onion — 20 g
- Sour cream — 30 g
  C amount: none / [30 g] / 50 g
```

#### 63. Żurek in a bread bowl · Polish · restaurant

```text
- Żurek — 350 ml
- Bread bowl — 1
  C eaten: none / [half] / all
```

#### 64. Bigos · Polish · home

```text
- Bigos — 300 g
  C portion: 200 g / [300 g] / 400 g
```

#### 65. Goulash with dumplings · Czech · pub

```text
- Goulash — 250 g
- Bread dumplings — 6 slices
  C slices: 4 / [6] / 8
- Beer — 500 ml
  S glass: 300 ml / [500 ml]
```

#### 66. Svíčková · Czech · restaurant

```text
- Beef sirloin in cream sauce — 250 g
- Dumplings — 5 slices
  C slices: 4 / [5] / 6
- Whipped cream with cranberries — 1 spoon
  C topping: none / [1 spoon]
```

#### 67. Trdelník with ice cream · Czech · street

```text
- Trdelník — 1
- Soft ice cream filling — 1 portion
  C filling: none / [1 portion]
```

#### 68. Weißwurst breakfast · Bavarian · restaurant

```text
- Weißwurst, without skin — 2 pcs
  C count: [2] / 3 / 4
- Brezel — 1
- Sweet mustard — 20 g
- Wheat beer — 500 ml
  C glasses: none / [1] / 2
```

#### 69. Flammkuchen, shared · Alsatian · restaurant

```text
- Flammkuchen — ½
  P kind: [classic] / with goat cheese
  C my share: ⅓ / [½] / whole
```

#### 70. Maultaschen in broth · Swabian · restaurant

```text
- Maultaschen — 3 pcs
  C count: 2 / [3] / 4
- Broth — 250 ml
  C drank: half / [all]
```

#### 71. Rösti with fried egg · Swiss · café

```text
- Rösti — 250 g
  C portion: 200 g / [250 g] / 300 g
- Fried egg — 1
```

#### 72. Raclette · Swiss · restaurant

```text
- Raclette cheese — 5 portions
  S portion: [30 g] / 50 g
  C portions: 3 / [5] / 7
- Potatoes in skin — 4 pcs
  C count: 3 / [4] / 6
- Pickles — 50 g
```

#### 73. Cheese fondue, shared · Swiss · restaurant

```text
- Bread cubes — 100 g
  C my bread: 60 g / [100 g] / 150 g
- Fondue cheese — 150 g
  C my cheese: 100 g / [150 g] / 200 g
```

#### 74. Kaiserschmarrn, shared · Austrian · restaurant

```text
- Kaiserschmarrn — ½ portion
  C my share: ⅓ / [½] / all
- Plum compote — 50 g
```

#### 75. Sachertorte · Austrian · café

```text
- Sachertorte — 1 slice
- Schlagobers — 1 portion
  C cream: none / [1 portion]
```

#### 76. Fischbrötchen · North German · street

```text
- Fischbrötchen with matjes — 1
  P fish: [matjes] / Bismarck herring / fried fish
```

#### 77. Kartoffelpuffer with apple sauce · German · market

```text
- Kartoffelpuffer — 3 pcs
  C count: 2 / [3] / 4
- Apple sauce — 60 g
```

#### 78. Jägerschnitzel · German · restaurant

```text
- Pork schnitzel — 1
  S size: [usual] / large
- Mushroom sauce — 100 g
  C sauce: 50 g / [100 g] / 150 g
- Fries — 150 g
```

#### 79. Obatzda with a pretzel and beer · Bavarian · beer garden

```text
- Obatzda — 80 g
  C my share: 40 g / [80 g]
- Brezel — 1
- Beer — 1 l
  S glass: 500 ml / [1 l Maß]
  C glasses: [1] / 2
```

#### 80. Kotlet schabowy · Polish · home

```text
- Kotlet schabowy — 1
- Boiled potatoes with dill — 200 g
  C portion: 150 g / [200 g] / 250 g
- Mizeria — 100 g
```

### French, Belgian, Dutch

#### 81. Croissant and café crème · French · café

```text
- Croissant — 1
  U kind: [plain, 60 g] / almond, 90 g / pain au chocolat, 70 g
- Café crème — 250 ml
  S cup: small 150 ml / [usual 250 ml] / large 350 ml
```

#### 82. Pain au chocolat · French · bakery

```text
- Pain au chocolat — 1
```

#### 83. Steak frites · French · bistro

```text
- Steak — 250 g
  P cut: [entrecôte] / bavette
  C steak: 200 g / [250 g] / 300 g
- Frites — 200 g
  C eaten: half / [most] / all
- Béarnaise — 30 g
  C sauce: none / [30 g] / 60 g
```

#### 84. Croque · French · café

```text
- Croque monsieur — 1
  U kind: [monsieur, 180 g] / madame, 230 g
```

#### 85. Quiche with side salad · French · café

```text
- Quiche lorraine — 1 slice
  S slice: small / [usual] / large
- Side salad, dressed — 60 g
```

#### 86. Moules-frites · Belgian · restaurant

```text
- Mussels, without shells — 250 g
  C pot: half kilo / [kilo]
- Frites — 200 g
  C eaten: half / [all]
- Mayo — 30 g
  C mayo: none / [30 g] / 60 g
! label-only: the pot is sold by shell weight, the amount is the edible part (≈25 %)
```

#### 87. Crêpe · French · street

```text
- Crêpe ×1
  - Crêpe — 1
  - Nutella — 30 g
    P filling: [Nutella] / sugar and lemon / ham and cheese
    C filling: little / [usual] / generous
! presence+kind: the filling's amount depends on the kind (sugar 10 g, Nutella 30 g); here labels are relative, so it works
```

#### 88. Galette complète · Breton · crêperie

```text
- Galette complète — 1
- Cider — 250 ml
  C bowls: none / [1] / 2
```

#### 89. Cheese board, shared · French · restaurant

```text
- Cheese — 60 g
  C my share: 30 g / [60 g] / 100 g
- Baguette — 2 slices
- Grapes — 50 g
```

#### 90. Bread and butter on the table · French · restaurant

```text
- Baguette — 1 piece
  C pieces: none / [1] / 2 / 3
- Butter — 10 g
  C butter: none / [10 g] / 20 g
```

#### 91. Boeuf bourguignon · French · restaurant

```text
- Boeuf bourguignon — 300 g
- Mashed potatoes — 150 g
  C portion: 100 g / [150 g] / 200 g
```

#### 92. Ratatouille · French · home

```text
- Ratatouille, usual oil — 250 g
  P oil: light / [usual] / oily
  C portion: 150 g / [250 g] / 350 g
```

#### 93. Salade niçoise · French · café

```text
- Niçoise without dressing — 350 g
- Dressing — 30 g
  C dressing: 15 g / [30 g] / 45 g
```

#### 94. Coq au vin · French · restaurant

```text
- Coq au vin, meat eaten — 250 g
- Potatoes — 150 g
```

#### 95. Macarons · French · pâtisserie

```text
- Macarons — 3 pcs
  C count: 2 / [3] / 5
```

#### 96. Escargots · French · restaurant

```text
- Escargots in garlic butter — 6 pcs
  S plate: [6] / 12
- Bread to dip — 1 piece
  C pieces: none / [1] / 2
! size-vs-count: "6 or 12" is a menu size of the plate, but it's also just a count; here a size with labels "6" and "12"
```

#### 97. Bouillabaisse · French · restaurant

```text
- Bouillabaisse, fish without bones — 250 g
- Broth — 300 ml
  C drank: half / [all]
- Croutons with rouille — 3 pcs
  C croutons: none / 2 / [3] / 5
```

#### 98. Tartiflette · French · restaurant

```text
- Tartiflette — 400 g
  C portion: 300 g / [400 g] / 500 g
```

#### 99. Belgian waffle · Belgian · street

```text
- Waffle — 1
  U kind: [Liège, 90 g] / Brussels, 60 g
- Whipped cream and strawberries — 1 portion
  C topping: none / [1 portion]
```

#### 100. Bitterballen and frites speciaal · Dutch · bar

```text
- Bitterballen — 6 pcs
  C my share: 3 / [6]
- Frites speciaal — 200 g
  S cone: small / [medium] / large
```

#### 101. Kibbeling with garlic sauce · Dutch · market

```text
- Kibbeling — 150 g
  S portion: [small 150 g] / large 250 g
- Garlic sauce — 30 g
  C sauce: none / [30 g] / 60 g
```

#### 102. Raw herring · Dutch · street

```text
- Hollandse nieuwe — 1
  C count: [1] / 2
- Onion — 20 g
```

#### 103. Glass of wine · French · bar

```text
- Red wine — 150 ml
  P wine: [red] / white / rosé / sweet
  S glass: 125 ml / [150 ml] / 250 ml
  C glasses: [1] / 2 / 3
```

#### 104. Aperol spritz with snacks · Italian · bar

```text
- Aperol spritz — 2
  C glasses: 1 / [2] / 3
- Free snacks (chips, olives) — 40 g
  C my share: 20 g / [40 g] / 80 g
```

#### 105. Profiteroles, shared · French · restaurant

```text
- Profiteroles — 2 pcs
  C my share: 1 / [2] / 3
```

#### 106. Duck confit · French · restaurant

```text
- Duck confit leg, meat eaten — 200 g
- Sarladaise potatoes — 200 g
  C portion: 150 g / [200 g] / 250 g
```

#### 107. Onion soup · French · bistro

```text
- Onion soup with cheese crust — 400 ml
  C bowl: 300 ml / [400 ml]
```

#### 108. Croissant sandwich · French · café

```text
- Croissant with ham and cheese — 1
```

#### 109. Tarte tatin with crème fraîche · French · restaurant

```text
- Tarte tatin — 1 slice
- Crème fraîche — 30 g
  C cream: none / [30 g]
```

#### 110. Stamppot with rookworst · Dutch · home

```text
- Stamppot — 350 g
  C portion: 250 g / [350 g] / 450 g
- Rookworst — ½
  C sausage: ¼ / [½] / whole
- Gravy — 50 g
  C gravy: none / [50 g] / 100 g
```

### Italian

#### 111. Carbonara · Italian · trattoria

```text
- Spaghetti carbonara — 350 g
  C portion: 250 g / [350 g] / 450 g
- Parmesan at the table — 10 g
  C cheese: none / [10 g] / 20 g
```

#### 112. Margherita, whole · Italian · pizzeria

```text
- Pizza margherita 30 cm — ¾
  P kind: [margherita] / marinara / quattro formaggi
  C eaten: ½ / [¾] / whole
```

#### 113. Pizza al taglio, 250 g on the receipt · Roman · shop

```text
- Pizza al taglio — 250 g
  P topping: [potato] / margherita / mortadella
```

#### 114. Lasagna · Italian · trattoria

```text
- Lasagna — 1 piece
  S piece: small 250 g / [usual 350 g] / large 450 g
```

#### 115. Risotto ai funghi · Italian · restaurant

```text
- Risotto ai funghi — 300 g
  P butter and cheese: light / [usual] / rich
  C portion: 250 g / [300 g] / 400 g
```

#### 116. Bread with olive oil · Italian · restaurant

```text
- Bread — 2 pieces
  C pieces: none / 1 / [2] / 3
- Olive oil — 10 ml
  C oil: none / [10 ml] / 20 ml
```

#### 117. Panino · Italian · bar

```text
- Panino prosciutto e mozzarella — 1
```

#### 118. Gelato · Italian · gelateria

```text
- Gelato — media
  S size: piccola / [media] / grande
- Cone — 1
  C cone: none / [1]
```

#### 119. Tiramisu · Italian · restaurant

```text
- Tiramisu — 1 portion
  S portion: small / [usual] / large
```

#### 120. Arancini · Sicilian · street

```text
- Arancini — 2 pcs
  U kind: [ragù, 120 g] / butter-ham, 120 g / mini, 40 g
  C count: 1 / [2] / 3
```

#### 121. Bruschetta · Italian · restaurant

```text
- Bruschetta with tomato — 3 pcs
  C my pieces: 1 / 2 / [3]
```

#### 122. Caprese · Italian · restaurant

```text
- Caprese without oil — 250 g
- Olive oil — 10 ml
  C oil: none / [10 ml] / 20 ml
```

#### 123. Cannoli · Sicilian · pasticceria

```text
- Cannolo — 1
  U kind: [large, 120 g] / mini, 30 g
  C count: [1] / 2 / 4
```

#### 124. Espresso with sugar · Italian · bar

```text
- Espresso — 30 ml
- Sugar — 1 sachet
  C sachets: none / [1] / 2
```

#### 125. Antipasto, shared · Italian · restaurant

```text
- Antipasto (cured meats, cheese, vegetables) — 100 g
  C my share: 60 g / [100 g] / 150 g
```

#### 126. Osso buco · Milanese · restaurant

```text
- Osso buco, meat eaten — 250 g
- Risotto alla milanese — 200 g
  C portion: 150 g / [200 g] / 250 g
```

#### 127. Polenta with ragù · Italian · trattoria

```text
- Polenta — 200 g
  C portion: 150 g / [200 g] / 300 g
- Ragù — 150 g
```

#### 128. Gnocchi with pesto · Italian · trattoria

```text
- Gnocchi — 300 g
  C portion: small 200 g / [usual 300 g] / large 400 g
- Pesto — 40 g
  C sauce: a little 20 g / [usual 40 g] / a lot 60 g
- Parmesan — 0 g
  C on top: [none] / 10 g / 20 g
```

#### 129. Focaccia · Ligurian · bakery

```text
- Focaccia — 1 piece
  S piece: small 80 g / [usual 120 g] / large 180 g
```

#### 130. Fritto misto · Italian · seaside

```text
- Fritto misto, edible — 250 g
  C portion: 150 g / [250 g] / 350 g
```

#### 131. Pasta e fagioli · Italian · home

```text
- Pasta e fagioli — 400 g
  C bowl: 300 g / [400 g] / 500 g
```

#### 132. Piadina · Romagna · street

```text
- Piadina — 1
  U filling: [prosciutto-squacquerone, 250 g] / sausage-cheese, 280 g / vegetables, 220 g
```

#### 133. Affogato · Italian · café

```text
- Affogato — 1
```

#### 134. Calzone, left half · Italian · pizzeria

```text
- Calzone — ½
  C eaten: ½ / [¾] / whole
```

#### 135. Supplì · Roman · street

```text
- Supplì — 2 pcs
  C count: 1 / [2] / 3
```

#### 136. Cacio e pepe · Roman · trattoria

```text
- Cacio e pepe — 300 g
  C portion: 250 g / [300 g] / 400 g
```

#### 137. Spaghetti alle vongole · Italian · restaurant

```text
- Spaghetti alle vongole, without shells — 350 g
  C portion: 250 g / [350 g] / 450 g
```

#### 138. Panna cotta · Italian · restaurant

```text
- Panna cotta with berry sauce — 1
```

#### 139. Cornetto and cappuccino at the bar · Italian · bar

```text
- Cornetto — 1
  U kind: [plain, 50 g] / cream-filled, 80 g / jam, 75 g / pistachio, 90 g
- Cappuccino — 180 ml
```

#### 140. Aperitivo · Italian · bar

```text
- Negroni — 1
  C drinks: [1] / 2
- Olives — 40 g
- Chips — 30 g
  C my share: 15 g / [30 g] / 60 g
```

### Spanish, Portuguese

#### 141. Paella from the pan · Spanish · restaurant

```text
- Paella, edible — 350 g
  P kind: [mixta] / seafood / Valenciana
  C my portion: 250 g / [350 g] / 450 g
```

#### 142. Tapas · Spanish · bar

```text
- Patatas bravas — 120 g
  C my share: 60 g / [120 g] / 200 g
- Croquetas — 3 pcs
  C count: 2 / [3] / 4
- Jamón — 40 g
  C slices: 20 g / [40 g] / 60 g
```

#### 143. Tortilla española · Spanish · bar

```text
- Tortilla española — 1 slice
  S slice: pincho 100 g / [ración 200 g]
```

#### 144. Churros with chocolate · Spanish · café

```text
- Churros — 4 pcs
  C count: 3 / [4] / 6
- Hot chocolate — 200 ml
  C drank: ⅓ / [½] / all
```

#### 145. Bocadillo de calamares · Madrid · bar

```text
- Bocadillo de calamares — 1
```

#### 146. Gazpacho · Andalusian · restaurant

```text
- Gazpacho — 250 ml
  S serving: glass 200 ml / [bowl 300 ml]
```

#### 147. Pulpo a la gallega · Galician · restaurant

```text
- Pulpo — 200 g
  C my share: 100 g / [200 g]
- Potatoes — 150 g
- Olive oil — 15 ml
  C oil: 5 ml / [15 ml] / 25 ml
```

#### 148. Jamón ibérico, fat left · Spanish · bar

```text
- Jamón ibérico, eaten — 60 g
  C eaten: 40 g / [60 g] / 80 g
```

#### 149. Pan con tomate · Catalan · bar

```text
- Pan con tomate — 2 slices
  C slices: 1 / [2] / 3
- Olive oil — 10 ml
  C oil: 5 ml / [10 ml] / 20 ml
```

#### 150. Pastéis de nata · Portuguese · café

```text
- Pastel de nata — 2
  C count: 1 / [2] / 3
```

#### 151. Francesinha · Portuguese · restaurant

```text
- Francesinha ×1
  - Bread — 2 slices
  - Meats — 150 g
  - Melted cheese — 60 g
  - Egg — 1
    C egg on top: none / [1]
  - Sauce — 150 g
    C sauce: 100 g / [150 g] / 250 g
- Fries — 150 g
  C eaten: none / half / [all]
```

#### 152. Bacalhau à Brás · Portuguese · restaurant

```text
- Bacalhau à Brás — 350 g
  C portion: 250 g / [350 g] / 450 g
```

#### 153. Caldo verde · Portuguese · restaurant

```text
- Caldo verde — 300 ml
- Chouriço — 3 slices
  C slices: 2 / [3] / 5
```

#### 154. Sangria, a jug shared · Spanish · restaurant

```text
- Sangria — 2 glasses
  S glass: [200 ml] / 300 ml
  C my glasses: 1 / [2] / 3
```

#### 155. Cortado and magdalena · Spanish · café

```text
- Cortado — 1
- Magdalena — 1
```

#### 156. Pimientos de Padrón · Galician · bar

```text
- Pimientos de Padrón — 100 g
  P oil: light / [usual] / oily
  C my share: 50 g / [100 g]
```

#### 157. Albóndigas · Spanish · bar

```text
- Albóndigas in tomato sauce — 5 pcs
  P meat: [pork-beef] / chicken
  C count: 4 / [5] / 6
```

#### 158. Empanada gallega · Galician · bakery

```text
- Empanada gallega — 1 slice
  P filling: [tuna] / pork / cod
  S slice: small / [usual] / large
```

#### 159. Prego · Portuguese · café

```text
- Prego no pão — 1
```

#### 160. Arroz negro with alioli · Valencian · restaurant

```text
- Arroz negro — 350 g
  C my portion: 250 g / [350 g] / 450 g
- Alioli — 20 g
  C alioli: none / [20 g] / 40 g
```

#### 161. Gambas al ajillo · Spanish · bar

```text
- Prawns, peeled — 100 g
- Garlic oil soaked up with bread — 2 pieces
  C bread dipped: none / 1 / [2] / 4
! partly-eaten-liquid: the oil eaten is in the bread; the bread row's count stands for it
```

#### 162. Patatas a lo pobre · Andalusian · restaurant

```text
- Patatas a lo pobre, usual oil — 250 g
  P oil: [usual] / oily
```

#### 163. Bifana · Portuguese · café

```text
- Bifana — 1
- Mustard — 10 g
```

#### 164. Pintxos · Basque · bar

```text
- Pintxos, assorted — 4 pcs
  C count: 3 / [4] / 6
```

#### 165. Grilled sardines · Portuguese · festival

```text
- Sardines, edible — 4 pcs
  C count: 3 / [4] / 6
- Bread — 1 slice
```

### British, Irish, Nordic

#### 166. Full English · British · café

```text
- Fried eggs — 2
- Bacon — 2 rashers
  C rashers: [2] / 3
- Sausages — 2
- Baked beans — 100 g
- Toast — 2 slices
- Butter — 10 g
  C butter: none / [10 g] / 20 g
- Black pudding — 1 slice
  C slices: none / [1] / 2
- Fried mushrooms — 60 g
```

#### 167. Fish and chips · British · chippy

```text
- Cod in batter — 1
  P fish: [cod] / haddock
  S size: [regular] / large
- Chips — 250 g
  C eaten: half / [most] / all
- Mushy peas — 80 g
- Tartare sauce — 30 g
  C sauce: none / [30 g] / 60 g
```

#### 168. Sunday roast · British · pub

```text
- Roast beef — 3 slices
  P meat: [beef] / lamb / chicken / pork
  C slices: 2 / [3] / 4
- Roast potatoes — 4
  C count: 3 / [4] / 6
- Yorkshire pudding — 1
- Vegetables — 100 g
- Gravy — 100 ml
  C gravy: 50 ml / [100 ml] / 150 ml
```

#### 169. Scones with cream and jam · British · tea room

```text
- Scone ×2
  C scones: 1 / [2]
  - Scone — 1
  - Clotted cream — 25 g
    C cream: 15 g / [25 g] / 40 g
  - Jam — 20 g
```

#### 170. Afternoon tea for two · British · hotel

```text
- Finger sandwiches — 3
  C my share: 2 / [3] / 4
- Scone ×1
  - Scone — 1
  - Clotted cream — 25 g
  - Jam — 20 g
- Small cakes — 2
  C my share: 1 / [2] / 3
- Tea with milk — 2 cups
```

#### 171. Shepherd's pie · British · pub

```text
- Shepherd's pie — 1 portion
  S portion: [usual 350 g] / large 500 g
```

#### 172. Ploughman's lunch · British · pub

```text
- Cheddar — 60 g
- Ham — 50 g
- Crusty bread — 2 pieces
- Pickle and chutney — 30 g
- Apple — ½
```

#### 173. Meal deal · British · shop

```text
- Sandwich (label) — 1
- Crisps (label) — 1 bag
- Soft drink (label) — 500 ml
```

#### 174. Pie, mash and liquor · London · pie shop

```text
- Beef pie — 1
- Mash — 200 g
  C scoops: [1] / 2
- Liquor (parsley sauce) — 80 ml
```

#### 175. Bacon butty · British · café

```text
- Bacon butty ×1
  - Bread — 2 slices
  - Bacon — 3 rashers
  - Butter — 10 g
  - Sauce — 15 g
    P sauce: [brown sauce] / ketchup
    C sauce: none / [15 g]
! presence+kind: "none / brown / ketchup" is one question to a person; here it's two
```

#### 176. A pint · British · pub

```text
- Lager — 1 pint
  P beer: [lager] / ale / stout / cider
  S glass: half 284 ml / [pint 568 ml]
  C rounds: [1] / 2 / 3
```

#### 177. Cornish pasty · British · bakery

```text
- Cornish pasty — 1
  S size: medium 200 g / [large 300 g]
```

#### 178. Irish stew · Irish · pub

```text
- Irish stew, meat off the bone — 400 g
  C bowl: 300 g / [400 g]
- Soda bread — 1 slice
```

#### 179. Sticky toffee pudding · British · pub

```text
- Sticky toffee pudding — 1
- Custard — 80 g
  P with: [custard] / ice cream / cream
```

#### 180. Tea with milk through the afternoon · British · office

```text
- Tea with milk — 3 mugs
  C mugs: 2 / [3] / 4
- Sugar — 1 tsp per mug
  C sugar: [none] / 1 tsp / 2 tsp
! per-serving-across-rows: sugar per mug × mugs; two rows can't link — as a dish "Tea with milk and sugar ×3" with parts it works
```

#### 181. Smørrebrød · Danish · restaurant

```text
- Smørrebrød with herring ×1
  - Rye bread — 1 slice
  - Butter — 8 g
  - Pickled herring — 50 g
- Smørrebrød with roast beef ×1
  - Rye bread — 1 slice
  - Butter — 8 g
  - Roast beef — 60 g
  - Remoulade — 20 g
    C remoulade: [20 g] / 40 g
- Smørrebrød with egg and shrimp ×1
  - Rye bread — 1 slice
  - Egg — 1
  - Shrimp — 40 g
  - Mayo — 15 g
```

#### 182. Kanelbulle and coffee · Swedish · café

```text
- Kanelbulle — 1
  U kind: [kanelbulle, 90 g] / kardemummabulle, 90 g / giant, 200 g
- Coffee — 200 ml
```

#### 183. Köttbullar · Swedish · restaurant

```text
- Köttbullar — 10
  C count: 8 / [10] / 12 / 15
- Mash — 200 g
- Cream gravy — 80 g
  C gravy: 50 g / [80 g] / 120 g
- Lingonberries — 30 g
```

#### 184. Gravlax · Swedish · restaurant

```text
- Gravlax — 100 g
  C slices: 60 g / [100 g] / 150 g
- Mustard sauce — 30 g
  C sauce: none / [30 g] / 50 g
```

#### 185. Danish hot dog · Danish · street

```text
- Hot dog with remoulade and onions ×1
  - Bun — 1
  - Sausage — 1
    P sausage: [red pølse] / grilled
  - Remoulade — 20 g
  - Crispy onions — 10 g
```

#### 186. Laksesuppe · Norwegian · restaurant

```text
- Creamy salmon soup — 350 ml
  P cream: light / [creamy]
  C bowl: 250 ml / [350 ml]
```

#### 187. Karjalanpiirakka · Finnish · café

```text
- Karelian pie ×2
  C pies: 1 / [2] / 3
  - Pie — 1
  - Egg butter — 15 g
    C egg butter: none / [15 g] / 30 g
```

#### 188. Crispbread with butter and cheese · Swedish · home

```text
- Crispbread with cheese ×3
  C pieces: 2 / [3] / 4
  - Crispbread — 1
  - Butter — 5 g
    C butter: none / [5 g] / 10 g
  - Cheese — 1 slice
```

#### 189. Lutefisk · Norwegian · Christmas

```text
- Lutefisk, edible — 250 g
- Potatoes — 150 g
- Bacon fat with bacon bits — 30 g
  C fat: 15 g / [30 g] / 50 g
```

#### 190. Fika · Swedish · café

```text
- Cardamom bun — 1
- Cookie — 1
- Coffee — 200 ml
```

#### 191. Irish breakfast · Irish · hotel

```text
- Eggs — 2
- Rashers — 2
- Sausages — 2
- White and black pudding — 2 slices
- Soda bread — 1 slice
- Butter — 10 g
```

#### 192. Beans on toast · British · home

```text
- Toast — 2 slices
- Baked beans — 200 g
  C beans: ½ can / [whole can]
- Butter — 5 g
```

#### 193. Chicken tikka masala · British-Indian · restaurant

```text
- Chicken tikka masala — 350 g
- Pilau rice — 200 g
  C rice: 150 g / [200 g] / 300 g
- Naan — 1
  U kind: [plain, 100 g] / garlic, 110 g / peshwari, 140 g
```

#### 194. Sausage roll · British · bakery

```text
- Sausage roll — 1
  S size: [regular 120 g] / jumbo 180 g
```

#### 195. Eton mess · British · restaurant

```text
- Eton mess — 1 portion
```

### Greek, Turkish, Balkan

#### 196. Gyro pita · Greek · street

```text
- Gyro pita ×1
  - Pita — 1
  - Gyros meat — 100 g
    P meat: [pork] / chicken
  - Tzatziki — 30 g
  - Fries inside — 30 g
    C fries: none / [30 g]
  - Tomato and onion — 40 g
```

#### 197. Souvlaki plate · Greek · taverna

```text
- Souvlaki — 2 skewers
  P meat: [pork] / chicken
  C skewers: 1 / [2] / 3
- Pita — 1
- Tzatziki — 50 g
- Fries — 100 g
  C fries: none / [100 g] / 200 g
```

#### 198. Greek salad · Greek · taverna

```text
- Greek salad without oil — 250 g
  C my share: 125 g / [250 g]
- Feta — 70 g
- Olives, pitted weight — 20 g
- Olive oil — 20 ml
  C oil: 10 ml / [20 ml] / 30 ml
```

#### 199. Moussaka · Greek · taverna

```text
- Moussaka — 1 portion
  S portion: [usual 350 g] / large 450 g
```

#### 200. Spanakopita · Greek · bakery

```text
- Spanakopita — 1 piece
  S piece: small / [usual] / large
```

#### 201. Baklava · Turkish · pastry shop

```text
- Baklava — 2 pcs
  P kind: [walnut] / pistachio
  C count: 1 / [2] / 3 / 4
```

#### 202. Loukoumades, shared · Greek · café

```text
- Loukoumades with honey — 6
  C my share: 4 / [6] / 10
```

#### 203. Frappé · Greek · café

```text
- Frappé with milk — 300 ml
  P sugar: sketos / [metrios] / glykos
```

#### 204. Turkish breakfast for two · Turkish · café

```text
- Bread — 2 slices
  C slices: 1 / [2] / 3
- Menemen — 150 g
  C my share: 100 g / [150 g] / 200 g
- Cheeses — 50 g
- Olives — 20 g
- Honey and kaymak — 30 g
  C my share: 15 g / [30 g] / 50 g
- Tea — 2 glasses
```

#### 205. Simit with cheese · Turkish · street

```text
- Simit — 1
- White cheese — 40 g
```

#### 206. İskender · Turkish · restaurant

```text
- İskender ×1
  S portion: [1] / 1.5
  - Pide bread — 80 g
  - Döner meat — 150 g
  - Tomato sauce — 60 g
  - Yogurt — 80 g
  - Melted butter — 15 g
    C butter: 10 g / [15 g] / 25 g
```

#### 207. Lahmacun · Turkish · restaurant

```text
- Lahmacun — 2
  C count: 1 / [2] / 3
- Salad inside — 50 g
```

#### 208. Pide, ate half · Turkish · restaurant

```text
- Pide with egg — ½
  P kind: [kaşarlı yumurtalı] / kıymalı / kuşbaşılı
  C eaten: ½ / [¾] / whole
```

#### 209. Mantı · Turkish · restaurant

```text
- Mantı — 300 g
  C portion: 200 g / [300 g]
- Yogurt — 100 g
- Butter with pepper — 15 g
```

#### 210. Köfte plate · Turkish · restaurant

```text
- Köfte — 6
  C count: 4 / [6] / 8
- Rice — 150 g
  C rice: none / [150 g] / 250 g
- Salad — 80 g
```

#### 211. Turkish tea with sugar · Turkish · home

```text
- Tea with sugar ×3
  C glasses: 2 / [3] / 5
  - Tea — 100 ml
  - Sugar cubes — 1
    C cubes: none / [1] / 2
```

#### 212. Ayran · Turkish · restaurant

```text
- Ayran — 300 ml
  S bottle: 200 ml / [300 ml]
```

#### 213. Börek · Turkish · bakery

```text
- Börek — 1 piece
  P filling: [cheese] / mince / spinach / potato
  S piece: small / [usual] / large
```

#### 214. Ćevapi · Bosnian · restaurant

```text
- Ćevapi — 10
  S portion: mala 5 / [velika 10]
- Lepinja — 1
- Kajmak — 30 g
  C kajmak: none / [30 g] / 60 g
- Onion — 30 g
```

#### 215. Burek with yoghurt · Bosnian · bakery

```text
- Burek — 250 g
  P filling: [meat] / cheese (sirnica) / spinach (zeljanica)
  C eaten: 150 g / [250 g] / 350 g
- Yoghurt drink — 250 ml
```

#### 216. Pljeskavica · Serbian · street

```text
- Pljeskavica in lepinja ×1
  - Lepinja — 1
  - Pljeskavica — 1
    S size: [regular 200 g] / gurmanska 300 g
  - Kajmak — 30 g
  - Onion — 30 g
```

#### 217. Sarma · Balkan · home

```text
- Sarma — 3
  C count: 2 / [3] / 4
- Sour cream — 30 g
```

#### 218. Ajvar on bread · Balkan · home

```text
- Bread — 2 slices
- Ajvar — 40 g
  C ajvar: 20 g / [40 g] / 60 g
```

#### 219. Shopska salad · Bulgarian · restaurant

```text
- Shopska salad — 300 g
- Grated sirene — 50 g
  C cheese: 30 g / [50 g] / 80 g
- Oil — 10 ml
  C oil: none / [10 ml] / 20 ml
```

#### 220. Kumpir · Turkish · street

```text
- Kumpir ×1
  - Baked potato mashed with butter and cheese — 350 g
    P mash-in: light / [usual] / rich
  - Toppings (corn, olives, sausage, salad) — 150 g
    C toppings: 100 g / [150 g] / 200 g
  - Mayo and ketchup — 30 g
    C sauce: none / [30 g] / 60 g
```

#### 221. Dondurma cone · Turkish · street

```text
- Dondurma — 2 scoops
  C scoops: 1 / [2] / 3
- Cone — 1
```

#### 222. Künefe · Turkish · restaurant

```text
- Künefe — 1 portion
  C my share: ½ / [whole]
```

#### 223. Midye dolma · Turkish · street

```text
- Stuffed mussels — 10
  C count: 6 / [10] / 15
```

#### 224. Balık ekmek · Istanbul · street

```text
- Balık ekmek ×1
  - Bread — ½ loaf
  - Mackerel fillet — 1
  - Onion and salad — 50 g
```

#### 225. Greek yoghurt with honey and walnuts · Greek · café

```text
- Greek yoghurt — 200 g
  C bowl: 150 g / [200 g]
- Honey — 20 g
  C honey: 10 g / [20 g] / 30 g
- Walnuts — 15 g
```

### Middle East, North Africa, Iran

#### 226. Hummus with pita · Levantine · restaurant

```text
- Hummus — 200 g
  C my share: 100 g / [200 g]
- Olive oil on top — 15 ml
  C oil: 5 ml / [15 ml] / 25 ml
- Pita — 2
  C pitas: 1 / [2] / 3
```

#### 227. Falafel wrap · Levantine · street

```text
- Falafel wrap ×1
  - Pita — 1
  - Falafel — 4
    C balls: 3 / [4] / 5
  - Tahini — 30 g
    C tahini: 15 g / [30 g] / 50 g
  - Salad and pickles — 60 g
```

#### 228. Shawarma plate · Levantine · restaurant

```text
- Chicken shawarma — 200 g
  P meat: [chicken] / beef
- Rice — 200 g
- Toum — 30 g
  C toum: 15 g / [30 g] / 60 g
- Salad — 80 g
- Fries — 0 g
  C fries: [none] / 100 g
```

#### 229. Mezze for four · Lebanese · restaurant

```text
- Hummus — 60 g
  C my share: 40 g / [60 g] / 100 g
- Moutabal — 50 g
- Tabbouleh — 60 g
- Fattoush — 60 g
- Falafel — 2
  C count: 1 / [2] / 3
- Kibbeh — 1
  C count: none / [1] / 2
- Pita — 1
  C pitas: ½ / [1] / 2
```

#### 230. Mansaf, shared · Jordanian · home

```text
- Lamb, off the bone — 150 g
  C my share: 100 g / [150 g] / 250 g
- Rice with jameed — 250 g
  C rice: 150 g / [250 g] / 350 g
- Shrak bread — 1 piece
```

#### 231. Manakish · Lebanese · bakery

```text
- Manakish — 1
  U kind: [za'atar, 120 g] / cheese, 150 g / half-half, 135 g
```

#### 232. Kunafa · Palestinian · sweet shop

```text
- Kunafa — 1 piece
  S piece: small / [usual] / large
```

#### 233. Shakshuka · Israeli · café

```text
- Shakshuka — 2 eggs
  C eggs: [2] / 3
- Bread — 2 slices
  C slices: 1 / [2] / 3
```

#### 234. Couscous royal · Moroccan · restaurant

```text
- Couscous — 250 g
- Merguez — 2
- Chicken, off the bone — 100 g
- Lamb — 80 g
- Vegetable broth — 200 ml
  C ladles: 1 / [2] / 3
```

#### 235. Tagine, shared · Moroccan · restaurant

```text
- Chicken tagine with lemon and olives — 300 g
  P meat: [chicken] / lamb / beef with prunes
  C my share: 200 g / [300 g] / 400 g
- Bread — 1 piece
  C pieces: none / [1] / 2
```

#### 236. Mint tea, sweet · Moroccan · café

```text
- Mint tea — 3 glasses
  P sugar: light / [usual] / very sweet
  C glasses: 2 / [3] / 4
```

#### 237. Msemen with honey · Moroccan · café

```text
- Msemen — 1
- Honey — 20 g
  C honey: none / [20 g] / 40 g
```

#### 238. Kofta platter · Egyptian · restaurant

```text
- Kofta — 4
  C count: 3 / [4] / 6
- Rice — 150 g
- Tahini — 30 g
```

#### 239. Fattoush · Lebanese · restaurant

```text
- Fattoush — 250 g
  P fried bread: little / [usual] / a lot
```

#### 240. Koshari · Egyptian · street

```text
- Koshari — 1
  S size: small 300 g / [medium 450 g] / large 600 g
- Crispy onions — 20 g
- Tomato sauce — 60 g
  C sauce: 30 g / [60 g] / 100 g
```

#### 241. Ful medames · Egyptian · street

```text
- Ful medames — 200 g
- Oil — 10 ml
  C oil: 5 ml / [10 ml] / 20 ml
- Baladi bread — 1
```

#### 242. Dates · Gulf · home

```text
- Dates — 5
  U kind: [medjool, 20 g] / deglet, 8 g
  C count: 3 / [5] / 8
```

#### 243. Grilled halloumi · Cypriot · restaurant

```text
- Halloumi — 3 slices
  C slices: 2 / [3] / 4
```

#### 244. Sabich · Israeli · street

```text
- Sabich ×1
  - Pita — 1
  - Fried eggplant — 80 g
    P oil: light / [usual] / oily
  - Egg — 1
  - Tahini — 30 g
  - Salad and amba — 50 g
```

#### 245. Chelo kebab · Persian · restaurant

```text
- Saffron rice with butter — 300 g
  C rice: 200 g / [300 g] / 400 g
- Tahdig — 1 piece
  C pieces: none / [1] / 2
- Koobideh — 2 skewers
  P meat: [lamb-beef] / chicken
- Grilled tomato — 1
```

#### 246. Ghormeh sabzi · Persian · home

```text
- Ghormeh sabzi — 250 g
- Rice — 250 g
  C rice: 150 g / [250 g] / 350 g
```

#### 247. Tahdig, shared · Persian · home

```text
- Tahdig — 2 pieces
  C my pieces: 1 / [2] / 3
```

#### 248. Shish taouk · Lebanese · restaurant

```text
- Shish taouk — 1 skewer
- Fries — 150 g
- Garlic sauce — 30 g
  C sauce: 15 g / [30 g] / 60 g
```

#### 249. Maqluba, shared · Palestinian · home

```text
- Maqluba — 350 g
  C my portion: 250 g / [350 g] / 450 g
```

#### 250. Ma'amoul · Levantine · home

```text
- Ma'amoul — 2
  P filling: [date] / walnut / pistachio
  C count: 1 / [2] / 3
```

### Indian subcontinent

#### 251. Veg thali · Indian · restaurant

```text
- Rice — 200 g
  C refills: [1 serving] / 2 servings
- Dal — 1 katori
  C katoris: [1] / 2 / 3
- Sabzi, two kinds — 150 g
- Roti with ghee ×3
  C roti: 2 / [3] / 4 / 5
  - Roti — 1
  - Ghee — 3 g
    C ghee: none / [3 g] / 8 g
- Curd — 100 g
- Gulab jamun — 1
```

#### 252. Chicken biryani · Hyderabadi · restaurant

```text
- Chicken biryani, meat off the bone — 400 g
  P ghee: light / [usual] / rich
  C portion: 300 g / [400 g] / 550 g
- Raita — 60 g
```

#### 253. Butter chicken with naan · North Indian · restaurant

```text
- Butter chicken — 300 g
  C my share: 200 g / [300 g]
- Naan — 1
  U kind: [plain, 100 g] / butter, 110 g / garlic, 110 g / cheese, 140 g
  C count: [1] / 2
- Jeera rice — 150 g
  C rice: none / [150 g] / 250 g
```

#### 254. Masala dosa · South Indian · restaurant

```text
- Masala dosa — 1
- Sambar — 2 cups
  C cups: 1 / [2] / 3
- Coconut chutney — 50 g
  C chutney: 25 g / [50 g] / 100 g
```

#### 255. Idli · South Indian · canteen

```text
- Idli — 3
  C count: 2 / [3] / 4
- Sambar — 1 cup
- Chutney — 40 g
```

#### 256. Chole bhature · Punjabi · restaurant

```text
- Bhatura — 2
  S size: [usual 80 g] / huge 130 g
  C count: 1 / [2]
- Chole — 200 g
```

#### 257. Pav bhaji · Mumbai · street

```text
- Bhaji — 250 g
- Buttered pav ×2
  C pav: [2] / 3 / 4
  - Pav — 1
  - Butter — 8 g
    C butter: 4 g / [8 g] / 15 g
```

#### 258. Vada pav · Mumbai · street

```text
- Vada pav — 1
  C count: [1] / 2
```

#### 259. Samosa · North Indian · street

```text
- Samosa — 2
  U kind: [Punjabi potato, 100 g] / small, 40 g / keema, 90 g
  C count: 1 / [2] / 3
- Chutney — 30 g
```

#### 260. Pani puri · Indian · street

```text
- Pani puri — 6
  C plates of 6: [1] / 2
```

#### 261. Paneer tikka · North Indian · restaurant

```text
- Paneer tikka — 6 pieces
  C my pieces: 3 / [6]
```

#### 262. Dal makhani with jeera rice · Punjabi · restaurant

```text
- Dal makhani — 250 g
  P butter and cream: light / [usual] / rich
- Jeera rice — 200 g
```

#### 263. Aloo paratha · Punjabi · home

```text
- Aloo paratha with butter ×2
  C parathas: 1 / [2] / 3
  - Aloo paratha — 1
  - Butter — 10 g
    C butter: none / [10 g] / 20 g
- Curd — 100 g
```

#### 264. Masala chai · Indian · street

```text
- Masala chai — 2 cups
  P sugar: less / [usual] / extra
  S cup: [cutting 80 ml] / glass 150 ml
  C cups: 1 / [2] / 3
```

#### 265. Lassi · Punjabi · dhaba

```text
- Lassi — 1 glass
  P kind: [sweet] / salted / mango
  S glass: [300 ml] / 500 ml
```

#### 266. Gulab jamun · Indian · restaurant

```text
- Gulab jamun — 2
  S size: small 30 g / [usual 45 g] / large 60 g
  C count: [2] / 3
- Syrup from the bowl — 15 g
  C syrup: none / [a little] / all
```

#### 267. Jalebi, 100 g by weight · Indian · sweet shop

```text
- Jalebi — 100 g
```

#### 268. Poha · Maharashtrian · home

```text
- Poha — 200 g
- Sev and peanuts — 20 g
```

#### 269. Pongal with ghee · Tamil · restaurant

```text
- Ven pongal — 250 g
  P ghee: light / [usual] / generous
```

#### 270. Haleem · Hyderabadi · restaurant

```text
- Haleem — 300 g
  C bowl: 200 g / [300 g]
```

#### 271. Kerala sadya on a banana leaf · Keralan · festival

```text
- Rice — 300 g
  C rice: 200 g / [300 g] / 400 g
- Curries, assorted (sambar, avial, thoran, olan) — 250 g
- Pappadam — 2
- Payasam — 1 cup
  C cups: none / [1] / 2
- Banana chips — 20 g
```

#### 272. Fish curry with rice · Goan · restaurant

```text
- Fish curry, fish off the bone — 250 g
- Rice — 200 g
```

#### 273. Tandoori chicken · Punjabi · restaurant

```text
- Tandoori chicken, off the bone — half
  S portion: [half] / full
  C my share: ½ / [all]
! size-vs-count: "half / full chicken" is a menu size; "my share" a count; both on one row, fine
```

#### 274. Rogan josh · Kashmiri · restaurant

```text
- Rogan josh — 250 g
- Rice — 200 g
```

#### 275. Momos · Tibetan-Nepali · street

```text
- Chicken momos — 8
  P kind: [chicken, steamed] / pork, steamed / veg, steamed / chicken, fried
  C count: 6 / [8] / 10
- Chutney — 30 g
```

#### 276. Thukpa · Tibetan · café

```text
- Thukpa — 500 ml
  P meat: [chicken] / beef / veg
  C bowl: 400 ml / [500 ml]
```

#### 277. Hilsa curry, shared · Bengali · home

```text
- Hilsa, off the bone — 100 g
  C pieces: [1] / 2
- Rice — 200 g
```

#### 278. Nihari with naan · Pakistani · restaurant

```text
- Nihari — 300 g
  P fat layer: skimmed / [usual]
- Naan — 1
```

#### 279. Sri Lankan rice and curry · Sri Lankan · restaurant

```text
- Rice — 250 g
- Curries, five kinds — 300 g
  C curries: 200 g / [300 g] / 400 g
- Pol sambol — 30 g
```

#### 280. Kottu roti · Sri Lankan · street

```text
- Chicken kottu — 450 g
  P kind: [chicken] / egg / cheese
  C portion: 350 g / [450 g] / 600 g
```

#### 281. Dal bhat · Nepali · restaurant

```text
- Rice — 250 g
  C refills: [1] / 2 / 3
- Dal — 200 g
  C refills: [1] / 2
- Tarkari — 100 g
- Achar — 20 g
```

#### 282. Kathi roll · Kolkata · street

```text
- Kathi roll — 1
  U kind: [chicken, 200 g] / egg chicken, 250 g / paneer, 200 g
  C count: [1] / 2
```

#### 283. Mango · Indian · home

```text
- Mango, flesh — 1
  S size: small 150 g / [medium 250 g] / large 350 g
```

#### 284. Kheer · Indian · home

```text
- Kheer — 1 bowl
  S bowl: small 100 g / [usual 150 g]
```

#### 285. Dhokla · Gujarati · snack shop

```text
- Dhokla — 4 pieces
  C pieces: 3 / [4] / 6
```

#### 286. Rajma chawal · Punjabi · home

```text
- Rajma — 200 g
- Rice — 200 g
```

#### 287. Rasmalai · Bengali · restaurant

```text
- Rasmalai — 2
  C count: 1 / [2] / 3
```

#### 288. Wedding buffet, two trips · Indian · wedding

```text
- Plate one ×1
  - Biryani — 200 g
  - Paneer butter masala — 120 g
  - Naan — 1
- Plate two ×1
  - Dal makhani — 100 g
  - Chicken curry — 120 g
  - Rice — 100 g
- Gulab jamun — 2
  C count: 1 / [2] / 3
! plate-as-dish: the plates are dishes only to keep two trips apart; nothing is asked of them — could be plain rows
```

#### 289. Ready meal from a pack · Indian · office

```text
- Chicken korma with rice (label) — 1 pack
```

#### 290. Papdi chaat · Delhi · street

```text
- Papdi chaat — 1 plate
```

### Chinese, Taiwanese, Hong Kong

#### 291. Xiaolongbao · Shanghainese · restaurant

```text
- Pork xiaolongbao — 6
  P filling: [pork] / crab and pork
  C count: 4 / [6] / 8
```

#### 292. Jianbing · Northern Chinese · street

```text
- Jianbing ×1
  - Crepe with egg — 1
  - Crispy cracker inside — 1
    P cracker: [baocui sheet] / youtiao
  - Sauce — 20 g
```

#### 293. Peking duck · Beijing · restaurant

```text
- Duck wrap ×6
  C my wraps: 4 / [6] / 8
  - Pancake — 1
  - Duck with skin — 25 g
  - Hoisin — 5 g
- Duck soup — 200 ml
  C soup: none / [1 bowl]
```

#### 294. Mapo tofu with rice, family style · Sichuan · restaurant

```text
- Mapo tofu — 200 g
  P oil: [usual] / oily
  C my share: 120 g / [200 g] / 300 g
- Rice — 1 bowl
  C bowls: [1] / 2
```

#### 295. Kung pao chicken, shared · Sichuan · restaurant

```text
- Kung pao chicken — 200 g
  C my share: 120 g / [200 g] / 300 g
- Rice — 1 bowl
```

#### 296. Hot pot · Sichuan · restaurant

```text
- Beef and lamb slices — 200 g
  C my meat: 100 g / [200 g] / 300 g
- Vegetables, tofu, mushrooms — 200 g
- Noodles — 100 g
  C noodles: none / [100 g] / 200 g
- Dipping sauce — 50 g
  P sauce: [sesame] / garlic and oil / soy and vinegar
  C sauce: 30 g / [50 g] / 80 g
- Broth — 0
  C broth: [none] / 1 bowl
```

#### 297. Dim sum · Cantonese · restaurant

```text
- Har gow — 4
  C my pieces: 2 / [4]
- Siu mai — 4
  C my pieces: 2 / [4]
- Char siu bao — 2
  C count: 1 / [2] / 3
- Cheung fun — 3 rolls
  C my rolls: [3] / 6
- Egg tart — 1
```

#### 298. Congee with youtiao · Cantonese · café

```text
- Congee with pork and century egg — 400 g
- Youtiao — 1
  C youtiao: none / [1]
```

#### 299. Char siu rice · Cantonese · roast shop

```text
- Char siu — 120 g
- Rice — 250 g
- Sauce drizzled — 30 g
  C sauce: [usual] / extra
```

#### 300. Hainanese chicken rice · Singaporean · hawker

```text
- Chicken, off the bone — 150 g
  P cut: [steamed with skin] / roasted / breast without skin
- Chicken rice — 250 g
  S plate: [regular] / large
- Chili and ginger sauces — 20 g
```

#### 301. Fried rice · Chinese · restaurant

```text
- Egg fried rice — 350 g
  P kind: [egg] / Yangzhou / shrimp
  C portion: 250 g / [350 g] / 450 g
```

#### 302. Chow mein, shared · Cantonese · restaurant

```text
- Chow mein — 200 g
  C my share: 120 g / [200 g] / 300 g
```

#### 303. Lanzhou beef noodles · Northwestern · restaurant

```text
- Noodles — 250 g
  S bowl: [regular] / large
- Beef slices — 50 g
  C extra beef: [none] / +50 g
- Broth — 400 ml
  C drank: some / [half] / all
- Chili oil — 1 spoon
  C spoons: none / [1] / 2
```

#### 304. Jiaozi · Northern Chinese · restaurant

```text
- Pork and cabbage jiaozi — 12
  P kind: [boiled] / pan-fried
  C count: 8 / [12] / 15
- Chili oil — 10 g
  C chili oil: none / [10 g] / 20 g
```

#### 305. Baozi · Chinese · street

```text
- Pork baozi — 2
  U kind: [pork, 100 g] / vegetable, 90 g / red bean, 80 g / big pork, 150 g
  C count: 1 / [2] / 3
```

#### 306. Mooncake, a quarter · Chinese · festival

```text
- Mooncake — ¼
  P filling: [lotus seed with yolk] / red bean / mixed nuts
  C eaten: [¼] / ½ / whole
```

#### 307. Sweet and sour pork, shared · Cantonese · restaurant

```text
- Sweet and sour pork — 150 g
  C my share: 100 g / [150 g] / 250 g
```

#### 308. Egg tarts · Hong Kong · bakery

```text
- Egg tart — 2
  P crust: [shortcrust] / puff
  C count: 1 / [2]
```

#### 309. Bubble tea · Taiwanese · shop

```text
- Milk tea — 1
  P sugar: 0 % / 30 % / [50 %] / 70 % / 100 %
  S size: medium 500 ml / [large 700 ml]
- Tapioca pearls — 1 portion
  C pearls: none / [1 portion] / extra
- Cheese foam — 0
  C foam: [none] / 1
```

#### 310. Roast duck rice · Cantonese · roast shop

```text
- Roast duck, off the bone — 150 g
- Rice — 250 g
```

#### 311. Dry pot, shared · Hunan · restaurant

```text
- Dry pot — 200 g
  P oil: [usual] / oily
  C my share: 150 g / [200 g] / 300 g
- Rice — 1 bowl
```

#### 312. Malatang by weight · Chinese · fast food

```text
- Malatang ingredients, weighed — 400 g
- Broth — 300 ml
  C drank: none / [some] / all
```

#### 313. Rice refills · Chinese · restaurant

```text
- Rice — 1 bowl
  C bowls: [1] / 2 / 3
```

#### 314. Spring rolls · Chinese · takeaway

```text
- Spring rolls — 3
  C count: 2 / [3] / 4
- Sweet chili sauce — 20 g
```

#### 315. Zongzi · Chinese · festival

```text
- Zongzi, without leaves — 1
  U kind: [pork and egg yolk, 200 g] / red bean, 150 g / plain with sugar, 120 g
```

#### 316. Tangyuan in sweet soup · Chinese · home

```text
- Tangyuan — 5
  P filling: [black sesame] / peanut / red bean
  C count: 4 / [5] / 8
- Sweet ginger soup — 200 ml
  C drank: none / [half] / all
```

#### 317. Bolo bao with butter · Hong Kong · cha chaan teng

```text
- Bolo bao with butter ×1
  - Pineapple bun — 1
  - Butter slab — 15 g
    C butter: none / [15 g] / 25 g
- Milk tea — 250 ml
  P sugar: [usual] / less / none
```

#### 318. Soy milk and youtiao · Chinese · street

```text
- Soy milk — 300 ml
  P sugar: unsweetened / [sweet]
- Youtiao — 1
  C count: [1] / 2
```

#### 319. Wonton noodle soup · Cantonese · restaurant

```text
- Wontons — 6
- Egg noodles — 150 g
- Broth — 300 ml
  C drank: [half] / all
```

#### 320. Banquet on a lazy Susan · Chinese · banquet

```text
- Cold platter — 60 g
  C my share: 30 g / [60 g] / 100 g
- Steamed fish — 80 g
  C my share: 40 g / [80 g] / 120 g
- Braised pork belly — 2 pieces
  C pieces: 1 / [2] / 4
- Stir-fried greens — 100 g
- Prawns, peeled — 60 g
  C prawns: 2 / [4] / 6
- Fried rice — 100 g
  C rice: none / [100 g] / 200 g
- Soup — 1 bowl
- Sweet soup — 1 bowl
  C bowls: none / [1]
```

#### 321. Taiwanese beef noodle soup · Taiwanese · restaurant

```text
- Beef noodle soup ×1
  S bowl: small / [regular] / large
  - Noodles — 200 g
  - Beef — 100 g
  - Broth — 400 ml
    P broth: [braised red] / clear
    C drank: half / [all]
! dish-size+part-question: a bowl size and "broth drank" together need the soup split into a dish, which is fine
```

#### 322. Lu rou fan · Taiwanese · eatery

```text
- Lu rou fan — 1 bowl
  S bowl: [small] / large
- Braised egg — 1
  C egg: none / [1]
```

#### 323. Gua bao · Taiwanese · street

```text
- Gua bao — 2
  C count: 1 / [2]
```

#### 324. Scallion pancake · Chinese · street

```text
- Scallion pancake — 1
  P oil: [usual] / oily
  C eaten: ½ / [whole]
```

#### 325. Fried chicken cutlet · Taiwanese · night market

```text
- Fried chicken cutlet — 1
  S size: [regular] / XL
```

### Japanese

#### 326. Sushi set · Japanese · restaurant

```text
- Nigiri, assorted — 10
  C count: 8 / [10] / 12
- Maki pieces — 6
  P maki: [cucumber/tuna] / California / Philadelphia
- Miso soup — 1 bowl
```

#### 327. Tonkotsu ramen · Japanese · ramen shop

```text
- Tonkotsu ramen ×1
  - Noodles — 150 g
  - Chashu — 2 slices
    P chashu: [pork] / chicken
    C slices: [2] / 4
  - Ajitama egg — 1
    C egg: none / [1]
  - Broth — 400 ml
    C drank: a little / [half] / all
- Extra noodles (kaedama) — 0
  C kaedama: [none] / 1
! dish-size: "large ramen" scales noodles and broth but not the egg; with a dish size question, the egg would scale too
```

#### 328. Tonkatsu teishoku · Japanese · restaurant

```text
- Tonkatsu — 1
  P cut: [rosu (loin)] / hire (fillet)
  S size: [regular 150 g] / large 200 g
- Rice — 1 bowl
  C bowls: [1] / 2
- Cabbage — 100 g
- Tonkatsu sauce — 20 g
- Miso soup — 1
```

#### 329. Gyudon · Japanese · fast food

```text
- Gyudon ×1
  S size: mini / [nami] / ōmori / tokumori
  - Rice — 250 g
  - Beef and onion — 85 g
- Raw egg — 0
  C egg: [none] / 1
! dish-size: tokumori adds mostly beef, not rice; a single factor for the dish is approximate
```

#### 330. Curry rice with katsu · Japanese · fast food

```text
- Curry rice — 1
  S size: [regular] / large
- Katsu topping — 1
  C katsu: none / [1]
- Fukujinzuke — 10 g
```

#### 331. Onigiri · Japanese · konbini

```text
- Onigiri with tuna mayo (label) — 1
- Onigiri with salmon (label) — 1
```

#### 332. Okonomiyaki, shared · Osaka · restaurant

```text
- Okonomiyaki — ½
  P kind: [pork] / seafood / modern (with noodles)
  C my share: ⅓ / [½] / whole
- Mayo and sauce — 30 g
  C sauce: [usual] / extra
```

#### 333. Takoyaki · Osaka · street

```text
- Takoyaki — 6
  C count: [6] / 8 / 12
- Mayo — 15 g
```

#### 334. Kitsune udon with tempura · Japanese · restaurant

```text
- Udon — 250 g
- Fried tofu — 1 piece
- Broth — 350 ml
  C drank: half / [all]
- Shrimp tempura — 2
  C count: none / 1 / [2]
```

#### 335. Tempura assortment · Japanese · restaurant

```text
- Tempura, assorted — 8 pieces
  C pieces: 6 / [8] / 10
```

#### 336. Yakitori · Japanese · izakaya

```text
- Yakitori, assorted — 5 skewers
  P seasoning: [tare] / salt
  C skewers: 3 / [5] / 8
```

#### 337. Izakaya shared plates · Japanese · izakaya

```text
- Karaage — 3
  C my pieces: 2 / [3] / 5
- Edamame — 50 g
- Gyoza — 3
  C my pieces: 2 / [3] / 5
- Potato salad — 50 g
- Beer — 2
  S glass: [medium 500 ml] / large 800 ml
  C glasses: 1 / [2] / 3
```

#### 338. Konbini bento · Japanese · konbini

```text
- Karaage bento (label) — 1
```

#### 339. Sashimi platter, shared · Japanese · restaurant

```text
- Sashimi, assorted — 8 slices
  C my slices: 5 / [8] / 12
```

#### 340. Grilled salmon set, skin left · Japanese · restaurant

```text
- Grilled salmon, without skin — 100 g
- Rice — 1 bowl
- Miso soup — 1
- Pickles — 20 g
```

#### 341. Matcha latte · Japanese · café

```text
- Matcha latte — 1
  P milk: [cow] / oat / soy
  S size: S / [M] / L
- Syrup — 0
  C pumps: [none] / 1 / 2
! add-on-row: an add-on (syrup, sugar, extra shot) is its own row; its count is per drink only while there's one drink
```

#### 342. Mochi and dorayaki · Japanese · wagashi shop

```text
- Daifuku mochi — 2
  C count: 1 / [2]
- Dorayaki — 1
```

#### 343. Zaru soba · Japanese · restaurant

```text
- Soba — 200 g
  S size: [regular] / large
- Tsuyu — 50 ml
```

#### 344. Karaage · Japanese · izakaya

```text
- Karaage — 5
  S piece: small 25 g / [usual 35 g] / large 50 g
  C count: 4 / [5] / 8
- Mayo — 15 g
  C mayo: none / [15 g]
```

#### 345. Katsu sando · Japanese · konbini

```text
- Katsu sando (label) — 1
```

#### 346. Chirashi · Japanese · restaurant

```text
- Chirashi — 1 bowl
  S bowl: [regular] / large
```

#### 347. Shabu-shabu · Japanese · restaurant

```text
- Beef slices — 150 g
  C my meat: 100 g / [150 g] / 250 g
- Vegetables and tofu — 200 g
- Sesame sauce — 40 g
  C sauce: 20 g / [40 g] / 60 g
- Ponzu — 30 g
- Udon at the end — 0
  C udon: [none] / 1 portion
```

#### 348. Melon pan · Japanese · bakery

```text
- Melon pan — 1
```

#### 349. Nabe, shared · Japanese · home

```text
- Nabe — 400 g
  C my share: 300 g / [400 g] / 550 g
```

#### 350. Sake and highballs · Japanese · bar

```text
- Sake — 2 gō
  S serving: [1 gō 180 ml] / glass 120 ml
  C servings: 1 / [2] / 3
- Highball — 1
  C highballs: none / [1] / 2
```

### Korean

#### 351. Samgyeopsal · Korean · BBQ

```text
- Pork belly — 200 g
  C my share: 100 g / [200 g] / 300 g
- Ssamjang — 10 g
  C sauce: none / [10 g] / 20 g
- Rice — 1 bowl
  C rice: none / [1]
- Banchan — 100 g
- Lettuce and garlic — 60 g
```

#### 352. Bibimbap · Korean · restaurant

```text
- Bibimbap ×1
  - Rice — 250 g
    P rice: [regular bowl] / dolsot (crispy, oiled)
  - Vegetables and egg — 200 g
  - Beef — 50 g
  - Gochujang — 20 g
    C gochujang: 10 g / [20 g] / 30 g
  - Sesame oil — 5 ml
    C oil: [5 ml] / 10 ml
```

#### 353. Kimchi jjigae · Korean · restaurant

```text
- Kimchi jjigae — 400 ml
  C eaten: [half] / all
- Rice — 1 bowl
```

#### 354. Tteokbokki, shared · Korean · street

```text
- Tteokbokki — 200 g
  C my share: 150 g / [200 g] / 300 g
```

#### 355. Korean fried chicken · Korean · chicken pub

```text
- Fried chicken, off the bone — 6 pieces
  P coating: plain / [yangnyeom] / soy garlic
  C my pieces: 4 / [6] / 8
- Pickled radish — 50 g
- Beer — 500 ml
```

#### 356. Kimbap · Korean · street

```text
- Kimbap — 1 roll
  P filling: [classic] / tuna mayo / cheese
  C eaten: ½ roll / [1 roll]
```

#### 357. Japchae · Korean · home

```text
- Japchae — 200 g
  P oil: [usual] / oily
```

#### 358. Naengmyeon · Korean · restaurant

```text
- Noodles and toppings — 250 g
- Cold broth — 300 ml
  C drank: [half] / all
```

#### 359. Bulgogi with rice · Korean · restaurant

```text
- Bulgogi — 200 g
- Rice — 1 bowl
```

#### 360. Hotteok · Korean · street

```text
- Hotteok — 1
  P filling: [brown sugar and nuts] / cheese / vegetable
```

#### 361. Banchan only · Korean · home

```text
- Banchan, assorted — 150 g
```

#### 362. Jajangmyeon · Korean-Chinese · delivery

```text
- Jajangmyeon — 1
  S size: [regular] / gopbaegi (large)
```

#### 363. Soju, shared · Korean · restaurant

```text
- Soju — 4 shots
  S shot: [50 ml] / 70 ml
  C my shots: 2 / [4] / 7
```

#### 364. Budae jjigae, shared · Korean · restaurant

```text
- Budae jjigae — 350 g
  C my share: 250 g / [350 g] / 450 g
- Ramyeon noodles added — 1 portion
  C noodles: none / [½] / 1
```

#### 365. Triangle kimbap · Korean · convenience store

```text
- Triangle kimbap (label) — 1
```

#### 366. Bunsik combo · Korean · bunsik

```text
- Gimbap — ½ roll
- Ramyeon ×1
  - Noodles — 1 portion
  - Broth — 400 ml
    C drank: [half] / all
```

#### 367. Samgyetang · Korean · restaurant

```text
- Small chicken with rice inside, edible — 350 g
- Broth — 400 ml
  C drank: [half] / all
```

#### 368. Bingsu, shared · Korean · café

```text
- Bingsu — ½
  P kind: [injeolmi] / mango / patbingsu
  C my share: ⅓ / [½] / all
```

#### 369. Dakgalbi with fried rice · Korean · restaurant

```text
- Dakgalbi — 250 g
  C my share: 150 g / [250 g] / 350 g
- Fried rice at the end — 150 g
  C rice: none / [150 g] / 250 g
```

#### 370. Mandu · Korean · restaurant

```text
- Mandu — 6
  P kind: [steamed] / fried
  C count: 4 / [6] / 8
```

### Southeast Asian

#### 371. Pho bo · Vietnamese · restaurant

```text
- Pho ×1
  S bowl: small / [regular] / large
  - Rice noodles — 200 g
  - Beef — 80 g
    P beef: [rare slices] / brisket / meatballs / mixed
  - Broth — 450 ml
    C drank: a little / [half] / all
- Hoisin and sriracha — 15 g
  C sauces: none / [1 tbsp] / 2 tbsp
! linked-kinds: pho bo vs pho ga changes the meat and the broth together; not expressible as one question
```

#### 372. Banh mi · Vietnamese · street

```text
- Banh mi ×1
  - Baguette — 1
  - Fillings — 80 g
    P filling: [pork, pâté, cold cuts] / grilled pork / chicken / egg
  - Mayo and butter — 15 g
    C spread: [usual] / generous
  - Pickles and herbs — 40 g
```

#### 373. Bun cha · Hanoi · restaurant

```text
- Rice noodles — 200 g
- Grilled pork patties and belly — 150 g
  C pork: 100 g / [150 g] / 200 g
- Nuoc cham — 100 ml
  C drank: [a little] / half / all
- Herbs — 50 g
```

#### 374. Fresh spring rolls · Vietnamese · restaurant

```text
- Fresh spring rolls — 2
  C count: [2] / 3 / 4
- Peanut sauce — 30 g
  C sauce: 15 g / [30 g] / 50 g
```

#### 375. Cha gio · Vietnamese · restaurant

```text
- Fried spring rolls — 4
  C count: 2 / [4] / 6
```

#### 376. Com tam · Saigon · street

```text
- Broken rice — 250 g
- Pork chop, off the bone — 120 g
- Fried egg — 1
  C egg: none / [1]
- Pickles and fish sauce — 40 g
```

#### 377. Ca phe sua da · Vietnamese · café

```text
- Iced coffee with condensed milk — 1 glass
  P condensed milk: little / [usual] / a lot
```

#### 378. Pad thai · Thai · street

```text
- Pad thai — 350 g
  P protein: [shrimp] / chicken / tofu
  C plate: 250 g / [350 g] / 450 g
- Sugar from the condiment caddy — 0
  C sugar: [none] / 1 tsp / 2 tsp
- Crushed peanuts — 10 g
  C peanuts: none / [1 tbsp] / 2 tbsp
```

#### 379. Green curry with rice · Thai · restaurant

```text
- Green curry with chicken — 300 g
  P coconut: light / [usual] / rich
- Rice — 1 plate
  C rice: [1] / 2
```

#### 380. Som tam with sticky rice and chicken · Isan · street

```text
- Som tam — 200 g
- Sticky rice — 1 basket
  S basket: [small 100 g] / large 200 g
- Grilled chicken, off the bone — 150 g
  C pieces: [1] / 2
```

#### 381. Mango sticky rice · Thai · street

```text
- Sticky rice — 120 g
- Coconut cream — 40 g
  C cream: 20 g / [40 g] / 60 g
- Mango — ½
  C mango: ½ / [1]
```

#### 382. Khao man gai · Thai · street

```text
- Chicken, off the bone — 120 g
- Chicken-fat rice — 250 g
- Soy-ginger sauce — 30 g
```

#### 383. Tom yum · Thai · restaurant

```text
- Tom yum with shrimp — 400 ml
  P style: clear / [creamy]
  C eaten: half / [all]
```

#### 384. Moo ping · Thai · street

```text
- Moo ping skewers — 3
  C count: 2 / [3] / 5
- Sticky rice — 100 g
```

#### 385. Thai iced tea · Thai · street

```text
- Thai iced tea, without ice — 300 ml
  S cup: [regular] / large
  P sweetness: less / [usual]
```

#### 386. Nasi goreng · Indonesian · warung

```text
- Nasi goreng — 350 g
- Fried egg — 1
- Krupuk — 10 g
```

#### 387. Nasi campur · Indonesian · warung

```text
- Rice — 200 g
- Dishes picked, assorted — 250 g
  C dishes: 150 g / [250 g] / 350 g
- Sambal — 15 g
```

#### 388. Satay · Indonesian · street

```text
- Chicken satay — 10 skewers
  P meat: [chicken] / beef / goat
  C skewers: 5 / [10] / 15
- Peanut sauce — 60 g
  C sauce: 30 g / [60 g] / 90 g
- Lontong — 100 g
```

#### 389. Rendang · Padang · restaurant

```text
- Rendang — 150 g
  C pieces: [1] / 2
- Rice — 250 g
```

#### 390. Gado-gado · Indonesian · warung

```text
- Vegetables, tofu, egg, potato — 300 g
- Peanut sauce — 80 g
  C sauce: 50 g / [80 g] / 120 g
- Krupuk — 10 g
```

#### 391. Nasi lemak · Malaysian · hawker

```text
- Coconut rice — 200 g
- Sambal — 30 g
  C sambal: 15 g / [30 g] / 50 g
- Ikan bilis and peanuts — 25 g
- Boiled egg — ½
- Fried chicken — 0
  C chicken: none / [1 piece]
```

#### 392. Roti canai · Malaysian · mamak

```text
- Roti canai — 2
  C count: 1 / [2] / 3
- Dhal dip — 100 g
  C dipped: some / [half] / all
```

#### 393. Char kway teow · Penang · hawker

```text
- Char kway teow — 350 g
  P lard and oil: [usual] / extra
  S plate: [regular] / large
```

#### 394. Curry laksa · Malaysian · hawker

```text
- Curry laksa ×1
  S bowl: [regular] / large
  - Noodles, tofu puffs, chicken, prawns — 250 g
  - Coconut curry broth — 400 ml
    C drank: a little / [half] / all
```

#### 395. Kaya toast set · Singaporean · kopitiam

```text
- Kaya toast ×2
  C pieces: [2] / 3 / 4
  - Toast — 1
  - Kaya — 15 g
  - Butter slab — 8 g
- Soft-boiled eggs — 2
- Kopi — 1 cup
  P kopi: kopi (condensed milk) / [kopi C (evaporated, sugar)] / kopi O kosong (black)
```

#### 396. Chicken adobo · Filipino · home

```text
- Chicken adobo, off the bone — 200 g
- Rice — 1 cup
  C cups: [1] / 2 / 3
```

#### 397. Lechon · Filipino · fiesta

```text
- Lechon, meat — 150 g
  C my share: 100 g / [150 g] / 250 g
- Crispy skin — 30 g
  C skin: none / [30 g] / 60 g
- Rice — 1 cup
```

#### 398. Sinigang · Filipino · home

```text
- Sinigang, solids — 200 g
- Broth — 300 ml
  C drank: [half] / all
- Rice — 1 cup
```

#### 399. Halo-halo · Filipino · café

```text
- Halo-halo — 1
  S size: [regular] / large
```

#### 400. Tea leaf salad · Burmese · restaurant

```text
- Tea leaf salad — 200 g
  P oil: [usual] / oily
  C my share: 100 g / [200 g]
```

#### 401. Pho ga at a stall · Vietnamese · street

```text
- Pho ga ×1
  - Noodles — 200 g
  - Chicken — 80 g
  - Broth — 450 ml
    C drank: half / [all]
```

#### 402. Boat noodles · Thai · restaurant

```text
- Boat noodles bowls — 4
  C bowls: 3 / [4] / 6 / 8
```

#### 403. Amok · Cambodian · restaurant

```text
- Fish amok — 250 g
- Rice — 200 g
```

#### 404. Larb with sticky rice · Lao · restaurant

```text
- Larb — 200 g
  P meat: [pork] / chicken / duck
- Sticky rice — 150 g
```

#### 405. Pancit and lumpia · Filipino · party

```text
- Pancit — 200 g
  C my share: 100 g / [200 g]
- Lumpia — 3
  C count: 2 / [3] / 5
```

### USA, Canada

#### 406. Burger combo · American · fast food

```text
- Cheeseburger — 1
  U kind: [single, 120 g] / double, 180 g
- Fries — 1
  S size: small / [medium] / large
- Soda — 1
  P soda: [regular] / diet
  S cup: small / [medium] / large
  C refills: [none] / 1 / 2
! linked-sizes: a combo's size applies to fries and drink together; two separate questions here
```

#### 407. Burger, protein style · American · restaurant

```text
- Burger ×1
  - Bun — 0
    C bun: [none] / 1
  - Beef patty — 1
  - Cheese — 1 slice
  - Sauce — 20 g
```

#### 408. BBQ ribs · American · BBQ

```text
- Pork ribs, meat — 1 half rack
  S portion: [half rack] / full rack
  C eaten: [all] / most
- Coleslaw — 100 g
- Cornbread — 1
```

#### 409. Brisket by the pound · Texas · BBQ

```text
- Brisket — ½ lb (label)
  P cut: [lean] / moist (fatty)
- White bread — 2 slices
  C slices: none / 1 / [2]
- Pickles and onion — 30 g
```

#### 410. Buffalo wings · American · sports bar

```text
- Wings, meat — 10
  P sauce: [buffalo] / honey BBQ / dry rub
  C my wings: 6 / [10] / 12
- Blue cheese dip — 30 g
  C dip: none / [30 g] / 60 g
- Celery — 30 g
```

#### 411. Pancakes · American · diner

```text
- Pancakes — 3
  S size: [regular] / large
  C count: 2 / [3] / 4
- Butter — 15 g
- Maple syrup — 60 ml
  C syrup: 30 ml / [60 ml] / 90 ml
```

#### 412. Waffles with cream and berries · American · diner

```text
- Waffles — 2
- Whipped cream — 30 g
  C cream: none / [30 g] / 60 g
- Berries — 50 g
```

#### 413. Bagel with cream cheese · New York · deli

```text
- Bagel — 1
  P kind: [plain] / everything / sesame
- Cream cheese — 40 g
  C schmear: thin 20 g / [regular 40 g] / thick 70 g
```

#### 414. Mac and cheese · American · restaurant

```text
- Mac and cheese — 300 g
  P cheese: [usual] / extra
  C portion: 200 g / [300 g] / 400 g
```

#### 415. Caesar with dressing on the side · American · café

```text
- Caesar without dressing — 300 g
- Dressing — ½ cup
  C used: none / [half] / all
```

#### 416. Burrito or bowl · Tex-Mex · fast casual

```text
- Burrito ×1
  - Flour tortilla — 1
    C tortilla: none (bowl) / [1]
  - Rice — 150 g
  - Beans — 100 g
  - Meat — 120 g
    P meat: [chicken] / steak / carnitas / barbacoa
  - Cheese — 30 g
    C cheese: none / [30 g]
  - Guacamole — 0
    C guac: [none] / 1 portion
  - Sour cream — 30 g
    C sour cream: none / [30 g]
```

#### 417. Tacos al pastor · Mexican · taquería

```text
- Taco al pastor ×4
  C tacos: 3 / [4] / 5 / 6
  - Corn tortilla — 2
    C tortillas: 1 / [2]
  - Al pastor — 40 g
  - Pineapple — 10 g
  - Salsa — 15 g
```

#### 418. Chips and salsa, refills · Tex-Mex · restaurant

```text
- Tortilla chips — 50 g
  C chips: 30 g / [50 g] / 100 g
- Salsa — 60 g
```

#### 419. Hot dog with toppings · American · stadium

```text
- Hot dog ×1
  - Bun — 1
  - Sausage — 1
    U kind: [regular, 50 g] / jumbo, 100 g
  - Toppings — 30 g
    P toppings: [mustard and relish] / chili and cheese
```

#### 420. Philly cheesesteak · Philadelphia · street

```text
- Cheesesteak — 1
  S size: [regular 30 cm] / half
  P cheese: [provolone] / Whiz
```

#### 421. NY slices · New York · pizzeria

```text
- Pizza slice — 2
  P kind: [cheese] / pepperoni
  C slices: 1 / [2] / 3
```

#### 422. Deep dish slice · Chicago · pizzeria

```text
- Deep dish pizza — 1 slice
  S slice: [small pie] / large pie
  C slices: [1] / 2
```

#### 423. Fried chicken bucket, shared · American · fast food

```text
- Fried chicken, edible — 3 pieces
  U piece: drumstick 70 g / [thigh 90 g] / breast 150 g / wing 40 g
  C pieces: 2 / [3] / 4
! mixed-pieces: different pieces in one row; one kind for all is an approximation — separate rows per kind if visible
```

#### 424. Mashed potatoes and gravy · American · fast food

```text
- Mashed potatoes with gravy — 1 side
  S side: [regular] / large
```

#### 425. Poutine · Canadian · diner

```text
- Poutine — 1
  S size: small / [regular] / large
```

#### 426. Chicken pot pie · American · home

```text
- Chicken pot pie — 1 piece
  S piece: small / [usual] / large
```

#### 427. Clam chowder in a bread bowl · San Francisco · wharf

```text
- Clam chowder — 350 ml
- Sourdough bowl — 1
  C bowl eaten: none / [half] / all
```

#### 428. Lobster with butter · New England · restaurant

```text
- Lobster meat — 200 g
  S lobster: [1¼ lb] / 2 lb
- Melted butter — 30 g
  C butter used: a little / [half] / all
```

#### 429. Crab legs · American · seafood

```text
- Crab meat — 200 g
  C meat: 150 g / [200 g] / 300 g
- Butter — 20 g
```

#### 430. Cobb salad · American · restaurant

```text
- Cobb salad without dressing — 400 g
  C eaten: [all] / half
- Dressing — 50 g
  P dressing: [ranch] / blue cheese / vinaigrette
  C dressing: 30 g / [50 g] / 80 g
```

#### 431. Açaí bowl · Californian · café

```text
- Açaí base — 1
  S bowl: small / [medium] / large
- Granola — 40 g
  C granola: 20 g / [40 g] / 60 g
- Banana and berries — 80 g
- Honey or peanut butter drizzle — 15 g
  P drizzle: [honey] / peanut butter
  C drizzle: none / [15 g] / 30 g
! presence+kind: "none / honey / PB" as one question would be better
```

#### 432. Protein shake · gym · home

```text
- Protein shake ×1
  - Protein powder — 2 scoops
  - Milk — 300 ml
```

#### 433. Latte · American · coffee chain

```text
- Latte — 1
  P milk: [2 %] / whole / oat / skim
  S size: tall / [grande] / venti
- Syrup — 2 pumps
  C pumps: none / [2] / 4
- Whipped cream — 0
  C whip: [none] / 1
```

#### 434. Donuts · American · shop

```text
- Donut — 2
  U kind: [glazed, 50 g] / filled, 80 g / frosted, 65 g
  C count: 1 / [2] / 3
```

#### 435. Cinnamon roll, ate half · American · mall

```text
- Cinnamon roll — ½
  C eaten: ¼ / [½] / whole
```

#### 436. Thanksgiving plate · American · home

```text
- Turkey — 150 g
  C turkey: 100 g / [150 g] / 200 g
- Stuffing — 150 g
  C stuffing: 100 g / [150 g] / 200 g
- Mashed potatoes — 150 g
- Gravy — 80 ml
- Green bean casserole — 100 g
- Cranberry sauce — 40 g
- Dinner roll — 1
  C rolls: none / [1] / 2
- Pumpkin pie — 1 slice
  C slices: none / [1] / 2
```

#### 437. Pumpkin pie with whipped cream · American · home

```text
- Pumpkin pie — 1 slice
- Whipped cream — 30 g
```

#### 438. Corn on the cob · American · BBQ

```text
- Corn, kernels — 1 cob
  S cob: small / [medium] / large
- Butter — 10 g
  C butter: none / [10 g] / 20 g
```

#### 439. Movie popcorn, shared · American · cinema

```text
- Popcorn — 1 bucket
  S bucket: small / [medium] / large
  C my share: ⅓ / [½] / all
- Butter topping — 1 pump
  C topping: none / [1 pump] / 2 pumps
```

#### 440. Nachos, shared · Tex-Mex · bar

```text
- Loaded nachos — ⅓
  C my share: ¼ / [⅓] / ½
```

#### 441. Breakfast burrito · American · café

```text
- Breakfast burrito — 1
  P filling: [bacon, egg, potato] / chorizo, egg / veggie
```

#### 442. Biscuits and gravy · Southern · diner

```text
- Biscuits — 2
- Sausage gravy — 150 g
  C gravy: 100 g / [150 g] / 200 g
- Grits — 150 g
- Butter on grits — 10 g
```

#### 443. Meal-prep boxes · gym · home

```text
- Chicken breast (weighed) — 180 g
- Rice (weighed) — 200 g
- Broccoli — 100 g
```

#### 444. Hawaiian plate lunch · Hawaiian · plate-lunch spot

```text
- Rice — 2 scoops
  C scoops: 1 / [2]
- Mac salad — 1 scoop
- Kalua pork — 150 g
  P protein: [kalua pork] / chicken katsu / loco moco patty
```

#### 445. Poke by the pound · Hawaiian · shop

```text
- Ahi poke — ½ lb (label)
- Rice — 1 scoop
```

#### 446. Spam musubi · Hawaiian · convenience store

```text
- Spam musubi — 1
```

#### 447. Two cans of beer · American · home

```text
- Beer — 2 cans
  P beer: [regular] / light / IPA
  C cans: 1 / [2] / 3
```

#### 448. Bagel sandwich · New York · deli

```text
- Bagel with egg, bacon and cheese — 1
```

#### 449. Chicken tenders · American · fast food

```text
- Chicken tenders — 4
  C count: 3 / [4] / 6
- Honey mustard — 30 g
  P dip: [honey mustard] / ranch / BBQ
```

#### 450. Milkshake · American · diner

```text
- Milkshake — 1
  P flavor: [vanilla] / chocolate / strawberry
  S size: small / [regular] / large
- Whipped cream — 1 portion
  C cream: none / [1 portion]
```

### Latin America

#### 451. Street tacos, assorted · Mexican · street

```text
- Taco ×3
  C tacos: 2 / [3]
  - Corn tortilla — 2
    C tortillas: 1 / [2]
  - Filling — 40 g
    P filling: [al pastor] / asada / suadero
- Taco with carnitas ×2
  - Corn tortilla — 2
    C tortillas: 1 / [2]
  - Carnitas — 40 g
- Salsas — 30 g
```

#### 452. Torta ahogada · Guadalajara · street

```text
- Torta ahogada — 1
  P drowned: half / [fully]
```

#### 453. Chilaquiles · Mexican · café

```text
- Chilaquiles — 250 g
  P salsa: [verde] / roja
- Fried egg — 1
  C eggs: none / [1] / 2
- Crema and cheese — 30 g
```

#### 454. Enchiladas · Mexican · restaurant

```text
- Enchiladas — 3
  P sauce: [verde] / roja / mole
  C count: 2 / [3]
- Rice — 100 g
- Refried beans — 100 g
```

#### 455. Pozole with tostadas · Mexican · restaurant

```text
- Pozole — 450 ml
  P kind: [rojo, pork] / blanco, chicken
  S bowl: [medium] / large
- Tostadas with crema — 2
  C tostadas: none / 1 / [2]
```

#### 456. Elote · Mexican · street

```text
- Elote, kernels — 1
- Mayo and cheese — 30 g
  C topping: [usual] / extra
```

#### 457. Tamales · Mexican · street

```text
- Tamal — 2
  U kind: [pork in red salsa, 150 g] / chicken in green, 150 g / rajas, 140 g / Oaxacan in leaf, 250 g
  C count: 1 / [2]
```

#### 458. Quesadilla · Mexico City · street

```text
- Quesadilla — 2
  P cheese: [with cheese] / without cheese
  C count: 1 / [2] / 3
! presence-as-kind: "with or without cheese" in Mexico City is a kind (the default differs), so P works
```

#### 459. Horchata · Mexican · street

```text
- Horchata — 500 ml
  S cup: [medium 500 ml] / large 1 l
```

#### 460. Mole with chicken · Mexican · home

```text
- Chicken in mole, off the bone — 200 g
- Rice — 100 g
- Tortillas from the basket — 3
  C tortillas: 2 / [3] / 5
```

#### 461. Pupusas · Salvadoran · pupusería

```text
- Pupusa — 3
  P filling: [revuelta] / queso / frijol con queso
  C count: 2 / [3] / 4
- Curtido — 60 g
```

#### 462. Bandeja paisa · Colombian · restaurant

```text
- Red beans — 200 g
- Rice — 150 g
- Ground beef — 80 g
- Chicharrón — 80 g
  C chicharrón: 50 g / [80 g] / 120 g
- Fried egg — 1
- Chorizo — 1
- Arepa — 1
- Avocado — ¼
- Fried plantain — 80 g
```

#### 463. Arepa reina pepiada · Venezuelan · arepera

```text
- Arepa reina pepiada — 1
```

#### 464. Cachapa with cheese · Venezuelan · street

```text
- Cachapa — 1
- Queso de mano — 80 g
  C cheese: 50 g / [80 g] / 120 g
```

#### 465. Ceviche · Peruvian · cevichería

```text
- Ceviche — 200 g
- Sweet potato and corn — 120 g
- Leche de tigre — 0
  C drank: [none] / a glass
```

#### 466. Lomo saltado · Peruvian · restaurant

```text
- Lomo saltado (beef, onion, fries) — 350 g
- Rice — 150 g
```

#### 467. Ají de gallina · Peruvian · restaurant

```text
- Ají de gallina — 250 g
- Rice — 150 g
- Potato — 100 g
```

#### 468. Pollo a la brasa · Peruvian · pollería

```text
- Chicken, edible — ¼
  S portion: [¼] / ½
- Fries — 200 g
- Sauces — 40 g
  C sauces: 20 g / [40 g] / 60 g
! size-as-fraction: "¼ / ½ chicken" are sizes of the unit "chicken"; labels are fractions
```

#### 469. Rodízio · Brazilian · churrascaria

```text
- Picanha — 4 slices
  C slices: 2 / [4] / 6
- Sausage — 2 pieces
- Chicken hearts — 5
  C count: none / [5] / 10
- Lamb — 2 slices
- Buffet sides — 250 g
  C sides: 150 g / [250 g] / 350 g
- Grilled pineapple — 2 slices
```

#### 470. Per-kilo buffet, 520 g · Brazilian · por quilo

```text
- Plate, weighed (rice, beans, meat, salad) — 520 g
! total-weight: one weighed plate; the model splits it, and the parts must still sum to 520 g
```

#### 471. Feijoada · Brazilian · restaurant

```text
- Feijoada — 350 g
  C portion: 250 g / [350 g] / 450 g
- Rice — 150 g
- Farofa — 30 g
- Couve — 50 g
- Orange — ½
```

#### 472. Pão de queijo · Brazilian · café

```text
- Pão de queijo — 5
  S size: [small 20 g] / large 50 g
  C count: 3 / [5] / 8
```

#### 473. Coxinha · Brazilian · snack bar

```text
- Coxinha — 2
  C count: 1 / [2]
```

#### 474. Açaí with condensed milk · Brazilian · beach

```text
- Açaí — 500 ml
  S cup: 300 ml / [500 ml] / 700 ml
- Granola — 40 g
- Condensed milk — 30 g
  C drizzle: none / [30 g] / 60 g
- Banana — ½
```

#### 475. Brigadeiros · Brazilian · party

```text
- Brigadeiro — 3
  C count: 2 / [3] / 5
```

#### 476. Asado, shared · Argentine · home

```text
- Beef cuts — 250 g
  C my meat: 150 g / [250 g] / 400 g
- Chorizo — 1
- Morcilla — 0
  C morcilla: [none] / ½ / 1
- Chimichurri — 20 g
- Bread — 1 piece
```

#### 477. Empanadas · Argentine · restaurant

```text
- Empanada de carne — 1
  P cooking: [baked] / fried
- Empanada de jamón y queso — 1
- Empanada de humita — 1
```

#### 478. Milanesa napolitana · Argentine · restaurant

```text
- Milanesa napolitana — 1
  S size: [regular] / XL to share
- Fries — 200 g
```

#### 479. Medialunas and café con leche · Argentine · café

```text
- Medialunas — 2
  P kind: [de manteca] / de grasa
  C count: 1 / [2] / 3
- Café con leche — 250 ml
```

#### 480. Completo · Chilean · street

```text
- Completo — 1
  P kind: [italiano (avocado, tomato, mayo)] / dinámico
```

### Africa

#### 481. Injera platter, shared · Ethiopian · restaurant

```text
- Injera — 1 roll
  C rolls: ½ / [1] / 1½
- Wots, assorted — 200 g
  C my share: 150 g / [200 g] / 300 g
- Kitfo — 0
  C kitfo: [none] / some
```

#### 482. Jollof with plantain and chicken · Nigerian · restaurant

```text
- Jollof rice — 250 g
- Fried plantain — 80 g
  C plantain: 40 g / [80 g] / 120 g
- Chicken, off the bone — 120 g
```

#### 483. Fufu with egusi · Nigerian · restaurant

```text
- Fufu — 1 ball
  S ball: small / [medium] / large
- Egusi soup — 250 g
  P palm oil: [usual] / oily
```

#### 484. Suya · Nigerian · street

```text
- Suya — 150 g
  C suya: 100 g / [150 g] / 250 g
```

#### 485. Ugali, sukuma and nyama choma · Kenyan · restaurant

```text
- Ugali — 250 g
- Sukuma wiki — 100 g
- Nyama choma, meat — 200 g
  P meat: [goat] / beef
```

#### 486. Bunny chow · Durban · takeaway

```text
- Bunny chow ×1
  S loaf: [quarter] / half
  - Bread — ¼ loaf
  - Curry — 250 g
    P curry: [mutton] / chicken / bean
```

#### 487. Braai, shared · South African · home

```text
- Boerewors — 150 g
  C wors: 100 g / [150 g] / 200 g
- Lamb chops, meat — 2
  C chops: 1 / [2] / 3
- Pap — 150 g
- Chakalaka — 80 g
```

#### 488. Iftar spread · Moroccan · home

```text
- Dates — 3
- Harira — 300 ml
  C bowls: [1] / 2
- Chebakia — 2
  C pieces: 1 / [2] / 4
- Boiled egg — 1
- Milk — 200 ml
```

#### 489. Thieboudienne from a shared bowl · Senegalese · home

```text
- Rice — 250 g
  C my rice: 150 g / [250 g] / 350 g
- Fish, off the bone — 100 g
- Vegetables — 100 g
```

#### 490. Peri-peri chicken · Mozambican-Portuguese · restaurant

```text
- Peri-peri chicken, edible — ½
  S portion: ¼ / [½]
- Fries — 150 g
- Peri-peri sauce — 20 g
```

### Home cooking, as eaten

#### 491. Omelette from text · home

```text
- Omelette ×1
  - Eggs — 3
  - Milk — 50 ml
  - Butter — 10 g
```

#### 492. The same omelette, ate half · home

```text
- Omelette ×½
  - Eggs — 3
  - Milk — 50 ml
  - Butter — 10 g
```

#### 493. "100 g dry spaghetti + a third of a jar of sauce" · home

```text
- Spaghetti, dry weight — 100 g
- Tomato sauce — ⅓ jar
```

#### 494. Chicken breast and rice, weighed · home

```text
- Chicken breast — 150 g
- Cooked rice — 200 g
```

#### 495. Avocado toast with egg ×2 · home

```text
- Avocado toast with egg ×2
  - Toast — 1
  - Avocado — ¼
    C avocado: [¼] / ½
  - Egg — 1
    P egg: [poached] / fried
```

#### 496. Fried eggs with bread · home

```text
- Fried eggs — 2
  P fat: little / [usual] / a lot
- Bread — 2 slices
```

#### 497. T-bone steak, 250 g raw · home

```text
- T-bone, raw with bone — 250 g
! as-weighed: a raw weight with the bone is a product named that way; values as weighed
```

#### 498. Fruit · home

```text
- Apple — 1
  S size: small / [medium] / large
- Banana, peeled — 1
  S size: small / [medium] / large
```

#### 499. Nuts from the jar · home

```text
- Mixed nuts — 40 g
  C handful: 20 g / [40 g] / 60 g
```

#### 500. Yogurt with granola and honey · home

```text
- Yogurt (label) — 150 g
- Granola — 30 g
  C granola: 20 g / [30 g] / 50 g
- Honey — 10 g
  C honey: none / [10 g] / 20 g
```

### Full restaurant dinners

#### 501. Italian dinner for two · Italian · trattoria

```text
- Aperol spritz — 1
- Bread basket — 2 pieces
  C pieces: none / 1 / [2] / 3
- Olive oil for bread — 10 ml
  C oil: none / [10 ml] / 20 ml
- Burrata, shared — ½
  C my share: ⅓ / [½] / whole
- Tagliatelle al ragù — 1 portion
  S portion: [primo 250 g] / large 350 g
- Bistecca, shared — 300 g
  C my share: 200 g / [300 g] / 400 g
- Roast potatoes, shared — 150 g
  C my share: 100 g / [150 g] / 250 g
- Red wine — 2 glasses
  S glass: [150 ml] / 200 ml
  C glasses: 1 / [2] / 3
- Tiramisu, shared — ½
  C my share: none / [½] / whole
- Espresso — 1
- Limoncello — 1 shot
  C shots: none / [1] / 2
```

#### 502. French bistro three courses · French · bistro

```text
- Amuse-bouche — 1
- Bread and butter — 2 pieces
  C pieces: 1 / [2] / 3
- Butter — 10 g
  C butter: none / [10 g] / 20 g
- Starter — 1 portion
  P starter: [French onion soup] / escargots / terrine / salade de chèvre chaud
- Main — 1 portion
  P main: [duck confit] / steak frites / sea bass / boeuf bourguignon
- Side frites — 150 g
  C frites: none / [150 g]
- Dessert — 1
  P dessert: [crème brûlée] / mousse au chocolat / tarte tatin / cheese plate
- Wine — 2 glasses
  C glasses: 1 / [2] / 3
- Coffee — 1
! menu-choice-kinds: a starter "of the set menu" whose kind is unknown is a P question with very different dishes (soup in ml vs escargots in pieces); the amount "1 portion" hides the base
```

#### 503. Steakhouse dinner · American · steakhouse

```text
- Bread rolls with butter — 2
  C rolls: none / 1 / [2]
- Wedge salad — 1
  C salad: none / [1]
- Ribeye — 1
  S cut: 10 oz / [14 oz] / 20 oz
- Creamed spinach, shared — 100 g
  C my share: 50 g / [100 g] / 150 g
- Loaded baked potato — 1
  C potato eaten: half / [all]
- Red wine — 2 glasses
- Cheesecake, shared — ½
  C my share: none / [½] / whole
```

#### 504. Georgian supra · Georgian · restaurant

```text
- Khachapuri, shared — 2 slices
  C slices: 1 / [2] / 3 / 4
- Pkhali and badrijani — 80 g
  C my share: 40 g / [80 g] / 120 g
- Khinkali — 5
  C count: 3 / [5] / 8
- Mtsvadi — 150 g
  C my meat: 100 g / [150 g] / 250 g
- Tomato-cucumber salad with walnut — 100 g
- Lavash — 1 piece
- Wine — 4 glasses
  S glass: [150 ml] / 200 ml
  C glasses: 2 / 3 / [4] / 6
- Chacha — 2 shots
  C shots: none / 1 / [2] / 3
- Churchkhela — ½
```

#### 505. Chinese family dinner, eight dishes · Cantonese · restaurant

```text
- Roast duck — 100 g
  C my share: 60 g / [100 g] / 150 g
- Steamed fish — 80 g
- Sweet and sour pork — 80 g
  C my share: 40 g / [80 g] / 120 g
- Stir-fried greens — 100 g
- Mapo tofu — 100 g
- Salt and pepper squid — 60 g
  C my share: 30 g / [60 g] / 100 g
- Fried rice — 150 g
  C rice: 100 g / [150 g] / 250 g
- Hot and sour soup — 1 bowl
- Mango pudding — 1
- Tea — 3 cups
```

#### 506. Japanese kaiseki · Japanese · ryokan

```text
- Sakizuke (appetizer) — 1
- Sashimi — 5 slices
- Clear soup — 1 bowl
- Grilled fish — 1 piece
- Simmered dish — 1 bowl
- Tempura — 4 pieces
- Rice — 1 bowl
  C bowls: [1] / 2
- Miso soup — 1
- Pickles — 1 dish
- Dessert (fruit and warabi mochi) — 1
- Sake — 2 gō
  C gō: 1 / [2] / 3
```

#### 507. Korean BBQ for four · Korean · BBQ

```text
- Pork belly — 150 g
  C my share: 100 g / [150 g] / 250 g
- Marinated beef galbi — 100 g
  C my share: 50 g / [100 g] / 150 g
- Banchan — 150 g
- Lettuce wraps — 6 leaves
- Ssamjang — 15 g
- Steamed egg — 0
  C egg: [none] / some
- Doenjang jjigae — 150 ml
  C stew: none / [150 ml] / 300 ml
- Rice — 1 bowl
  C rice: none / [1]
- Soju — 4 shots
  C shots: 2 / [4] / 7
- Beer — 1 glass
  C glasses: none / [1] / 2
- Naengmyeon at the end — 0
  C noodles: [none] / ½ bowl / 1 bowl
```

#### 508. Indian dinner for three · North Indian · restaurant

```text
- Papadums with chutneys — 2
  C papadums: 1 / [2] / 3
- Onion bhaji — 2
  C count: 1 / [2]
- Chicken tikka masala — 150 g
  C my share: 100 g / [150 g] / 250 g
- Lamb rogan josh — 100 g
  C my share: 50 g / [100 g] / 150 g
- Dal tadka — 100 g
- Pilau rice — 200 g
  C rice: 150 g / [200 g] / 300 g
- Naan — 1
  U kind: [garlic, 110 g] / butter, 110 g / peshwari, 140 g
  C naans: ½ / [1] / 2
- Lassi — 1
  P lassi: [mango] / sweet / salted
- Kulfi — 0
  C kulfi: [none] / 1
```

#### 509. Spanish tapas dinner · Spanish · tapas bar

```text
- Pan con tomate — 2 slices
- Patatas bravas — 100 g
- Croquetas — 3
  C count: 2 / [3] / 4
- Gambas al ajillo — 60 g
- Pimientos de Padrón — 60 g
- Jamón — 30 g
- Tortilla — 1 pincho
- Chorizo al vino — 40 g
  C my share: 20 g / [40 g] / 60 g
- Rioja — 3 glasses
  C glasses: 2 / [3] / 4
- Crema catalana — 0
  C dessert: [none] / ½ / 1
```

#### 510. Mexican dinner · Mexican · restaurant

```text
- Chips and salsa — 60 g
  C chips: 30 g / [60 g] / 100 g
- Guacamole, shared — 60 g
  C my share: 30 g / [60 g] / 100 g
- Enchiladas mole — 2
  C count: [2] / 3
- Rice — 100 g
- Refried beans — 100 g
- Margarita — 2
  S glass: [regular] / jumbo
  C margaritas: 1 / [2] / 3
- Churros — 0
  C churros: [none] / 2 / 4
```

#### 511. Thai dinner, shared · Thai · restaurant

```text
- Satay — 3 skewers
  C skewers: 2 / [3] / 4
- Tom kha gai — 1 bowl
- Green curry — 150 g
  C my share: 100 g / [150 g] / 200 g
- Pad see ew — 150 g
  C my share: 100 g / [150 g] / 200 g
- Jasmine rice — 1 plate
- Thai iced tea — 1
- Mango sticky rice, shared — ½
  C my share: none / [½] / whole
```

#### 512. Lebanese mezze dinner · Lebanese · restaurant

```text
- Hummus — 60 g
- Baba ghanoush — 50 g
- Tabbouleh — 80 g
- Fattoush — 80 g
- Falafel — 2
- Sambousek — 2
  C count: 1 / [2] / 3
- Mixed grill (shish taouk, kafta, lamb) — 150 g
  C my share: 100 g / [150 g] / 250 g
- Garlic sauce — 20 g
- Pita — 2
  C pitas: 1 / [2] / 3
- Arak — 1 glass
  C glasses: none / [1] / 2
- Baklava — 1
```

#### 513. Seafood dinner on the coast · Greek · taverna

```text
- Taramasalata with bread — 40 g
- Greek salad — 150 g
- Fried calamari — 100 g
  C my share: 60 g / [100 g] / 150 g
- Grilled sea bream, edible — 250 g
  S fish: [whole, one person] / large, shared
- Lemon potatoes — 150 g
- Ouzo — 1
- White wine — 3 glasses
  C glasses: 2 / [3] / 4
- Fruit and halva on the house — 1 plate
```

#### 514. Sushi omakase · Japanese · sushi bar

```text
- Nigiri — 14 pieces
  C pieces: 12 / [14] / 16
- Chawanmushi — 1
- Miso soup — 1
- Hand roll — 1
  C hand rolls: none / [1] / 2
- Tamago — 1
- Sake — 2 glasses
- Matcha ice cream — 1 scoop
```

#### 515. Russian restaurant dinner · Russian · restaurant

```text
- Herring with potatoes — 100 g
- Olivier — 100 g
- Vodka — 3 shots
  S shot: [50 ml] / 100 ml
  C shots: 1 / 2 / [3] / 5
- Pickles — 60 g
- Pelmeni — 12
  C count: 8 / [12] / 15
- Sour cream — 30 g
- Pork shashlik — 1 skewer
  C skewers: [1] / 2
- Medovik — 1 slice
  C slices: none / [1]
- Mors — 300 ml
```

#### 516. Brazilian churrascaria · Brazilian · churrascaria

```text
- Salad bar plate — 200 g
  C plate: 100 g / [200 g] / 300 g
- Picanha — 4 slices
  C slices: 2 / [4] / 6 / 8
- Fraldinha — 2 slices
  C slices: none / [2] / 4
- Chicken wrapped in bacon — 2
- Sausage — 2 pieces
- Pão de queijo — 3
- Fried banana and polenta — 60 g
- Caipirinha — 2
  C drinks: 1 / [2] / 3
- Grilled pineapple — 2 slices
```

#### 517. German beer hall dinner · Bavarian · beer hall

```text
- Pretzel — 1
- Obatzda — 50 g
- Schweinsbraten — 250 g
- Knödel — 2
  C count: 1 / [2]
- Sauerkraut — 100 g
- Gravy — 100 ml
- Beer — 2 Maß
  S glass: half liter / [Maß 1 l]
  C glasses: 1 / [2] / 3
```

#### 518. Ethiopian dinner for three · Ethiopian · restaurant

```text
- Injera — 1½ rolls
  C rolls: 1 / [1½] / 2
- Doro wat — 120 g
  C my share: 80 g / [120 g] / 180 g
- Tibs — 100 g
- Misir and shiro — 150 g
- Gomen and atkilt — 100 g
- Tej (honey wine) — 1 glass
  C glasses: none / [1] / 2
```

#### 519. Turkish meyhane night · Turkish · meyhane

```text
- Cold mezes — 150 g
  C my share: 100 g / [150 g] / 250 g
- White cheese and melon — 100 g
- Fried calamari — 80 g
- Grilled fish, edible — 200 g
- Rakı — 3 glasses
  S glass: single 40 ml / [double 80 ml]
  C glasses: 2 / [3] / 4
! diluted-drink: rakı with water: the kcal is the rakı, the glass is mostly water; the size must be of rakı, not the glass
```

#### 520. Vietnamese dinner · Vietnamese · restaurant

```text
- Fresh spring rolls — 2
- Fried spring rolls — 2
- Shaking beef — 150 g
  C my share: 100 g / [150 g] / 200 g
- Morning glory with garlic — 100 g
- Caramelized fish in clay pot — 100 g
- Rice — 1 bowl
  C bowls: [1] / 2
- Beer — 2 cans
```

#### 521. Peruvian Nikkei dinner · Peruvian-Japanese · restaurant

```text
- Tiradito — 80 g
- Causa — 1 piece
- Nikkei rolls — 6 pieces
  C my pieces: 4 / [6] / 8
- Lomo saltado — 200 g
  C my share: 150 g / [200 g]
- Pisco sour — 2
  C drinks: 1 / [2] / 3
- Suspiro limeño — 0
  C dessert: [none] / ½ / 1
```

#### 522. Uzbek feast · Uzbek · restaurant

```text
- Achichuk salad — 100 g
- Non — ½
  C bread: ¼ / [½] / 1
- Samsa — 1
- Plov — 300 g
  C plov: 200 g / [300 g] / 400 g
- Lagman — 0
  C lagman: [none] / ½ bowl / bowl
- Shashlik — 1 skewer
  P meat: [lamb] / beef / chicken / liver
  C skewers: none / [1] / 2
- Green tea — 3 bowls
- Halva and dried fruit — 50 g
  C sweets: 20 g / [50 g] / 80 g
```

#### 523. Moroccan dinner · Moroccan · riad

```text
- Moroccan salads (zaalouk, taktouka, carrots) — 150 g
- Bread — 1 piece
  C pieces: ½ / [1] / 2
- Pastilla — 1 slice
  P filling: [chicken] / seafood
- Lamb tagine with prunes — 250 g
- Couscous — 150 g
  C couscous: none / [150 g] / 250 g
- Mint tea — 2 glasses
- Orange with cinnamon — 1 plate
```

#### 524. Tasting menu, twelve courses · Modern European · fine dining

```text
- Snacks — 4 bites
- Bread with cultured butter — 1 piece
  C bread: none / [1] / 2
- Butter — 10 g
  C butter: 5 g / [10 g] / 20 g
- Courses, small savoury — 7
- Pre-dessert — 1
- Dessert — 1
- Petits fours — 3
  C petits fours: none / 1 / [3]
- Wine pairing — 6 glasses
  S pour: [75 ml] / 125 ml
  C pours: 4 / 5 / [6]
! lumped-courses: seven different courses lumped into one row "7 courses"; per course would be 7 rows with no questions; lumping loses nothing the user could answer
```

#### 525. Pub dinner · British · pub

```text
- Scotch egg — 1
  C egg: none / [1]
- Steak and ale pie — 1
- Chips — 200 g
  C chips: [all] / half
- Peas — 80 g
- Gravy — 80 ml
- Pints — 3
  P beer: [bitter] / lager / stout
  C pints: 2 / [3] / 4
- Sticky toffee pudding — 0
  C pudding: [none] / ½ / 1
```

#### 526. Dim sum brunch for four · Cantonese · restaurant

```text
- Har gow — 3
- Siu mai — 3
- Char siu bao — 1
- Cheung fun — 2 rolls
- Turnip cake — 2 pieces
- Chicken feet — 0
  C feet: [none] / 2 / 4
- Lo mai gai — ½
  C my share: none / [½] / 1
- Egg tarts — 1
- Mango sago — 0
  C dessert: [none] / 1
- Tea — 4 cups
```

#### 527. Hot pot dinner for six · Chongqing · restaurant

```text
- Beef and lamb — 200 g
  C my meat: 150 g / [200 g] / 300 g
- Tripe and other offal — 50 g
  C offal: none / [50 g] / 100 g
- Shrimp paste and fish balls — 60 g
- Tofu and vegetables — 200 g
- Noodles — 100 g
  C noodles: none / [100 g] / 200 g
- Sauce bar dip — 60 g
  P sauce: [sesame paste] / sesame oil and garlic / vinegar and chili
  C dip: 30 g / [60 g] / 100 g
- Soybean milk — 300 ml
- Beer — 2 bottles
  S bottle: [330 ml] / 500 ml
  C bottles: 1 / [2] / 3
```

#### 528. Fondue night · Swiss · chalet

```text
- Bread cubes — 120 g
  C bread: 80 g / [120 g] / 180 g
- Cheese fondue — 180 g
  C cheese: 120 g / [180 g] / 250 g
- Boiled potatoes — 3
  C potatoes: none / [3] / 5
- Pickles and onions — 50 g
- White wine — 3 glasses
  C glasses: 2 / [3] / 4
- Kirsch — 1
  C kirsch: none / [1]
```

#### 529. Neapolitan pizza night with friends · Italian · pizzeria

```text
- Fried starters (montanara, frittatina) — 2
  C count: 1 / [2] / 3
- Pizza — 1 whole
  P pizza: [margherita] / diavola / quattro formaggi / capricciosa
  C eaten: ¾ / [whole]
- Slice of a friend's pizza — 1
  C slices: none / [1] / 2
! linked-unknown: the friend's pizza kind is unknown too; a second P on the extra row
- Beer — 1
- Babà — 0
  C babà: [none] / 1
```

#### 530. Indian thali restaurant, unlimited · Rajasthani · thali house

```text
- Dal baati — 2 baati
  C baati: 1 / [2] / 3
- Ghee on baati — 15 g
  C ghee: 5 g / [15 g] / 25 g
- Gatte ki sabzi — 100 g
  C refills: [1] / 2
- Kadhi — 100 g
- Rice — 150 g
- Phulka with ghee — 4
  C phulka: 2 / [4] / 6
- Churma — 50 g
  C churma: none / [50 g] / 100 g
- Chaas — 1 glass
! refills-everywhere: every bowl is refilled; asking refills on each row would be 8 questions — keep the 3 that matter
```

#### 531. Wedding banquet, ten courses · Chinese · banquet hall

```text
- Cold platter — 60 g
- Shark fin-style soup — 1 bowl
- Roast suckling pig — 40 g
- Lobster, edible — 60 g
- Abalone and mushrooms — 1 piece
- Steamed fish — 80 g
- Crispy chicken — 80 g
- Fried rice — 80 g
- E-fu noodles — 80 g
- Red bean soup — 1 bowl
- Wine and brandy toasts — 3
  U drink: [red wine, 100 ml] / brandy, 30 ml
  C toasts: 2 / [3] / 6
! kind-sets-size: a drink whose pour comes with its kind (wine 100 ml, brandy 30 ml) is U, easy to miss
! many-rows: 11 rows, all small; fine on a phone if certain rows are compact
```

#### 532. American diner dinner · American · diner

```text
- Chicken fried steak — 1
- Country gravy — 100 g
- Mashed potatoes — 150 g
- Green beans — 80 g
- Biscuit — 1
- Sweet tea — 500 ml
  C refills: [none] / 1 / 2
- Apple pie à la mode — 1 slice
  C ice cream: none / [1 scoop]
```

#### 533. Izakaya night · Japanese · izakaya

```text
- Edamame — 50 g
- Karaage — 3
- Yakitori — 4 skewers
  C skewers: 2 / [4] / 6
- Agedashi tofu — 2 pieces
- Okonomiyaki — ¼
- Ochazuke — 0
  C ochazuke: [none] / 1
- Beer — 2
  C glasses: 1 / [2] / 3
- Highball — 2
  C highballs: 1 / [2] / 3
```

#### 534. Polish Christmas Eve · Polish · home

```text
- Barszcz with uszka — 250 ml
- Uszka — 6
  C count: 4 / [6] / 10
- Fried carp — 120 g
- Herring in oil — 50 g
- Pierogi with cabbage and mushroom — 4
  C count: 2 / [4] / 6
- Kutia — 50 g
- Kompot from dried fruit — 250 ml
- Poppy-seed cake — 1 slice
  C slices: none / [1] / 2
```

#### 535. Burns supper · Scottish · club

```text
- Haggis, neeps and tatties — 300 g
- Whisky sauce — 50 g
- Cock-a-leekie soup — 250 ml
- Cranachan — 1
- Whisky — 2 drams
  S dram: [25 ml] / 35 ml
  C drams: 1 / [2] / 3
```

#### 536. Vegan dinner · Modern · restaurant

```text
- Sourdough with olive oil — 1 slice
- Beetroot tartare — 100 g
- Mushroom risotto (vegan) — 300 g
- Roasted cauliflower steak — 1
- Tahini dressing — 30 g
- Natural wine — 2 glasses
- Dark chocolate tart — 1 slice
```

#### 537. Hungarian dinner · Hungarian · csárda

```text
- Goulash soup — 300 ml
- Chicken paprikash with nokedli — 350 g
- Sour cream — 30 g
- Cucumber salad — 100 g
- Pálinka — 1 shot
  C shots: none / [1] / 2
- Somlói galuska — 1
- Wine spritzer (fröccs) — 2
  U mix: [kisfröccs, 200 ml] / nagyfröccs, 300 ml / hosszúlépés, 300 ml
  C glasses: 1 / [2] / 3
! kind-sets-size: fröccs kinds come in different glass sizes, so U
```

#### 538. Sunday family lunch at grandma's · Ukrainian · home

```text
- Borscht — 400 ml
- Pampushky with garlic — 2
  C count: 1 / [2] / 3
- Holubtsi — 2
- Mashed potatoes — 150 g
- Chicken cutlet — 1
- Pickles — 50 g
- Vodka — 2 shots
  C shots: none / 1 / [2] / 3
- Napoleon cake — 1 slice
  S slice: [usual] / grandma's (large)
- Compote — 300 ml
```

#### 539. Kids' birthday party · home

```text
- Pizza slices — 2
  C slices: 1 / [2] / 3
- Chips — 30 g
- Sausage rolls — 2
- Cake — 1 slice
  S slice: small / [usual] / large
- Juice — 200 ml
- Gummies — 30 g
  C handful: 10 g / [30 g] / 60 g
```

#### 540. Dinner at a friend's, homemade lasagna · Italian · home

```text
- Lasagna — 1 piece
  S piece: small / [usual] / large
  C pieces: [1] / 2
- Garlic bread — 2 slices
- Salad with dressing — 100 g
- Red wine — 2 glasses
- Store-bought tiramisu — 1 portion
```

#### 541. Mongolian hot stone BBQ (khorkhog) · Mongolian · ger

```text
- Mutton, off the bone — 250 g
  C my meat: 150 g / [250 g] / 350 g
- Potatoes and carrots — 150 g
- Broth from the pot — 200 ml
  C broth: none / [200 ml] / 400 ml
- Airag (fermented mare's milk) — 1 bowl
  C bowls: none / [1] / 2
```

#### 542. Swedish smörgåsbord · Swedish · Christmas

```text
- Pickled herrings — 60 g
- Gravlax — 50 g
- Christmas ham — 80 g
- Meatballs — 6
  C count: 4 / [6] / 10
- Prinskorv — 3
- Janssons frestelse — 150 g
- Rye bread with butter — 2 slices
- Snaps — 2
  C snaps: none / 1 / [2] / 3
- Julmust — 250 ml
- Rice pudding — 100 g
```

#### 543. Paella party · Spanish · home

```text
- Paella — 350 g
  C my portion: 250 g / [350 g] / with seconds 550 g
! two-counts-one-row: "seconds" is the same count again, merged into one count question
```

#### 544. Pho and banh xeo dinner · Vietnamese · restaurant

```text
- Pho ×1
  - Noodles — 200 g
  - Beef — 80 g
  - Broth — 450 ml
    C drank: half / [all]
- Banh xeo — ½
  C my share: ½ / [1]
- Herbs and lettuce — 50 g
- Nuoc cham — 30 ml
```

#### 545. Dinner at an Indian friend's home · Gujarati · home

```text
- Rotli with ghee — 4
  C rotli: 2 / [4] / 6
- Dal — 200 g
- Shaak (two vegetables) — 150 g
- Rice — 150 g
- Kadhi — 100 g
- Shrikhand — 50 g
  C shrikhand: none / [50 g] / 100 g
- Farsan (dhokla, khandvi) — 60 g
```

#### 546. Barbecue ribs and sides, shared platter · American · BBQ

```text
- Ribs — 4 bones
  C bones: 2 / [4] / 6
- Pulled pork — 100 g
- Brisket — 80 g
- Mac and cheese — 100 g
- Coleslaw — 80 g
- Cornbread — 1
- Pickles — 30 g
- Beer — 2
```

#### 547. Seafood platter for two · French · brasserie

```text
- Oysters — 6
  C oysters: 3 / [6] / 9
- Prawns, peeled — 6
- Langoustines, edible — 3
- Crab, edible — 60 g
- Whelks and winkles — 40 g
- Bread and butter — 2 slices
- Mayonnaise — 20 g
  C mayo: none / [20 g] / 40 g
- Champagne — 2 glasses
  C glasses: 1 / [2] / 3
```

#### 548. Italian wedding lunch · Italian · villa

```text
- Antipasti buffet — 150 g
  C plate: 100 g / [150 g] / 250 g
- Risotto — 150 g
- Pasta — 150 g
- Roast veal with potatoes — 200 g
- Wedding cake — 1 slice
- Sorbet — 1
- Prosecco — 3 glasses
- Wine — 2 glasses
- Grappa — 0
  C grappa: [none] / 1
```

#### 549. Ramadan iftar buffet · Turkish · hotel

```text
- Dates and olives — 50 g
- Lentil soup — 250 ml
- Pide bread — 1 piece
- Meze plate — 150 g
- Kebab plate — 200 g
- Rice pilaf — 150 g
- Güllaç — 1 slice
- Baklava — 2
  C pieces: 1 / [2] / 4
- Ayran — 250 ml
```

#### 550. Chinese New Year dinner at home · Northern Chinese · home

```text
- Jiaozi — 15
  C count: 10 / [15] / 20
- Braised fish — 100 g
- Braised pork — 80 g
- Stir-fried dishes, assorted — 200 g
- Spring rolls — 2
- Nian gao — 2 slices
- Baijiu — 2 shots
  C shots: none / 1 / [2] / 3
```

### Set menus, business lunches, canteens

#### 551. Business lunch, three items · Russian · café

```text
- Soup of the day — 300 ml
  P soup: [borscht] / chicken noodle / solyanka / mushroom cream
- Main — 1
  P main: [chicken cutlet with buckwheat] / fish with rice / pasta bolognese
- Salad — 100 g
- Compote — 200 ml
- Bread — 1 slice
! menu-choice-kinds: the soup kinds differ in kcal and all are 300 ml — fine; the main kinds differ in structure (cutlet + side vs pasta) — kept whole as products
```

#### 552. Bento lunch set · Japanese · office canteen

```text
- Rice — 200 g
- Main — 1
  P main: [karaage] / grilled mackerel / ginger pork / hamburg steak
- Side dishes — 100 g
- Miso soup — 1
```

#### 553. School-style canteen tray · Russian · canteen

```text
- Buckwheat — 150 g
- Meatballs in gravy — 2
- Beet salad — 100 g
- Bread — 2 slices
- Kissel — 200 ml
```

#### 554. Corporate cafeteria, mixed plate · German · cafeteria

```text
- Plate from the counters — 1
  P main: [schnitzel] / vegetable curry / pasta
- Side — 150 g
  P side: [fries] / rice / salad
- Dessert — 0
  C dessert: [none] / 1
```

#### 555. Set lunch at a Chinese restaurant · Cantonese · restaurant

```text
- Soup of the day — 1 bowl
- Rice — 1 bowl
- Dish — 200 g
  P dish: [black pepper beef] / sweet and sour chicken / mapo tofu
- Lemon tea — 1
  P sugar: [usual] / less
```

#### 556. Indian lunch box (tiffin) · Mumbai · dabbawala

```text
- Chapati — 3
- Sabzi — 150 g
- Dal — 150 g
- Rice — 100 g
```

#### 557. Italian pranzo fisso · Italian · trattoria

```text
- Primo — 250 g
  P primo: [pasta al pomodoro] / risotto / minestrone
- Secondo — 1
  P secondo: [chicken cutlet] / fish of the day / meatballs
- Contorno — 150 g
- Water and coffee — 1
```

#### 558. Airline meal, economy · airline · flight

```text
- Main — 1 tray portion
  P main: [chicken with rice] / pasta / beef with mash
- Bread roll with butter — 1
- Salad — 60 g
- Dessert — 1
- Cheese and crackers — 1 pack
- Wine — 1 bottle 187 ml
  C bottles: none / [1] / 2
```

#### 559. Business class airline dinner · airline · flight

```text
- Canapés — 3
- Starter — 1
- Main — 1
  P main: [beef fillet] / sea bass / risotto
- Bread basket — 2
  C rolls: 1 / [2] / 3
- Cheese plate — 0
  C cheese: [none] / 1
- Dessert — 1
- Champagne — 2 glasses
- Wine — 2 glasses
```

#### 560. Train dining car · Russian · train

```text
- Solyanka — 300 ml
- Beef stroganoff with mash — 1
- Tea in a glass holder — 2
- Sugar cubes — 2
  C cubes: none / [2] / 4
```

#### 561. Hospital tray · German · hospital

```text
- Soup — 200 ml
- Main with sauce — 1
- Boiled potatoes — 150 g
- Pudding — 1
- Tea — 1
```

#### 562. University canteen · Chinese · campus

```text
- Rice — 200 g
  C rice: 150 g / [200 g] / 300 g
- Dishes from the line, two — 250 g
  C dishes: 200 g / [250 g] / 350 g
- Soup — 1 bowl
```

#### 563. Fast-casual salad bowl · American · salad chain

```text
- Salad bowl ×1
  S size: [regular] / large
  - Greens and vegetables — 200 g
  - Protein — 100 g
    P protein: [grilled chicken] / tofu / salmon / steak
  - Grain — 100 g
    C grain: none / [100 g]
  - Cheese — 30 g
    C cheese: none / [30 g]
  - Dressing — 40 g
    P dressing: [caesar] / balsamic / tahini / ranch
    C dressing: 20 g / [40 g] / 60 g
```

#### 564. Poke bowl, build your own · Hawaiian · poke shop

```text
- Poke bowl ×1
  S size: [regular] / large
  - Base — 200 g
    P base: [sushi rice] / brown rice / greens / half-half
  - Fish — 100 g
    P fish: [salmon] / tuna / tofu
  - Toppings — 80 g
  - Sauce — 30 g
    C sauce: 15 g / [30 g] / 50 g
  - Crispy onions — 10 g
    C crunch: none / [10 g]
```

#### 565. Burger joint combo · American · burger joint

```text
- Burger — 1
  U kind: [single, 220 g] / double, 320 g
- Fries — 1
  S size: [regular] / large
- Shake — 1
  P flavor: [vanilla] / chocolate / strawberry
  S size: [regular] / large
! linked-sizes: "make it large" for the combo moves fries and shake together
```

#### 566. Subway-style sub · American · sandwich chain

```text
- Sub ×1
  S size: [6-inch] / footlong
  - Bread — 1
    P bread: [white] / wheat / herbs and cheese
  - Filling — 80 g
    P filling: [Italian BMT] / turkey / tuna / chicken teriyaki
  - Cheese — 2 slices
    C cheese: none / [2 slices]
  - Sauce — 20 g
    P sauce: [mayo] / sweet onion / southwest / none-like mustard
    C sauce: [20 g] / 40 g
  - Vegetables — 60 g
! presence+kind: sauce "none / mayo / sweet onion" again
```

#### 567. Chipotle bowl · Tex-Mex · fast casual

```text
- Bowl ×1
  - Rice — 150 g
    P rice: [white] / brown
  - Beans — 100 g
    P beans: [black] / pinto
    C beans: none / [100 g]
  - Meat — 120 g
    P meat: [chicken] / steak / barbacoa / sofritas
    C meat: [single] / double
  - Salsa — 60 g
  - Cheese — 30 g
    C cheese: none / [30 g]
  - Sour cream — 30 g
    C sour cream: none / [30 g]
  - Guacamole — 0
    C guac: [none] / 1 portion
- Chips — 0
  C chips: [none] / 1 bag
```

#### 568. KFC-style meal · American · fast food

```text
- Chicken pieces — 2
  U piece: [thigh, 90 g] / drumstick, 70 g / breast, 150 g / wing, 40 g
  C pieces: 1 / [2] / 3
- Fries — 1
  S size: [regular] / large
- Coleslaw — 1
- Soda — 1
  S cup: [medium] / large
```

#### 569. McDonald's-style breakfast · American · fast food

```text
- Egg muffin — 1
  P kind: [sausage and egg] / egg and cheese / bacon and egg
  C count: [1] / 2
- Hash brown — 1
  C count: none / [1] / 2
- Coffee — 1
  S size: small / [medium] / large
- Creamer — 1
  C creamers: none / [1] / 2
- Sugar — 0
  C sachets: [none] / 1 / 2
```

#### 570. Döner box · German-Turkish · street

```text
- Döner box ×1
  S size: [regular] / large
  - Fries — 150 g
  - Döner meat — 120 g
    P meat: [veal] / chicken
  - Salad — 50 g
    C salad: none / [50 g]
  - Sauces — 50 g
    C sauce: 30 g / [50 g] / 80 g
```

#### 571. Pret-style lunch · British · café chain

```text
- Sandwich (label) — 1
- Soup (label) — 1
- Fruit pot — 1
- Coffee — 1
```

#### 572. Sushi conveyor belt · Japanese · kaitenzushi

```text
- Plates — 8
  C plates: 6 / [8] / 10 / 12
- Miso soup — 1
- Green tea — 2 cups
! lumped-plates: each plate is 2 pieces of a different kind; lumped as "plates" with an average; separate rows only if the photo shows the stack by color
```

#### 573. Bibimbap set lunch · Korean · restaurant

```text
- Bibimbap — 1 bowl
- Soup — 1
- Banchan — 100 g
- Rice refill — 0
  C refill: [none] / ½ bowl
```

#### 574. Pho chain lunch · Vietnamese · restaurant chain

```text
- Pho ×1
  S size: small / [regular] / large
  - Noodles — 200 g
  - Beef — 80 g
    P beef: [tái] / chín / combo
  - Broth — 450 ml
    C drank: half / [all]
- Spring rolls — 0
  C rolls: [none] / 2
```

#### 575. Lunch special at a Thai place · Thai · restaurant

```text
- Soup of the day — 1 cup
- Curry — 250 g
  P curry: [green] / red / massaman / panang
- Rice — 1 scoop
- Spring roll — 1
```

#### 576. Kebab shop late night · British · takeaway

```text
- Doner meat — 200 g
  S portion: small / [large]
- Chips — 200 g
- Garlic and chili sauce — 50 g
  C sauce: 30 g / [50 g] / 80 g
- Pita — 1
- Salad — 50 g
```

#### 577. Chinese takeaway for one · British-Chinese · takeaway

```text
- Main — 1 tub
  P main: [chicken chow mein] / sweet and sour chicken / beef in black bean
- Egg fried rice — 1 tub
  C eaten: half / [all]
- Prawn crackers — 30 g
  C crackers: none / [30 g] / 60 g
- Spring rolls — 2
```

#### 578. Japanese teishoku at a chain · Japanese · restaurant chain

```text
- Main — 1
  P main: [saba miso] / chicken nanban / pork ginger
- Rice — 1 bowl
  S bowl: small / [regular] / large
- Miso soup — 1
- Small sides — 2
```

#### 579. Indian buffet lunch · Indian · restaurant

```text
- Plate one ×1
  - Rice — 150 g
  - Curries, two — 200 g
  - Naan — 1
- Plate two ×1
  C second plate: none / [1]
  - Curries — 150 g
  - Pakoras — 3
- Gulab jamun — 2
  C count: none / 1 / [2] / 3
```

#### 580. Office catering, lunch meeting · German · office

```text
- Sandwiches, small — 3
  C count: 2 / [3] / 4
- Pasta salad — 100 g
- Fruit — 80 g
- Cookies — 2
  C cookies: none / 1 / [2]
- Coffee with milk — 2 cups
```

### Buffets, brunches, events

#### 581. Hotel breakfast buffet · international · hotel

```text
- Scrambled eggs — 120 g
  C eggs: 80 g / [120 g] / 180 g
- Bacon — 3 strips
  C strips: 2 / [3] / 5
- Sausages — 2
  C count: 1 / [2] / 3
- Croissant — 1
  C count: none / [1] / 2
- Yogurt with granola — 150 g
- Fruit — 100 g
- Orange juice — 200 ml
  C glasses: [1] / 2
- Cappuccino — 1
  C cups: [1] / 2
```

#### 582. Sunday brunch · American · restaurant

```text
- Eggs Benedict ×2
  C halves: 1 / [2]
  - English muffin half — 1
  - Ham — 1 slice
    P topping: [ham] / smoked salmon / spinach
  - Poached egg — 1
  - Hollandaise — 25 g
    C sauce: 15 g / [25 g] / 40 g
- Home fries — 100 g
- Mimosa — 2
  C glasses: 1 / [2] / 3
```

#### 583. Brunch for four, shared plates · Modern · café

```text
- Avocado toast — ½
  C my share: none / [½] / 1
- Pancake stack — ¼
- Granola bowl — ¼
- Shakshuka — ¼
- Pastries — 1
  C pastries: none / [1] / 2
- Flat white — 1
- Fresh juice — 1
```

#### 584. Wedding reception canapés · British · wedding

```text
- Canapés, assorted — 8
  C count: 5 / [8] / 12
- Champagne — 3 glasses
  C glasses: 2 / [3] / 5
- Wedding breakfast, three courses — 1
- Cake — 1 slice
- Evening buffet (bacon rolls) — 1
  C rolls: none / [1] / 2
- Wine — 3 glasses
- Gin and tonic — 2
  C drinks: 1 / [2] / 4
```

#### 585. Conference coffee break · international · conference

```text
- Mini pastries — 2
  C count: 1 / [2] / 3
- Cookies — 2
- Fruit — 50 g
- Coffee with milk — 2 cups
- Sugar sticks — 2
  C sticks: none / 1 / [2]
```

#### 586. All-inclusive resort lunch buffet · Mediterranean · resort

```text
- Plate one ×1
  - Salads — 150 g
  - Grilled fish — 100 g
  - Rice — 100 g
- Plate two ×1
  C second plate: none / [1]
  - Pasta — 150 g
  - Meatballs — 3
- Desserts — 2 small
  C desserts: 1 / [2] / 3
- Soft drinks — 2 glasses
  C glasses: 1 / [2] / 3
- Ice cream — 1 scoop
```

#### 587. Swedish fika at work · Swedish · office

```text
- Kanelbulle — 1
- Coffee — 2 cups
```

#### 588. Afternoon tea in a hotel · British · hotel

```text
- Finger sandwiches — 4
  C sandwiches: 3 / [4] / 5
- Scones ×2
  - Scone — 1
  - Clotted cream — 25 g
  - Jam — 20 g
- Pastries — 3
  C pastries: 2 / [3] / 4
- Tea — 3 cups
- Champagne — 1 glass
  C glasses: none / [1]
```

#### 589. Christmas market grazing · German · market

```text
- Bratwurst in a bun — 1
- Mulled wine — 2 mugs
  S mug: [200 ml] / 250 ml
  C mugs: 1 / [2] / 3
- Roasted almonds — 1 bag
  S bag: [100 g] / 200 g
  C eaten: half / [all]
- Lebkuchen — 1
- Kartoffelpuffer — 2
```

#### 590. Street food market, several stalls · international · market

```text
- Bao — 2
- Tacos — 2
- Churros — 3
- Craft beer — 1
  S glass: [⅓ pint] / pint
! many-stalls: each stall's item is a row; fine
```

#### 591. Birthday party at a restaurant, buffet · Russian · restaurant

```text
- Salads (Olivier, Caesar, herring) — 200 g
  C salads: 150 g / [200 g] / 300 g
- Cold cuts and cheese — 80 g
- Canapés — 4
- Hot dish — 1
  P hot: [chicken with potatoes] / fish with rice / pork with mushrooms
- Cake — 1 slice
- Wine — 3 glasses
- Vodka — 2 shots
  C shots: none / 1 / [2] / 4
```

#### 592. Barbecue at a friend's · American · backyard

```text
- Burger — 1
  C burgers: [1] / 2
- Hot dog — 1
  C hot dogs: none / [1] / 2
- Potato salad — 100 g
- Corn — 1
- Chips — 30 g
- Beer — 3
  C beers: 2 / [3] / 5
- Watermelon — 200 g
```

#### 593. Picnic in the park · French · park

```text
- Baguette — ¼
- Cheese — 60 g
- Saucisson — 40 g
- Grapes and strawberries — 150 g
- Rosé — 2 glasses
  C glasses: 1 / [2] / 3
```

#### 594. Dim sum trolley brunch · Hong Kong · restaurant

```text
- Baskets taken — 4
  C baskets: 3 / [4] / 6
- Tea — 3 cups
! lumped-baskets: each basket is a different kind; lumped by count like sushi plates
```

#### 595. Sunday roast carvery · British · carvery

```text
- Meats — 3 slices
  P meat: [turkey] / beef / pork / gammon
- Roast potatoes — 4
  C potatoes: 3 / [4] / 6
- Yorkshire pudding — 1
  C puddings: none / [1] / 2
- Vegetables — 150 g
- Stuffing — 1 ball
- Gravy — 100 ml
  C gravy: 50 ml / [100 ml] / 150 ml
! mixed-meats: one P chooses one meat; a plate with two meats is two rows
```

#### 596. Seder dinner · Jewish · home

```text
- Matzah — 2 sheets
  C sheets: 1 / [2] / 3
- Gefilte fish — 1 piece
- Matzah ball soup — 300 ml
- Brisket — 150 g
- Potato kugel — 100 g
- Charoset — 30 g
- Wine — 4 cups
  S cup: [100 ml] / 150 ml
- Macaroons — 2
```

#### 597. Diwali sweets at a party · Indian · home

```text
- Sweets, assorted (ladoo, barfi, kaju katli) — 4 pieces
  C pieces: 2 / [4] / 6
- Namkeen — 40 g
- Chai — 2 cups
```

#### 598. Eid lunch · Pakistani · home

```text
- Biryani — 300 g
- Korma — 150 g
- Naan — 1
- Sheer khurma — 150 g
  C bowl: none / [150 g] / 250 g
```

#### 599. Easter brunch · Polish · home

```text
- Eggs with mayo — 2
- Białą kiełbasa — 1
- Żurek — 250 ml
- Ham — 60 g
- Mazurek — 1 slice
- Babka — 1 slice
```

#### 600. Kulich and paskha at Easter · Russian · home

```text
- Kulich — 1 slice
  S slice: [usual] / thick
- Paskha — 50 g
  C paskha: none / [50 g] / 100 g
- Coloured eggs — 2
```

#### 601. Oktoberfest tent · Bavarian · festival

```text
- Half roast chicken, edible — 1
- Pretzel — 1
- Beer — 2 Maß
  C Maß: 1 / [2] / 3
```

#### 602. New Year's Eve at home · Russian · home

```text
- Olivier — 150 g
- Herring under a fur coat — 100 g
- Mandarins — 3
  C count: 2 / [3] / 5
- Canapés with caviar — 3
- Roast chicken — 150 g
- Champagne — 3 glasses
  C glasses: 2 / [3] / 4
- Cake — 1 slice
```

#### 603. Hanami picnic · Japanese · park

```text
- Bento box (homemade) — 1
- Onigiri — 2
- Dango — 1 skewer
- Beer — 2 cans
- Sake — 1 cup
```

#### 604. Thanksgiving with seconds · American · home

```text
- Plate one ×1
  - Turkey — 150 g
  - Stuffing — 120 g
  - Mashed potatoes with gravy — 200 g
  - Sweet potato casserole — 100 g
  - Green beans — 80 g
  - Cranberry sauce — 40 g
- Seconds ×1
  C seconds: none / [½ plate] / full plate
  - Turkey — 100 g
  - Stuffing — 80 g
  - Mashed potatoes with gravy — 120 g
- Pie — 1 slice
  P pie: [pumpkin] / pecan / apple
```

#### 605. Office party pizza · American · office

```text
- Pizza slices — 3
  P kind: [pepperoni] / cheese / veggie
  C slices: 2 / [3] / 4
- Soda — 1 can
- Cupcake — 1
```

#### 606. Kid's school lunch · American · school

```text
- Chicken nuggets — 5
- Tater tots — 80 g
- Milk carton — 240 ml
  P milk: [1 %] / chocolate
- Apple slices — 1 pack
```

#### 607. Funeral repast (pominki) · Russian · canteen

```text
- Kutia — 50 g
- Blini — 2
- Borscht — 300 ml
- Cutlet with mash — 1
- Kissel — 200 ml
- Vodka — 2 shots
  C shots: none / 1 / [2]
```

#### 608. Shabbat dinner · Jewish · home

```text
- Challah — 2 slices
- Chicken soup — 250 ml
- Roast chicken — 150 g
- Rice — 100 g
- Salad — 100 g
- Wine — 1 cup
- Babka — 1 slice
```

#### 609. Gala dinner · international · hotel

```text
- Starter — 1
- Soup — 1 cup
- Main — 1
  P main: [beef tenderloin] / chicken supreme / vegetarian
- Dessert — 1
- Bread roll with butter — 1
- Wine — 3 glasses
  C glasses: 2 / [3] / 5
```

#### 610. Sports bar game night · American · sports bar

```text
- Wings — 8
- Nachos, shared — ¼
- Sliders — 2
  C sliders: 1 / [2] / 3
- Beer — 3 pints
  C pints: 2 / [3] / 4 / 5
```

#### 611. Sushi party platter at home · Japanese · home

```text
- Rolls and nigiri — 12 pieces
  C my pieces: 8 / [12] / 16
- Edamame — 50 g
- Beer — 2
```

#### 612. Vegan potluck · Modern · home

```text
- Lentil salad — 150 g
- Vegan lasagna — 1 piece
- Hummus and crackers — 60 g
- Brownie — 1
```

#### 613. Korean jesa / holiday table · Korean · home

```text
- Jeon (pancakes), assorted — 4 pieces
  C pieces: 3 / [4] / 6
- Japchae — 100 g
- Galbijjim — 150 g
- Rice — 1 bowl
- Songpyeon — 3
  C count: 2 / [3] / 5
- Sikhye — 200 ml
```

#### 614. Mid-autumn mooncake tasting · Chinese · home

```text
- Mooncakes, quarters — 3
  P kinds: [mixed assortment] / lotus with yolk only
  C quarters: 2 / [3] / 4
- Tea — 3 cups
```

#### 615. Wine tasting with snacks · French · winery

```text
- Wine samples — 6
  S pour: [50 ml] / 75 ml
  C swallowed: spat most / half / [all 6] / 8
- Bread and cheese — 60 g
! spit-as-count: "spat out half" is the samples' count with labels, not a row
```

#### 616. Beer festival · Belgian · festival

```text
- Beer samples — 6
  P strength: [mixed, ~7 %] / mostly strong, ~9 %
  S glass: [150 ml] / 330 ml
  C samples: 4 / [6] / 10
- Fries — 1 cone
- Cheese cubes — 50 g
```

#### 617. Ramen festival, small bowls · Japanese · festival

```text
- Ramen tasting bowl ×3
  C bowls: 2 / [3] / 4
  - Noodles and toppings — 80 g
  - Broth — 150 ml
    C drank: some / [half] / all
```

#### 618. Kids' leftovers grazing · home

```text
- Half a fish finger plate — ½
- Pasta from the kid's plate — 60 g
  C bites: 30 g / [60 g] / 100 g
- Ketchup — 10 g
```

#### 619. Free samples at Costco · American · store

```text
- Samples, assorted — 6
  C samples: 3 / [6] / 10
```

#### 620. Cocktail party · international · home

```text
- Canapés — 6
  C count: 4 / [6] / 10
- Cheese and charcuterie — 50 g
- Cocktails — 3
  P cocktail: [mixed: G&T, spritz] / creamy (piña colada, white russian)
  C cocktails: 2 / [3] / 5
```

### Drinks, bars, cafés

#### 621. Flat white · Australian · café

```text
- Flat white — 1
  P milk: [whole] / oat / skim
```

#### 622. Cappuccino with sugar · Italian · bar

```text
- Cappuccino — 1
  S size: [regular 180 ml] / large 300 ml
- Sugar — 1 sachet
  C sachets: none / [1] / 2
```

#### 623. Iced latte with syrup · American · coffee chain

```text
- Iced latte, without ice — 1
  P milk: [2 %] / oat / almond
  S size: tall / [grande] / venti
- Vanilla syrup — 3 pumps
  C pumps: none / 2 / [3] / 4
```

#### 624. Frappuccino · American · coffee chain

```text
- Frappuccino — 1
  P kind: [caramel] / mocha / java chip
  S size: tall / [grande] / venti
- Whipped cream — 1
  C whip: none / [1]
```

#### 625. Raf coffee · Russian · coffee shop

```text
- Raf — 1
  P flavor: [vanilla] / lavender / citrus
  S size: [300 ml] / 400 ml
```

#### 626. Black coffee, three cups a day · office

```text
- Filter coffee — 3 cups
  C cups: 2 / [3] / 5
```

#### 627. Tea with milk and sugar · British · home

```text
- Tea with milk and sugar ×2
  C mugs: 1 / [2] / 3
  - Tea — 250 ml
  - Milk — 30 ml
  - Sugar — 1 tsp
    C sugar: none / [1 tsp] / 2 tsp
```

#### 628. Matcha · Japanese · café

```text
- Matcha latte — 1
  P milk: [oat] / cow
  S size: [M] / L
```

#### 629. Hot chocolate with marshmallows · American · café

```text
- Hot chocolate — 1
  S size: small / [medium] / large
- Whipped cream — 1
  C cream: none / [1]
- Marshmallows — 10 g
  C marshmallows: none / [handful]
```

#### 630. Chai latte · American · café

```text
- Chai latte — 1
  P milk: [whole] / oat
  S size: tall / [grande] / venti
```

#### 631. Kombucha · Modern · shop

```text
- Kombucha (label) — 1 bottle
```

#### 632. Energy drinks · gym · home

```text
- Energy drink — 1 can
  P kind: [regular] / sugar-free
  S can: [250 ml] / 500 ml
  C cans: [1] / 2
```

#### 633. Cola from a fountain · American · fast food

```text
- Cola, without ice — 1
  P kind: [regular] / zero
  S cup: small / [medium] / large
  C refills: [none] / 1 / 2
```

#### 634. Fresh juice · Turkish · street

```text
- Orange juice — 1
  S glass: small 200 ml / [large 350 ml]
```

#### 635. Smoothie · Modern · juice bar

```text
- Smoothie — 1
  P kind: [berry-banana] / green / protein peanut butter
  S size: [regular 450 ml] / large 650 ml
```

#### 636. Milk before bed · home

```text
- Milk — 250 ml
  P milk: [2.5 %] / 3.2 % / skim
```

#### 637. Kefir · Russian · home

```text
- Kefir — 250 ml
  P fat: 1 % / [2.5 %] / 3.2 %
```

#### 638. Beer with friends · Czech · pub

```text
- Beer — 3
  P beer: [světlý ležák 12°] / desítka 10° / dark
  S glass: [0.5 l] / 0.3 l
  C beers: 2 / [3] / 5
```

#### 639. Wine at dinner · Italian · home

```text
- Wine — 2 glasses
  P wine: [red dry] / white dry / sweet
  C glasses: 1 / [2] / 3
```

#### 640. Cocktails at a bar · international · cocktail bar

```text
- Cocktail — 1
  P cocktail: [margarita] / mojito / old fashioned / piña colada
- Second cocktail — 1
  P cocktail: [negroni] / espresso martini / spritz
  C ordered: none / [1]
! repeated-unknowns: each cocktail is its own row with its own kind; a list of drinks is a list of rows
```

#### 641. Gin and tonic · British · pub

```text
- Gin and tonic — 2
  S gin: [single 25 ml] / double 50 ml
  P tonic: [regular] / slimline
  C drinks: 1 / [2] / 3
```

#### 642. Whisky tasting · Scottish · distillery

```text
- Whisky — 4 drams
  S dram: [15 ml] / 25 ml
  C drams: 3 / [4] / 5
```

#### 643. Vodka shots at a party · Russian · home

```text
- Vodka — 5 shots
  S shot: [50 ml] / 30 ml
  C shots: 3 / [5] / 8
- Pickles and bread as zakuska — 60 g
```

#### 644. Cider · English · pub

```text
- Cider — 1 pint
  P cider: [dry] / sweet / fruit
```

#### 645. Sangria pitcher · Spanish · beach bar

```text
- Sangria — ⅓ pitcher
  C my share: ¼ / [⅓] / ½
```

#### 646. Lassi and chai · Indian · café

```text
- Mango lassi — 1
- Masala chai — 1
```

#### 647. Bubble tea with toppings · Taiwanese · shop

```text
- Brown sugar milk tea — 1
  S size: [M] / L
  P sugar: 50 % / [100 %]
- Pearls — 1 portion
  C pearls: none / [1] / extra
- Pudding — 0
  C pudding: [none] / 1
```

#### 648. Turkish coffee with lokum · Turkish · café

```text
- Turkish coffee — 1
  P sugar: sade / [orta] / şekerli
- Lokum — 2
  C pieces: 1 / [2] / 3
```

#### 649. Mulled wine · German · market

```text
- Glühwein — 2 mugs
  C mugs: 1 / [2] / 3
- Shot of rum — 0
  C with rum: [none] / 1
```

#### 650. Protein shake after gym · gym

```text
- Protein shake ×1
  - Protein powder — 1 scoop
    C scoops: [1] / 2
  - Liquid — 300 ml
    P liquid: [water] / milk / oat milk
```

#### 651. Hot milk with honey · home

```text
- Milk — 250 ml
- Honey — 1 tsp
  C honey: none / [1 tsp] / 2 tsp
```

#### 652. Sports drink after a run · home

```text
- Sports drink — 500 ml
  P kind: [regular] / zero
```

#### 653. Yerba mate gourd · Argentine · home

```text
- Mate — refilled
! zero-kcal: mate is ~0 kcal; no rows needed beyond water
```

#### 654. Coffee with condensed milk · Vietnamese · café

```text
- Coffee with condensed milk — 1
  P sweetness: less / [usual]
  S cup: [small] / large
```

#### 655. Cocoa at a ski hut · Austrian · ski hut

```text
- Hot chocolate with rum (Jagertee-like) — 1
  P kind: [hot chocolate] / Jagertee / Glühwein
```

#### 656. Beer and chips at home · home

```text
- Beer — 2 bottles
- Chips — 1 bag
  S bag: [small 70 g] / large 150 g
  C eaten: half / [all]
```

#### 657. Aperitivo hour · Italian · bar

```text
- Spritz — 1
- Snacks from the bar — 40 g
  C snacks: 20 g / [40 g] / 80 g
```

#### 658. Pub quiz night · British · pub

```text
- Pints — 3
- Crisps — 2 bags
  C bags: 1 / [2] / 3
```

#### 659. Kava / ayran / non-alcoholic · Turkish · restaurant

```text
- Ayran — 1
  S size: [200 ml] / 300 ml
```

#### 660. Kvass on a hot day · Russian · street

```text
- Kvass from a barrel — 1
  S cup: [0.5 l] / 1 l
```

### Snacks, packaged, street snacks

#### 661. Protein bar · gym

```text
- Protein bar (label) — 1
  C eaten: half / [whole]
```

#### 662. Chocolate bar, a few squares · home

```text
- Dark chocolate — 4 squares
  C squares: 2 / [4] / 6
! unit-from-pack: "a square" is 1/24 of a 100 g bar; the size comes with the product
```

#### 663. Crisps from the bag, shared · home

```text
- Crisps — ⅓ bag
  C my share: ¼ / [⅓] / ½
```

#### 664. Mixed nuts at the desk · office

```text
- Mixed nuts — 30 g
  C handfuls: 1 / [2] / 3
! handful-size: "handful" is a unit with a size (15 g); counts of it — the row needs a unit
```

#### 665. Apple and peanut butter · home

```text
- Apple — 1
- Peanut butter — 20 g
  C spoons: 1 / [2] / 3
```

#### 666. Ice cream from the tub · home

```text
- Ice cream — 150 g
  C scoops: 2 / [3] / 4
```

#### 667. Cookies with milk · home

```text
- Cookies — 3
  C count: 2 / [3] / 5
- Milk — 200 ml
```

#### 668. Gas station hot dog · American · gas station

```text
- Hot dog — 1
- Ketchup and mustard — 20 g
```

#### 669. Vending machine snack · office

```text
- Snack (label) — 1
  P snack: [chocolate bar] / crisps / cookies
```

#### 670. Granola bar · home

```text
- Granola bar (label) — 1
```

#### 671. Popcorn at home · home

```text
- Microwave popcorn — ½ bag
  C eaten: ¼ / [½] / whole
```

#### 672. Sunflower seeds · Russian · street

```text
- Sunflower seeds, kernels — 30 g
  C handfuls: 1 / [2] / 4
```

#### 673. Gummy bears · home

```text
- Gummy bears — 30 g
  C handful: 15 g / [30 g] / 50 g
```

#### 674. Cheese and crackers · home

```text
- Cheese — 40 g
- Crackers — 6
  C crackers: 4 / [6] / 10
```

#### 675. Dried fruit · home

```text
- Dried apricots and dates — 50 g
  C handful: 30 g / [50 g] / 80 g
```

#### 676. Rice cakes with spread · home

```text
- Rice cakes — 2
- Spread — 20 g
  P spread: [hummus] / peanut butter / cream cheese
```

#### 677. Yogurt cup · office

```text
- Yogurt (label) — 1
```

#### 678. Banana · office

```text
- Banana — 1
  S size: small / [medium] / large
```

#### 679. Churros from a stand · Spanish · street

```text
- Churros — 1 bag
  S bag: [small 6] / large 12
  C eaten: half / [all]
- Sugar — included
```

#### 680. Pretzel from a stand · German · train station

```text
- Pretzel — 1
  P kind: [plain] / with butter / cheese
```

#### 681. Corn dog · American · fair

```text
- Corn dog — 1
- Mustard — 15 g
```

#### 682. Funnel cake · American · fair

```text
- Funnel cake — ½
  C my share: ⅓ / [½] / whole
- Powdered sugar — included
```

#### 683. Cotton candy · American · fair

```text
- Cotton candy — 1
  S size: [regular] / large
```

#### 684. Takoyaki at a festival · Japanese · festival

```text
- Takoyaki — 6
```

#### 685. Samosa chaat · Indian · street

```text
- Samosa chaat — 1 plate
```

#### 686. Pastel at a feira · Brazilian · market

```text
- Pastel — 1
  P filling: [carne] / queijo / palmito
- Sugarcane juice — 300 ml
```

#### 687. Esquites cup · Mexican · street

```text
- Esquites — 1 cup
  S cup: [small] / large
- Mayo and cheese — included
  C extra: [none] / extra
```

#### 688. Shawarma wrap snack · Levantine · street

```text
- Shawarma wrap — 1
  U kind: [chicken, 280 g] / beef, 300 g / small, 180 g
```

#### 689. Egg waffle · Hong Kong · street

```text
- Egg waffle — 1
  C eaten: half / [all]
```

#### 690. Roasted chestnuts · European · street

```text
- Chestnuts, peeled — 10
  C count: 6 / [10] / 15
```

#### 691. Fruit cup · Mexican · street

```text
- Fruit cup with chili and lime — 300 g
```

#### 692. Kettle corn · American · fair

```text
- Kettle corn — 1 bag
  C eaten: ⅓ / [½] / whole
```

#### 693. Seaweed snacks · Korean · home

```text
- Seaweed snack (label) — 1 pack
```

#### 694. Onigiri on the go · Japanese · konbini

```text
- Onigiri (label) — 2
  C count: 1 / [2]
```

#### 695. Meat pie · Australian · bakery

```text
- Meat pie — 1
- Tomato sauce — 20 g
```

#### 696. Sausage roll and coffee · British · train station

```text
- Sausage roll — 1
- Coffee — 1
```

#### 697. Croissant from a supermarket · home

```text
- Croissant (label) — 1
```

#### 698. Granola and yogurt pot · British · café chain

```text
- Granola pot (label) — 1
```

#### 699. Toast with butter and jam · home

```text
- Toast ×2
  C slices: 1 / [2] / 3
  - Bread — 1
  - Butter — 7 g
    C butter: thin / [usual] / thick
  - Jam — 15 g
    C jam: none / [15 g] / 25 g
```

#### 700. Sandwich from home · home

```text
- Sandwich ×1
  - Bread — 2 slices
  - Cheese — 1 slice
  - Ham — 2 slices
  - Butter — 5 g
    C butter: none / [5 g]
```

### Home cooking, family meals

#### 701. Weeknight pasta bolognese · Italian · home

```text
- Spaghetti — 250 g
  C portion: 200 g / [250 g] / 350 g
- Bolognese — 150 g
- Parmesan — 10 g
  C cheese: none / [10 g] / 20 g
```

#### 702. Home stir-fry with rice · Chinese · home

```text
- Chicken and vegetable stir-fry — 250 g
  P oil: light / [usual] / oily
- Rice — 200 g
  C rice: 150 g / [200 g] / 300 g
```

#### 703. Home curry with rice · Indian · home

```text
- Chicken curry — 250 g
- Rice — 200 g
```

#### 704. Roast chicken with vegetables · home

```text
- Roast chicken, meat — 200 g
  P cut: [leg with skin] / breast without skin
- Roast vegetables — 200 g
  P oil: [usual] / oily
```

#### 705. Fried potatoes with mushrooms · Russian · home

```text
- Fried potatoes with mushrooms — 300 g
  P oil: [usual] / oily
  C portion: 200 g / [300 g] / 400 g
- Pickles — 50 g
```

#### 706. Buckwheat with milk · Russian · home

```text
- Buckwheat — 200 g
- Milk — 150 ml
- Sugar — 1 tsp
  C sugar: none / [1 tsp] / 2 tsp
```

#### 707. Home borscht from the pot · Ukrainian · home

```text
- Borscht — 1 bowl
  S bowl: [small 300 ml] / big 450 ml
- Sour cream — 1 tbsp
  C spoons: none / [1] / 2
```

#### 708. Homemade burgers · home

```text
- Burger ×2
  C burgers: 1 / [2]
  - Bun — 1
  - Patty — 1
    S patty: [120 g] / 180 g
  - Cheese — 1 slice
  - Sauce — 20 g
! dish-size-on-part: patty size is asked on the part inside a dish with count 2 — applies to both burgers; fine
```

#### 709. Tacos at home · Mexican · home

```text
- Taco ×3
  C tacos: 2 / [3] / 4
  - Tortilla — 1
    P tortilla: [flour] / corn / hard shell
  - Ground beef — 50 g
  - Cheese — 15 g
  - Sour cream — 15 g
  - Salsa — 15 g
```

#### 710. Mac and cheese from a box · American · home

```text
- Mac and cheese (box, as prepared) — ½ box
  C eaten: ⅓ / [½] / whole
- Butter and milk added — included
```

#### 711. Instant ramen · home

```text
- Egg — 1
  C egg: none / [1]
- Instant ramen ×1
  - Noodles and seasoning — 1 pack
  - Broth — 400 ml
    C drank: none / [half] / all
```

#### 712. Frozen pizza · home

```text
- Frozen pizza (label) — ½
  C eaten: ⅓ / [½] / whole
```

#### 713. Leftover plov · Uzbek · home

```text
- Plov (history) — 300 g
  C portion: 200 g / [300 g] / 400 g
```

#### 714. Soup from yesterday · home

```text
- Chicken soup (history) — 400 ml
```

#### 715. Eggs and toast · home

```text
- Eggs — 2
  P cooking: [fried in butter] / scrambled / boiled
  C eggs: 1 / [2] / 3
- Toast — 2 slices
```

#### 716. Overnight oats · home

```text
- Overnight oats ×1
  - Oats — 50 g
  - Milk — 150 ml
  - Yogurt — 50 g
  - Chia seeds — 10 g
  - Honey — 10 g
    C honey: none / [10 g] / 20 g
```

#### 717. Greek salad at home · home

```text
- Salad (tomato, cucumber, onion) — 250 g
- Feta — 50 g
- Olive oil — 1 tbsp
  C oil: 1 tsp / [1 tbsp] / 2 tbsp
```

#### 718. Grilled salmon with quinoa · home

```text
- Salmon fillet — 150 g
- Quinoa — 150 g
- Asparagus — 100 g
- Olive oil — 10 ml
```

#### 719. Kids' dinner leftovers · home

```text
- Fish fingers — 2
- Mash — 50 g
```

#### 720. Pancakes for the family, mine · home

```text
- Pancakes — 3
  C count: 2 / [3] / 4 / 5
- Maple syrup — 30 ml
  C syrup: 15 ml / [30 ml] / 60 ml
- Butter — 10 g
```

#### 721. Syrniki for breakfast at home · Russian · home

```text
- Syrniki — 4
  S size: [usual 50 g] / big 80 g
  C count: 3 / [4] / 5
- Sour cream — 40 g
  C amount: 20 g / [40 g] / 60 g
- Condensed milk — 0
  C drizzle: [none] / 20 g
```

#### 722. Mashed potatoes with cutlets · Russian · home

```text
- Mashed potatoes — 200 g
  P made with: water / [milk and butter]
- Cutlets — 2
  P meat: [pork-beef] / chicken
  C count: 1 / [2] / 3
```

#### 723. Pasta with pesto from a jar · home

```text
- Pasta — 250 g
- Pesto — ⅓ jar
  C jar: ¼ / [⅓] / ½
```

#### 724. Fish tacos at home · home

```text
- Fish taco ×3
  - Tortilla — 1
  - Fried fish — 50 g
  - Slaw — 30 g
  - Chipotle mayo — 15 g
    C mayo: none / [15 g] / 30 g
```

#### 725. Chili con carne from the pot · Tex-Mex · home

```text
- Chili con carne — 1 bowl
  S bowl: small 250 g / [usual 350 g] / large 450 g
- Sour cream — 30 g
- Grated cheese — 20 g
- Rice — 0
  C rice: [none] / 150 g
```

#### 726. Shakshuka at home · home

```text
- Shakshuka — ½ pan
  C my share: ⅓ / [½] / whole
- Bread — 2 slices
```

#### 727. Homemade pizza, shared · home

```text
- Homemade pizza — 3 slices
  C slices: 2 / [3] / 4
```

#### 728. Okroshka at the dacha · Russian · dacha

```text
- Okroshka — 400 ml
  P base: [kvass] / kefir / mineral water and sour cream
- Bread — 1 slice
```

#### 729. Dacha shashlik and vegetables · Russian · dacha

```text
- Shashlik — 250 g
  P meat: [pork] / chicken
  C my meat: 150 g / [250 g] / 350 g
- Grilled vegetables — 150 g
- Lavash — 1
- Ketchup — 30 g
- Beer — 2 bottles
  C bottles: 1 / [2] / 3
```

#### 730. Breakfast porridge with toppings · home

```text
- Porridge ×1
  - Oats — 50 g
  - Liquid — 200 ml
    P liquid: [milk] / water / half-half
  - Banana — ½
  - Peanut butter — 15 g
    C peanut butter: none / [15 g] / 30 g
  - Honey — 10 g
    C honey: none / [10 g] / 20 g
```

#### 731. Lunch box from home · office

```text
- Rice — 200 g
- Chicken teriyaki — 150 g
- Broccoli — 100 g
```

#### 732. Leftover Chinese takeaway · home

```text
- Leftover chow mein (history) — 200 g
  C eaten: [200 g] / all of it 300 g
```

#### 733. Quesadillas at home · home

```text
- Quesadilla — 2
  C count: 1 / [2]
- Sour cream — 30 g
- Salsa — 30 g
```

#### 734. Stuffed peppers · Balkan · home

```text
- Stuffed peppers — 2
  S pepper: [medium] / large
  C count: 1 / [2] / 3
- Sour cream — 30 g
```

#### 735. Home sushi rolls · home

```text
- Rolls, pieces — 12
  C pieces: 8 / [12] / 16
```

#### 736. Ukha · Russian · home

```text
- Ukha — 400 ml
- Bread — 1 slice
- Vodka — 1 shot
  C shots: none / [1]
```

#### 737. Pancakes with sour cream at grandma's · Ukrainian · home

```text
- Blinchiki — 5
  C count: 3 / [5] / 7
- Sour cream — 40 g
- Jam — 30 g
```

#### 738. Kotleta with pasta · Russian · home

```text
- Pasta — 200 g
- Kotleta — 1
  C count: [1] / 2
- Ketchup — 20 g
```

#### 739. Homemade burrito bowl · home

```text
- Rice — 150 g
- Black beans — 100 g
- Chicken — 120 g
- Corn and salsa — 80 g
- Avocado — ½
- Sour cream — 30 g
```

#### 740. Weekend fry-up · British · home

```text
- Eggs — 2
- Bacon — 3 rashers
- Sausages — 2
- Beans — 100 g
- Toast with butter ×2
  - Bread — 1
  - Butter — 8 g
```

#### 741. Dumplings from the freezer · home

```text
- Frozen dumplings (label) — 15
  C count: 10 / [15] / 20
- Soy sauce and vinegar — 20 ml
```

#### 742. Tuna salad sandwich · home

```text
- Tuna sandwich ×1
  - Bread — 2 slices
  - Tuna with mayo — 80 g
    P mayo: light / [usual]
```

#### 743. Spaghetti with butter and cheese for a kid, my share · home

```text
- Spaghetti with butter and cheese — 100 g
  C bites: 50 g / [100 g] / 150 g
```

#### 744. Homemade cake slice · home

```text
- Cake — 1 slice
  P cake: [Napoleon] / honey cake / chocolate
  S slice: small / [usual] / large
```

#### 745. Pelmeni from the pack · Russian · home

```text
- Pelmeni (label) — 250 g
  C portion: 200 g / [250 g] / 300 g
- Butter — 10 g
- Sour cream — 30 g
```

#### 746. Grilled cheese and tomato soup · American · home

```text
- Grilled cheese — 1
- Tomato soup (label) — 300 ml
```

#### 747. Vegetable stew · home

```text
- Vegetable stew — 350 g
  P oil: [usual] / oily
```

#### 748. Home sandwich lunch with soup · home

```text
- Soup — 300 ml
- Sandwich — 1
```

#### 749. Fajitas at home, build your own · Tex-Mex · home

```text
- Fajita ×3
  C fajitas: 2 / [3] / 4
  - Tortilla — 1
  - Chicken and peppers — 70 g
  - Cheese — 15 g
    C cheese: none / [15 g]
  - Sour cream — 15 g
    C sour cream: none / [15 g]
  - Guacamole — 20 g
    C guac: none / [20 g]
```

#### 750. Homemade hummus snack · home

```text
- Hummus — 80 g
- Carrot sticks — 100 g
- Pita — 1
```

### Diets, fitness, vegan

#### 751. Chicken, rice and broccoli · fitness · home

```text
- Chicken breast — 200 g
- Rice — 150 g
- Broccoli — 150 g
```

#### 752. Keto breakfast · keto · home

```text
- Eggs — 3
- Bacon — 3 rashers
- Avocado — ½
- Butter coffee — 1
  P fat: [butter + MCT] / butter only
```

#### 753. Vegan Buddha bowl · vegan · café

```text
- Quinoa — 120 g
- Roasted chickpeas — 80 g
- Sweet potato — 100 g
- Greens — 50 g
- Tahini dressing — 30 g
  C dressing: 15 g / [30 g] / 50 g
```

#### 754. Protein pancakes · fitness · home

```text
- Protein pancakes — 3
- Greek yogurt — 100 g
- Berries — 80 g
```

#### 755. Salad, dressing on the side · diet · café

```text
- Salad — 300 g
- Dressing — 1 cup
  C used: none / [half] / all
```

#### 756. Intermittent-fasting first meal · home

```text
- Omelette with vegetables — 1
- Toast — 1
- Coffee with milk — 1
```

#### 757. Vegan burger · vegan · restaurant

```text
- Vegan burger — 1
  P patty: [Beyond-style] / bean / mushroom
- Fries — 150 g
- Vegan mayo — 20 g
```

#### 758. Tofu scramble · vegan · home

```text
- Tofu scramble — 200 g
- Toast — 1
```

#### 759. Cottage cheese with berries · fitness · home

```text
- Tvorog — 200 g
  P fat: [5 %] / 0 % / 9 %
- Berries — 100 g
- Honey — 0
  C honey: [none] / 1 tsp
```

#### 760. Low-carb dinner · diet · home

```text
- Salmon — 150 g
- Cauliflower mash — 150 g
- Butter — 10 g
```

#### 761. Meal replacement shake · diet · home

```text
- Shake (label) — 1 bottle
```

#### 762. Salad bar, by weight · diet · supermarket

```text
- Salad bar box — 380 g (label weight)
! total-weight: one weighed box of mixed salads; split by the model, sum fixed
```

#### 763. Vegetarian thali · vegetarian · restaurant

```text
- Rice — 150 g
- Dal — 1 katori
  C katoris: [1] / 2
- Paneer sabzi — 120 g
- Roti — 3
  C roti: 2 / [3] / 4
- Curd — 100 g
- Sweet — 1
```

#### 764. Rice cakes and tuna · diet · office

```text
- Rice cakes — 3
- Tuna in water — 1 can
  S can: [small 80 g drained] / large 140 g
```

#### 765. Raw vegan dessert · vegan · café

```text
- Raw cake — 1 slice
```

#### 766. Egg white omelette · fitness · diner

```text
- Egg white omelette — 1
  P kind: [egg whites only] / whole eggs
- Turkey bacon — 2
- Toast — 0
  C toast: [none] / 1 slice
```

#### 767. Plant-based milk latte · vegan · café

```text
- Oat latte — 1
  S size: small / [medium] / large
```

#### 768. Gluten-free pasta · home

```text
- Gluten-free pasta — 250 g
- Tomato sauce — 120 g
```

#### 769. Sugar-free dessert · diet · home

```text
- Sugar-free jelly — 1 cup
```

#### 770. Pre-workout banana and coffee · fitness · home

```text
- Banana — 1
- Black coffee — 1
```

### More regional cuisines

#### 771. Hawaiian loco moco · Hawaiian · diner

```text
- Rice — 200 g
- Hamburger patty — 1
- Fried egg — 1
  C eggs: [1] / 2
- Gravy — 100 g
  C gravy: 50 g / [100 g] / 150 g
```

#### 772. Cajun gumbo · Louisiana · restaurant

```text
- Gumbo — 1 bowl
  P kind: [chicken and andouille] / seafood
  S bowl: cup / [bowl]
- Rice — included
```

#### 773. Jambalaya · Louisiana · festival

```text
- Jambalaya — 300 g
```

#### 774. Po'boy · New Orleans · deli

```text
- Po'boy — 1
  U kind: [fried shrimp, full, 450 g] / fried shrimp, half, 230 g / roast beef, full, 480 g / roast beef, half, 240 g
! two-whats-merged: filling and size (full / half) both depend on the menu; one U question of 4 combos
```

#### 775. Beignets · New Orleans · café

```text
- Beignets — 3
- Café au lait — 1
```

#### 776. Jerk chicken plate · Jamaican · restaurant

```text
- Jerk chicken, edible — 200 g
  S portion: [quarter] / half
- Rice and peas — 200 g
- Festival (fried dumpling) — 1
- Coleslaw — 60 g
```

#### 777. Roti with curry goat · Trinidadian · roti shop

```text
- Roti — 1
  U roti: [dhalpuri, 150 g] / paratha (buss-up-shut), 180 g
- Curry goat, off the bone — 200 g
```

#### 778. Doubles · Trinidadian · street

```text
- Doubles — 2
  C count: 1 / [2] / 3
```

#### 779. Cuban sandwich and plantains · Cuban · café

```text
- Cuban sandwich — 1
- Tostones — 6
- Cafecito — 1
```

#### 780. Puerto Rican mofongo · Puerto Rican · restaurant

```text
- Mofongo — 1
  P filling: [plain with garlic] / with shrimp / with chicharrón
```

#### 781. Fijian kokoda · Fijian · restaurant

```text
- Kokoda — 200 g
```

#### 782. Samoan oka and taro · Samoan · home

```text
- Oka — 150 g
- Taro — 200 g
- Palusami — 1
```

#### 783. Australian meat pie and lamington · Australian · bakery

```text
- Meat pie — 1
- Lamington — 1
```

#### 784. New Zealand hāngī · Māori · event

```text
- Meat (pork, chicken, lamb) — 200 g
- Kūmara — 150 g
- Stuffing — 80 g
- Pumpkin — 100 g
```

#### 785. Mongolian buuz · Mongolian · restaurant

```text
- Buuz — 5
  C count: 3 / [5] / 8
- Milk tea — 1
```

#### 786. Tibetan tsampa and butter tea · Tibetan · home

```text
- Tsampa — 80 g
- Butter tea — 2 cups
  C cups: 1 / [2] / 4
```

#### 787. Uyghur polo and samsa · Uyghur · restaurant

```text
- Polo — 300 g
- Samsa — 1
```

#### 788. Afghan kabuli pulao · Afghan · restaurant

```text
- Kabuli pulao — 350 g
- Lamb, off the bone — 150 g
- Bolani — 0
  C bolani: [none] / 1
```

#### 789. Yemeni mandi · Yemeni · restaurant

```text
- Rice — 300 g
- Lamb or chicken, off the bone — 200 g
  P meat: [lamb] / chicken
- Salta — 0
  C salta: [none] / 1 bowl
- Malawah — 1
```

#### 790. Israeli breakfast · Israeli · hotel

```text
- Shakshuka — 1
- Salads — 150 g
- Cheeses and labneh — 80 g
- Bread — 2 slices
- Halva — 20 g
```

#### 791. Lithuanian cepelinai · Lithuanian · restaurant

```text
- Cepelinai — 2
  C count: 1 / [2] / 3
- Sour cream and bacon sauce — 80 g
  C sauce: 40 g / [80 g] / 120 g
```

#### 792. Latvian grey peas with bacon · Latvian · restaurant

```text
- Grey peas with bacon — 250 g
- Kefir — 200 ml
```

#### 793. Estonian black bread and herring · Estonian · home

```text
- Black bread — 2 slices
- Herring — 60 g
- Butter — 10 g
```

#### 794. Romanian sarmale and mămăligă · Romanian · restaurant

```text
- Sarmale — 3
- Mămăligă — 150 g
- Sour cream — 40 g
- Ţuică — 1 shot
  C shots: none / [1] / 2
```

#### 795. Moldovan plăcintă · Moldovan · bakery

```text
- Plăcintă — 1
  P filling: [cheese] / potato / cabbage / pumpkin
```

#### 796. Bulgarian banitsa and boza · Bulgarian · bakery

```text
- Banitsa — 1 piece
- Boza — 1 cup
```

#### 797. Serbian breakfast burek and yoghurt · Serbian · bakery

```text
- Burek — 200 g
- Yoghurt drink — 250 ml
```

#### 798. Croatian peka · Croatian · konoba

```text
- Peka (lamb or octopus with potatoes) — 350 g
  P kind: [lamb] / octopus / veal
```

#### 799. Slovenian potica · Slovenian · home

```text
- Potica — 1 slice
```

#### 800. Albanian byrek and dhallë · Albanian · bakery

```text
- Byrek — 1 piece
- Dhallë — 1 glass
```

#### 801. Maltese pastizzi · Maltese · bakery

```text
- Pastizzi — 2
  P filling: [ricotta] / peas
  C count: 1 / [2] / 3
```

#### 802. Scottish full breakfast · Scottish · hotel

```text
- Eggs — 2
- Lorne sausage — 1
- Bacon — 2
- Haggis — 1 slice
- Tattie scone — 1
- Black pudding — 1 slice
- Beans — 80 g
- Toast — 1
```

#### 803. Welsh rarebit · Welsh · café

```text
- Welsh rarebit — 2 slices
```

#### 804. Irish coddle · Irish · home

```text
- Coddle — 400 g
- Soda bread with butter — 1 slice
```

#### 805. Icelandic hot dog · Icelandic · street

```text
- Pylsa — 1
  C count: [1] / 2
```

#### 806. Finnish salmon soup and rye · Finnish · restaurant

```text
- Lohikeitto — 350 ml
- Rye bread with butter — 2 slices
```

#### 807. Norwegian brown cheese on waffles · Norwegian · home

```text
- Waffle heart — 2
- Brunost — 20 g
- Jam — 20 g
```

#### 808. Danish rugbrød lunch · Danish · office

```text
- Rye bread open sandwiches — 3
  P toppings: [liver pâté, egg, herring mix] / meatball and cabbage mix
```

#### 809. Belgian stoofvlees with fries · Belgian · brasserie

```text
- Stoofvlees — 250 g
- Fries — 200 g
- Mayo — 30 g
- Trappist beer — 1
```

#### 810. Luxembourg judd mat gaardebounen · Luxembourgish · restaurant

```text
- Smoked pork collar — 200 g
- Broad beans — 150 g
- Potatoes — 150 g
```

#### 811. Swiss rösti and bratwurst · Swiss · restaurant

```text
- Rösti — 250 g
- Bratwurst — 1
- Onion sauce — 80 g
```

#### 812. Austrian Tafelspitz · Austrian · restaurant

```text
- Tafelspitz — 200 g
- Broth — 250 ml
  C broth: none / [250 ml]
- Roast potatoes — 150 g
- Apple horseradish — 30 g
```

#### 813. Dutch poffertjes · Dutch · market

```text
- Poffertjes — 10
  C count: [10] / 20
- Butter and powdered sugar — 15 g
```

#### 814. Portuguese cozido · Portuguese · restaurant

```text
- Meats and sausages — 200 g
- Vegetables and potatoes — 250 g
```

#### 815. Basque pintxos crawl · Basque · bars

```text
- Pintxos — 6
  C pintxos: 4 / [6] / 8
- Txakoli — 3 glasses
  C glasses: 2 / [3] / 4
```

#### 816. Sardinian porceddu · Sardinian · restaurant

```text
- Roast suckling pig — 200 g
- Pane carasau — 2 sheets
- Cannonau wine — 2 glasses
```

#### 817. Sicilian street lunch · Sicilian · market

```text
- Pane con la milza — 1
- Panelle — 3
- Arancina — 1
```

#### 818. Venetian cicchetti · Venetian · bacaro

```text
- Cicchetti — 4
  C count: 3 / [4] / 6
- Spritz — 2
- Ombra (small wine) — 1
```

#### 819. Tuscan ribollita · Tuscan · trattoria

```text
- Ribollita — 350 g
- Olive oil drizzle — 10 ml
```

#### 820. Ligurian trofie al pesto · Ligurian · trattoria

```text
- Trofie al pesto with potatoes and beans — 300 g
```

#### 821. Greek-Cypriot meze night · Cypriot · taverna

```text
- Meze, 20 small dishes — 400 g
  C my share: 300 g / [400 g] / 550 g
! lumped-meze: twenty dishes, lumped; per dish would be 20 rows with "my share" each
```

#### 822. Armenian lavash with herbs and cheese · Armenian · home

```text
- Lavash — 1 sheet
- Cheese — 60 g
- Herbs — 30 g
```

#### 823. Azerbaijani dushbara · Azerbaijani · restaurant

```text
- Dushbara in broth — 300 ml
```

#### 824. Kazakh baursak and tea · Kazakh · home

```text
- Baursak — 5
  C count: 3 / [5] / 8
- Tea with milk — 2 cups
```

#### 825. Tajik qurutob · Tajik · restaurant

```text
- Qurutob — 400 g
```

#### 826. Turkmen ichlekli · Turkmen · home

```text
- Ichlekli — 1 piece
```

#### 827. Nepali sel roti · Nepali · festival

```text
- Sel roti — 2
- Tea — 1
```

#### 828. Bhutanese ema datshi · Bhutanese · home

```text
- Ema datshi — 150 g
- Red rice — 200 g
```

#### 829. Burmese mohinga · Burmese · street

```text
- Mohinga — 1 bowl
  S bowl: [regular] / large
```

#### 830. Lao khao piak sen · Lao · street

```text
- Khao piak sen — 1 bowl
```

#### 831. Cambodian kuy teav · Cambodian · street

```text
- Kuy teav — 1 bowl
- Fried garlic oil — 1 tsp
```

#### 832. Malaysian banana leaf rice · Malaysian · restaurant

```text
- Rice — 250 g
  C refills: [1] / 2
- Curries poured on rice — 150 g
- Vegetables — 100 g
- Fried chicken or fish — 1
  P protein: [fried chicken] / fried fish / mutton
- Papadum — 2
```

#### 833. Singapore hawker chilli crab, shared · Singaporean · hawker

```text
- Crab meat — 150 g
- Chilli sauce — 100 g
- Mantou — 3
  C mantou: 2 / [3] / 4
```

#### 834. Indonesian rijsttafel · Dutch-Indonesian · restaurant

```text
- Rice — 200 g
- Dishes, 12 small — 300 g
  C my share: 200 g / [300 g] / 400 g
- Krupuk — 15 g
```

#### 835. Filipino kamayan feast · Filipino · restaurant

```text
- Rice — 250 g
- Grilled meats and seafood — 250 g
  C my share: 150 g / [250 g] / 350 g
- Vegetables and fruit — 150 g
```

#### 836. Taiwanese night market crawl · Taiwanese · night market

```text
- Oyster omelette — 1
- Stinky tofu — 4 pieces
- Pepper bun — 1
- Bubble tea — 1
- Grilled squid — ½
! many-stalls: five rows, each simple
```

#### 837. Hong Kong cha chaan teng set · Hong Kong · cha chaan teng

```text
- Macaroni soup with ham — 1
- Scrambled egg toast — 1
- Milk tea — 1
```

#### 838. Macanese pork chop bun · Macanese · street

```text
- Pork chop bun — 1
```

#### 839. Japanese convenience store dinner · Japanese · konbini

```text
- Bento (label) — 1
- Fried chicken (label) — 1
- Chu-hi — 1 can
  P strength: [regular] / strong
```

#### 840. Okinawan goya champuru · Okinawan · home

```text
- Goya champuru — 250 g
- Rice — 150 g
- Awamori — 1
  C cups: none / [1]
```

#### 841. Korean temple food · Korean · temple

```text
- Rice — 1 bowl
- Vegetable dishes — 250 g
- Soup — 1
```

#### 842. North Korean-style naengmyeon · Korean · restaurant

```text
- Pyongyang naengmyeon ×1
  - Noodles and toppings — 250 g
  - Broth — 400 ml
    C drank: [half] / all
```

#### 843. Sichuan fish in chili oil, shared · Sichuan · restaurant

```text
- Fish, edible — 150 g
  P oiliness: drained / [usual]
  C my share: 100 g / [150 g] / 200 g
! fold-oil-into-kind: the oil picked up with the fish is a degree of the fish row (P oiliness), not a row of its own
- Rice — 1 bowl
```

#### 844. Yunnan crossing-the-bridge noodles · Yunnan · restaurant

```text
- Noodles — 200 g
- Meats and toppings — 100 g
- Broth with oil layer — 500 ml
  C drank: some / [half] / all
```

#### 845. Xinjiang lamb skewers · Xinjiang · night market

```text
- Lamb skewers — 10
  C skewers: 5 / [10] / 15
- Nang — 1
- Beer — 1
```

#### 846. Hainan coconut chicken hot pot · Hainanese · restaurant

```text
- Chicken — 150 g
- Coconut broth — 300 ml
- Vegetables — 100 g
```

#### 847. Northeast Chinese guo bao rou · Dongbei · restaurant

```text
- Guo bao rou — 150 g
  C my share: 100 g / [150 g] / 200 g
- Rice — 1 bowl
```

#### 848. Shanghai shengjian bao · Shanghainese · street

```text
- Shengjian bao — 4
  C count: [4] / 8
```

#### 849. Cantonese claypot rice · Cantonese · restaurant

```text
- Claypot rice — 1
- Crispy crust — some
  C crust: none / [some] / all
```

#### 850. Hakka salt-baked chicken · Hakka · restaurant

```text
- Salt-baked chicken — 150 g
```

#### 851. Teochew braised goose · Teochew · restaurant

```text
- Braised goose — 120 g
- Tofu and egg — 80 g
- Rice — 150 g
```

#### 852. Mexican pozole party · Mexican · home

```text
- Pozole — 1 bowl
  C bowls: [1] / 2
- Tostadas — 2
```

#### 853. Oaxacan tlayuda · Oaxacan · street

```text
- Tlayuda — 1
  P toppings: [tasajo] / cecina / chorizo
```

#### 854. Yucatán cochinita pibil tacos · Yucatecan · street

```text
- Cochinita tacos — 4
  C tacos: 3 / [4] / 6
- Pickled onions — 30 g
```

#### 855. Colombian ajiaco · Colombian · restaurant

```text
- Ajiaco — 450 ml
- Rice — 100 g
- Avocado — ¼
- Cream and capers — 30 g
```

#### 856. Ecuadorian encebollado · Ecuadorian · street

```text
- Encebollado — 1 bowl
- Chifles — 30 g
```

#### 857. Bolivian salteñas · Bolivian · bakery

```text
- Salteñas — 2
  C count: 1 / [2] / 3
```

#### 858. Chilean pastel de choclo · Chilean · restaurant

```text
- Pastel de choclo — 1 clay dish
```

#### 859. Uruguayan chivito · Uruguayan · restaurant

```text
- Chivito ×1
  - Bread — 1
  - Steak — 120 g
  - Ham, cheese, bacon, egg — 120 g
  - Mayo — 20 g
- Fries — 150 g
```

#### 860. Paraguayan chipa · Paraguayan · street

```text
- Chipa — 3
  C count: 2 / [3] / 5
```

### More full dinners

#### 861. Bottomless brunch · British · restaurant

```text
- Brunch main — 1
  P main: [full English] / eggs royale / pancakes / avocado toast
- Prosecco or mimosa — 4 glasses
  P drink: [prosecco] / mimosa / Bloody Mary
  C glasses: 2 / 3 / [4] / 6
! mixed-drinks: different drinks over two hours, one row with one kind — rows per kind if known
```

#### 862. Steak dinner at home for two · home

```text
- Ribeye — 300 g, my half
  C my share: ⅓ / [½] / ⅔
- Mashed potatoes — 150 g
- Green beans with butter — 100 g
- Red wine — 2 glasses
```

#### 863. Lobster dinner · American · seafood restaurant

```text
- Lobster, edible — 250 g
- Melted butter — 30 g
  C butter: 15 g / [30 g] / 50 g
- Corn — 1
- Clam chowder — 1 cup
- Key lime pie — 1 slice
```

#### 864. Korean fried chicken and beer (chimaek) for three · Korean · pub

```text
- Fried chicken, edible — 5 pieces
  C my pieces: 3 / [5] / 7
- Pickled radish — 40 g
- Beer — 1 pitcher share
  S pitcher: [1.6 l] / 2 l
  C my share: ¼ / [⅓] / ½
```

#### 865. Indian wedding dinner · Punjabi · wedding

```text
- Starters (tikka, pakora, samosa) — 6 pieces
  C pieces: 4 / [6] / 10
- Butter chicken — 150 g
- Dal makhani — 100 g
- Paneer — 100 g
- Naan — 1
- Biryani — 150 g
- Desserts (gulab jamun, jalebi, kulfi) — 3 pieces
  C sweets: 1 / [3] / 5
- Soft drinks — 2 glasses
```

#### 866. Moroccan feast for six · Moroccan · home

```text
- Harira — 1 bowl
- Pastilla — 1 slice
- Mechoui, off the bone — 150 g
- Couscous with seven vegetables — 200 g
- Bread — 1 piece
- Mint tea — 3 glasses
- Pastries — 3
```

#### 867. Japanese yakiniku · Japanese · yakiniku

```text
- Beef cuts — 200 g
  P cuts: [mixed (kalbi, loin)] / wagyu-heavy
  C my meat: 150 g / [200 g] / 300 g
- Rice — 1 bowl
- Kimchi and namul — 80 g
- Beer — 2
```

#### 868. Peruvian pollería family dinner · Peruvian · pollería

```text
- Chicken, edible — ¼
  S share: [¼] / ½
- Fries — 150 g
- Salad — 60 g
- Inca Kola — 1 glass
- Sauces — 3 dips
  C dips: 1 / 2 / [3]
```

#### 869. Nordic tasting menu · New Nordic · fine dining

```text
- Courses — 15 small
- Sourdough with butter — 1
- Juice pairing — 6 glasses
  S pour: [80 ml] / 120 ml
```

#### 870. Teppanyaki · Japanese · restaurant

```text
- Soup and salad — 1
- Shrimp — 4
- Steak — 150 g
  S steak: [150 g] / 200 g
- Fried rice — 200 g
  P butter: [usual] / generous
- Grilled vegetables — 100 g
- Sake — 1
```

#### 871. Turkish wedding dinner · Turkish · wedding hall

```text
- Soup — 1 bowl
- Rice — 150 g
- Lamb stew — 150 g
- Baklava — 2
- Ayran — 1
```

#### 872. Chinese hot pot, buffet style · Taiwanese · AYCE

```text
- Meat plates — 3
  S plate: [100 g] / 150 g
  C plates: 2 / [3] / 5
- Seafood and balls — 100 g
- Vegetables — 150 g
- Noodles — 100 g
- Sauce — 60 g
- Ice cream — 2 scoops
  C scoops: none / 1 / [2]
```

#### 873. Dinner at a Georgian friend's home · Georgian · home

```text
- Khachapuri — 2 slices
- Satsivi — 100 g
- Mtsvadi — 150 g
- Salads — 150 g
- Wine — 5 glasses
  C glasses: 3 / [5] / 7
! long-toasting: the glass count across an evening of toasts is the main uncertainty; you might know it
```

#### 874. Thai street-food dinner crawl · Thai · street

```text
- Pad kra pao with egg — 1
- Grilled pork skewers — 3
- Papaya salad — 1
- Coconut ice cream — 1
- Beer Chang — 1 large bottle
  S bottle: [620 ml] / 330 ml
```

#### 875. Late-night after a party · home

```text
- Shawarma — 1
- Fries — 100 g
- Cola — 500 ml
```

#### 876. Japanese family curry night · Japanese · home

```text
- Curry with rice — 1 plate
  S plate: small / [usual] / large
  C seconds: [none] / ½
! two-counts-one-row-again: "seconds" is a count of plates: allowed (count 1 / 1.5), labels "none / ½" mean extra; better as count labels "1 plate / 1½ plates"
```

#### 877. Spanish late dinner · Spanish · restaurant

```text
- Jamón and cheese board — 60 g
- Pulpo — 80 g
- Secreto ibérico — 150 g
- Patatas — 100 g
- Wine — 3 glasses
- Gin tonic — 1
  C after dinner: none / [1] / 2
```

#### 878. Barbecue at a Kazakh dacha · Kazakh · dacha

```text
- Lamb shashlik — 250 g
- Kuyrdak — 100 g
- Bread — 1 piece
- Salads — 150 g
- Vodka — 3 shots
- Kumys — 1 bowl
```

#### 879. Romantic dinner, shared dessert · French · restaurant

```text
- Starter — 1
- Main — 1
- Dessert, shared — ½
- Champagne — 2 glasses
- Chocolate truffles — 2
```

#### 880. Dinner at IKEA · Swedish · store

```text
- Meatballs — 15
  S plate: 10 / [15] / 20
- Mashed potatoes — 150 g
- Gravy — 60 g
- Lingonberry — 20 g
- Lingonberry drink — 2 refills
  C glasses: 1 / [2] / 3
! size-vs-count: IKEA's 10 / 15 / 20 meatballs is a menu size that is also a count; C is enough
```

### Edge cases

#### 881. Dark photo, unknown dish · unknown

```text
- Dish — 1 plate
  P what: [meat stew] / fish stew / vegetable stew
  S plate: small / [usual] / large
```

#### 882. Photo of a whole cake, "I ate a slice" · home

```text
- Cake — 1 slice
  P cake: [chocolate] / cream / fruit
  S slice: thin / [usual] / large
```

#### 883. Half margherita, half pepperoni pizza · pizzeria

```text
- Margherita slices — 2
  C slices: 1 / [2] / 3
- Pepperoni slices — 2
  C slices: 1 / [2] / 3
```

#### 884. Rum and coke · bar

```text
- Rum and coke ×2
  C drinks: 1 / [2] / 3
  - Rum — 40 ml
    S pour: single 25 ml / [standard 40 ml] / double 50 ml
  - Cola — 200 ml
    P cola: [regular] / diet
```

#### 885. Coffee with milk, milk unknown · café

```text
- Coffee — 250 ml
- Milk — 30 ml
  P milk: [whole] / oat / skim
  C milk: none / [30 ml] / 60 ml
! presence+kind: "black / whole / oat" is what the user would tap; it takes two questions here
```

#### 886. Fast-food sauce cups · fast food

```text
- Ketchup — 2 cups
  C cups: 1 / [2] / 3
- Ranch — 1 cup
  C cups: none / [1] / 2
```

#### 887. Scanned yogurt, ate part · home

```text
- Yogurt (label, 400 g pot) — 150 g
  C eaten: ¼ / [⅓] / ½ / whole
! label-fraction: fractions of the pack; the pack size comes from the label
```

#### 888. Scanned cookies, a few · home

```text
- Cookies (label) — 3
  C cookies: 2 / [3] / 5
```

#### 889. Text only: "a sandwich" · text

```text
- Sandwich — 1
  P kind: [ham and cheese] / chicken / tuna / egg
  S size: small / [usual] / large
```

#### 890. Text only: "lunch at the canteen, as usual" · text · canteen

```text
- Usual canteen lunch (history) — 1
  P which: [soup and cutlet] / pasta / buckwheat with chicken
```

#### 891. Text: "same as yesterday's breakfast" · text

```text
- Yesterday's breakfast (history) — 1
```

#### 892. Photo taken after eating, plate with leftovers · restaurant

```text
- Steak — 200 g
  C eaten: [most] / all
! after-photo: the photo shows what's left; the model estimates what was served minus what's left
```

#### 893. Two photos: before and after · restaurant

```text
- Pasta — 300 g served
  C eaten: half / [¾] / all
! two-photos: before + after give "served" and "left"; same shape
```

#### 894. A meal over two hours (snacking) · home

```text
- Chips — 60 g
- Dip — 40 g
- Beer — 3
- Pizza — 2 slices
! long-meal: one meal record for an evening; fine
```

#### 895. Unknown drink in a cup · café

```text
- Drink — 1 cup
  P drink: [latte] / cappuccino / hot chocolate / tea
  S cup: small / [medium] / large
```

#### 896. A child's portion, mine is the rest · home

```text
- Pasta — 100 g
  C my part: 50 g / [100 g] / 150 g
```

#### 897. Shared plate, two forks · restaurant

```text
- Risotto — ½
  C my share: ⅓ / [½] / ⅔
```

#### 898. Bread basket untouched? · restaurant

```text
- Bread — 0
  C pieces: [none] / 1 / 2
```

#### 899. Buffet plate photo, a second plate unknown · buffet

```text
- Plate — 1
  C plates: [1] / 2
! repeated-plate: "a second plate like this one" is a count on a dish of the plate
```

#### 900. Packed lunch, unknown contents · photo of a closed container

```text
- Packed lunch — 1
  P what: [rice with chicken] / pasta / salad
! nothing-visible: the model can only guess; better ask in text
```

#### 901. Glass of wine, refilled by a host · home

```text
- Wine — 3 glasses
  S pour: small 120 ml / [usual 150 ml] / generous 200 ml
  C glasses: 2 / [3] / 4 / 5
! pours-unknown: a host's pours vary; size and count both uncertain and both answerable roughly
```

#### 902. Ice cream sundae, shared by two · café

```text
- Sundae — ½
  C my share: ⅓ / [½] / whole
```

#### 903. Breakfast in bed, croissant and juice · home

```text
- Croissant — 1
- Orange juice — 200 ml
```

#### 904. Midnight cereal · home

```text
- Cereal — 1 bowl
  P cereal: [corn flakes] / granola / chocolate
  S bowl: small / [usual] / large
- Milk — 200 ml
```

#### 905. Party sheet cake · party

```text
- Sheet cake — 1 piece
  U piece: [corner, more frosting, 120 g] / middle, 100 g
! kind-as-size: a corner piece has more frosting and its own size: U
```

#### 906. Coffee and cake at a train station · station

```text
- Coffee — 1
- Muffin — 1
  U kind: [blueberry, 110 g] / chocolate, 130 g
```

#### 907. Leftover Halloween candy · home

```text
- Mini chocolate bars — 4
  C count: 2 / [4] / 6
```

#### 908. A bite of a friend's dessert · restaurant

```text
- Dessert bite — 1
  C bites: [1] / 2 / 3
```

#### 909. Popcorn and soda at the cinema, unshared · cinema

```text
- Popcorn — 1
  S size: small / [medium] / large
  C eaten: half / [most] / all
- Soda — 1
  S size: small / [medium] / large
```

#### 910. Airport lounge grazing · lounge

```text
- Snacks (nuts, cheese, crackers) — 80 g
  C snacks: 50 g / [80 g] / 120 g
- Soup — 1 cup
- Wine — 2 glasses
- Pastries — 1
```

#### 911. Food court tray · mall

```text
- Main — 1
  P main: [teriyaki chicken with rice] / pizza / burger
- Drink — 1
```

#### 912. Hospital vending machine · hospital

```text
- Chocolate bar (label) — 1
- Coffee (machine) — 1
```

#### 913. Wedding cake tasting · bakery

```text
- Cake samples — 4 small
  C samples: 3 / [4] / 6
```

#### 914. Food delivery, two dishes, ate one and half of the other · home

```text
- Pad thai — 1 box
- Green curry — ½ box
  C eaten: none / [½] / whole
- Rice — 1 box
  C eaten: ½ / [whole]
```

#### 915. Dumplings, mixed fillings in one plate · restaurant

```text
- Pork dumplings — 6
  C count: 4 / [6] / 8
- Shrimp dumplings — 4
  C count: 2 / [4]
! mixed-fillings: two rows by filling; if the fillings can't be told apart, one P row
```

#### 916. Bento with many compartments · Japanese · konbini

```text
- Bento (label) — 1
```

#### 917. Smoothie bowl made at home · home

```text
- Smoothie bowl ×1
  - Frozen banana — 1
  - Berries — 100 g
  - Milk — 80 ml
  - Granola — 30 g
  - Peanut butter — 15 g
    C peanut butter: none / [15 g] / 30 g
```

#### 918. Cocktail with unknown strength · bar

```text
- Long Island iced tea — 1
  S size: [regular] / large
```

#### 919. Eating straight from the pot · home

```text
- Stew — 3 ladles
  C ladles: 2 / [3] / 4
! pot-unknown: the ladle size is the unit; pots are a separate topic
```

#### 920. Sampling at a cheese shop · shop

```text
- Cheese samples — 6 cubes
  C cubes: 4 / [6] / 10
```

### More full meals across cuisines

#### 921. Italian aperitivo to dinner · Italian · Milan

```text
- Spritz — 2
- Aperitivo buffet — 150 g
  C plate: 100 g / [150 g] / 250 g
- Pizza later — 0
  C pizza: [none] / ½ / whole
```

#### 922. Greek Easter · Greek · home

```text
- Magiritsa — 250 ml
- Roast lamb — 200 g
- Potatoes — 150 g
- Tsoureki — 1 slice
- Red eggs — 2
- Wine — 3 glasses
```

#### 923. Thai family dinner at home · Thai · home

```text
- Rice — 1 plate
- Dishes, shared, three — 300 g
  C my share: 200 g / [300 g] / 400 g
- Fruit — 100 g
```

#### 924. Lebanese breakfast · Lebanese · café

```text
- Manakish — 1
- Labneh with oil — 80 g
- Foul — 150 g
- Vegetables and olives — 100 g
- Tea — 2
```

#### 925. Japanese breakfast · Japanese · ryokan

```text
- Rice — 1 bowl
- Grilled fish — 1 piece
- Miso soup — 1
- Tamagoyaki — 2 pieces
- Natto — 1 pack
  C natto: none / [1]
- Pickles — 1 dish
```

#### 926. Chinese breakfast · Chinese · street

```text
- Baozi — 2
- Soy milk — 300 ml
- Youtiao — 1
- Tea egg — 1
  C eggs: none / [1] / 2
```

#### 927. Indian breakfast · South Indian · café

```text
- Dosa — 1
- Vada — 2
  C vada: none / 1 / [2]
- Sambar — 1 cup
- Filter coffee — 1
```

#### 928. Turkish lunch at a lokanta · Turkish · lokanta

```text
- Dish from the counter — 1 portion
  P dish: [kuru fasulye] / karnıyarık / tavuk sote
- Pilav — 150 g
- Cacık — 100 g
- Bread — 2 slices
```

#### 929. Russian blini festival (Maslenitsa) · Russian · street

```text
- Blini — 3
  C count: 2 / [3] / 5
- Toppings — 3
  P toppings: [mixed: sour cream, jam, condensed milk] / caviar / mushrooms and cheese
- Tea — 2 cups
```

#### 930. Mexican breakfast · Mexican · fonda

```text
- Huevos rancheros — 1
- Refried beans — 100 g
- Tortillas — 3
- Café de olla — 1
```

#### 931. Brazilian lunch prato feito · Brazilian · restaurant

```text
- Rice — 150 g
- Beans — 120 g
- Steak — 150 g
- Fried egg — 1
  C egg: none / [1]
- Fries — 100 g
- Salad — 60 g
```

#### 932. Argentine merienda · Argentine · café

```text
- Medialunas — 2
- Tostado de jamón y queso — 1
- Café con leche — 1
```

#### 933. Peruvian breakfast · Peruvian · market

```text
- Pan con chicharrón — 1
- Coffee — 1
- Fresh juice — 1
```

#### 934. Ethiopian coffee ceremony · Ethiopian · home

```text
- Coffee — 3 small cups
  C cups: 2 / [3]
- Sugar — 2 tsp
  C sugar per cup: none / [1 tsp] / 2 tsp
- Popcorn — 50 g
! per-serving-across-rows: sugar per cup times cups; as a dish "coffee with sugar ×3" it works — again
```

#### 935. Nigerian party jollof · Nigerian · party

```text
- Jollof — 250 g
- Fried rice — 100 g
- Chicken — 1 piece
- Moin moin — 1
- Puff-puff — 3
  C count: 2 / [3] / 5
- Malt drink — 1
```

#### 936. South African bunny chow and beer · South African · takeaway

```text
- Bunny chow (quarter) — 1
- Beer — 1
```

#### 937. Kenyan street breakfast · Kenyan · street

```text
- Mandazi — 2
- Chai — 2 cups
```

#### 938. Egyptian street lunch · Egyptian · street

```text
- Ta'ameya sandwich — 2
  C count: 1 / [2] / 3
- Pickles — 40 g
```

#### 939. Gulf breakfast · Emirati · café

```text
- Balaleet — 150 g
- Chebab — 2
- Karak tea — 2 cups
```

#### 940. Iranian breakfast · Persian · home

```text
- Sangak — ¼
- Feta and walnuts — 60 g
- Herbs — 30 g
- Tea with sugar cubes ×2
  - Tea — 200 ml
  - Sugar cubes — 2
    C cubes: none / 1 / [2] / 3
```

#### 941. Afghan breakfast · Afghan · home

```text
- Naan — ½
- Qaymaq — 30 g
- Green tea — 2 cups
```

#### 942. Georgian breakfast · Georgian · home

```text
- Khachapuri — ¼
- Cheese — 50 g
- Tea — 1
```

#### 943. Uzbek breakfast · Uzbek · teahouse

```text
- Non — ½
- Kaymak with honey — 40 g
- Green tea — 3 bowls
```

#### 944. Polish breakfast · Polish · home

```text
- Bread rolls with butter — 2
- Ham and cheese — 50 g
- Scrambled eggs — 2 eggs
- Tea — 1
```

#### 945. Dutch breakfast · Dutch · home

```text
- Bread with butter — 2 slices
- Hagelslag — 15 g
- Cheese — 1 slice
```

#### 946. German Abendbrot · German · home

```text
- Bread — 3 slices
- Butter — 15 g
- Cold cuts and cheese — 80 g
- Pickles — 30 g
- Beer — 1
```

#### 947. Scandinavian lunch buffet · Swedish · restaurant

```text
- Plate ×1
  - Fish — 100 g
  - Potatoes — 150 g
  - Salad — 100 g
- Bread with butter — 2 slices
- Coffee and cookie — 1
```

#### 948. Spanish menú del día · Spanish · restaurant

```text
- Primero — 1
  P primero: [lentil stew] / salad / gazpacho
- Segundo — 1
  P segundo: [pork loin with fries] / fish / chicken
- Postre — 1
  P postre: [flan] / fruit / ice cream
- Bread — 1 piece
- Wine — 1 glass
! menu-choice-kinds: three kind questions, each a whole course; fine
```

#### 949. French formule déjeuner · French · bistro

```text
- Plat du jour — 1
- Dessert — 1
- Coffee — 1
- Water and bread — 1 piece
```

#### 950. Italian lunch at the bar · Italian · bar

```text
- Tramezzini — 2
  C count: 1 / [2] / 3
- Coffee — 1
```

#### 951. Japanese ramen and gyoza combo · Japanese · ramen shop

```text
- Ramen ×1
  S size: [regular] / large
  - Noodles — 150 g
  - Toppings — 80 g
  - Broth — 400 ml
    C drank: [half] / all
- Gyoza — 5
  C count: [5] / 10
- Rice — 0
  C rice: [none] / small bowl
```

#### 952. Korean lunch at a kimbap shop · Korean · bunsik

```text
- Kimbap — 1 roll
- Tteokbokki — 150 g
- Odeng soup — 1 cup
```

#### 953. Vietnamese breakfast · Vietnamese · street

```text
- Banh mi op la — 1
- Ca phe sua da — 1
```

#### 954. Malaysian breakfast · Malaysian · kopitiam

```text
- Roti canai — 2
- Teh tarik — 1
  P sugar: less / [usual]
```

#### 955. Singapore breakfast · Singaporean · kopitiam

```text
- Kaya toast set ×1
  - Kaya toast — 2 pieces
  - Soft eggs — 2
  - Kopi — 1
```

#### 956. Indonesian breakfast · Indonesian · street

```text
- Bubur ayam — 1 bowl
  S bowl: [regular] / large
- Krupuk — 10 g
```

#### 957. Filipino breakfast (silog) · Filipino · eatery

```text
- Garlic rice — 200 g
- Fried egg — 1
- Meat — 100 g
  P meat: [tocino] / longganisa / tapa
- Coffee — 1
```

#### 958. Thai breakfast · Thai · street

```text
- Jok (rice porridge) — 1 bowl
- Patongko — 3
  C count: 2 / [3] / 5
- Soy milk — 1 cup
```

#### 959. Taiwanese breakfast · Taiwanese · breakfast shop

```text
- Egg crepe (dan bing) — 1
  P filling: [plain] / cheese / ham / corn
- Rice milk tea — 1
  S size: [M] / L
```

#### 960. Hong Kong yum cha for one · Hong Kong · restaurant

```text
- Dim sum baskets — 3
  C baskets: 2 / [3] / 4
- Tea — 2 cups
```

#### 961. American road trip diner breakfast · American · diner

```text
- Eggs — 2
  P style: [over easy] / scrambled
- Bacon — 3
- Hash browns — 120 g
- Toast with butter — 2
- Pancakes — 0
  C short stack: [none] / 2 / 3
- Coffee refills — 3 cups
  C cups: 1 / 2 / [3] / 4
- Creamer — 2
  C creamers: none / 1 / [2] / 4
```

#### 962. Canadian breakfast · Canadian · diner

```text
- Pancakes — 3
- Peameal bacon — 2 slices
- Maple syrup — 60 ml
```

#### 963. Australian brunch · Australian · café

```text
- Smashed avo on toast — 1
- Poached eggs — 2
  C eggs: 1 / [2]
- Halloumi — 0
  C halloumi: [none] / side
- Flat white — 1
```

#### 964. Israeli hummusiya · Israeli · hummusiya

```text
- Hummus plate — 1
  P topping: [plain] / ful / mushrooms / meat
- Pita — 2
  C pitas: 1 / [2] / 3
- Raw onion and pickles — 50 g
```

#### 965. Cypriot halloumi and loukaniko · Cypriot · taverna

```text
- Halloumi — 3 slices
- Loukaniko — 1
- Bread — 1
```

#### 966. Argentinian choripán · Argentine · street

```text
- Choripán — 1
- Chimichurri — 20 g
```

#### 967. Chilean once (afternoon tea) · Chilean · home

```text
- Marraqueta — 1
- Avocado — ¼
- Ham and cheese — 50 g
- Tea — 1
```

#### 968. Colombian arepa and hot chocolate · Colombian · home

```text
- Arepa with cheese — 1
- Hot chocolate — 1 cup
- Cheese in the chocolate — 30 g
```

#### 969. Venezuelan hallaca at Christmas · Venezuelan · home

```text
- Hallaca, without leaf — 1
- Pan de jamón — 1 slice
- Ensalada de gallina — 100 g
```

#### 970. Cuban black beans and rice · Cuban · home

```text
- Moros y cristianos — 250 g
- Ropa vieja — 150 g
- Plantains — 80 g
```

### More home and everyday

#### 971. Sunday pancakes with toppings · home

```text
- Pancakes — 4
- Toppings — 2
  P toppings: [Nutella and banana] / berries and yogurt / syrup and butter
```

#### 972. Midnight toast · home

```text
- Toast with butter — 2
```

#### 973. Sick day soup and crackers · home

```text
- Chicken noodle soup (can) — 1
  C eaten: half / [whole can]
- Crackers — 6
```

#### 974. Office birthday cake · office

```text
- Cake — 1 slice
```

#### 975. A handful of grapes · home

```text
- Grapes — 100 g
  C handful: small / [usual] / large
```

#### 976. Tea and biscuits break · British · office

```text
- Tea with milk — 1
- Biscuits — 3
  P biscuits: [digestives] / chocolate digestives / Hobnobs
  C count: 2 / [3] / 5
```

#### 977. Leftover birthday cake for breakfast · home

```text
- Cake (history) — 1 slice
```

#### 978. Kids' snack plate, I finished it · home

```text
- Apple slices, cheese cubes, crackers — 100 g
```

#### 979. Batch-cooked chili, portion from the fridge · home

```text
- Chili (history) — 1 container
  S container: [400 g] / 600 g
```

#### 980. Microwave burrito · home

```text
- Burrito (label) — 1
```

#### 981. Instant noodles with extras · home

```text
- Instant noodles ×1
  - Noodles — 1 pack
  - Broth — 400 ml
    C drank: none / [half] / all
- Egg — 1
- Sausage — 0
  C sausage: [none] / 1
```

#### 982. Crêpes at home · home

```text
- Crêpes — 3
- Fillings — 3
  P fillings: [sugar and lemon] / Nutella / ham and cheese
```

#### 983. Fruit salad with yogurt · home

```text
- Fruit salad — 200 g
- Yogurt — 100 g
- Honey — 10 g
```

#### 984. Smoked fish and potatoes · Baltic · home

```text
- Smoked mackerel, edible — 100 g
- Potatoes — 200 g
- Butter — 10 g
```

#### 985. Tea and sushki · Russian · home

```text
- Tea — 2 cups
- Sushki — 5
  C count: 3 / [5] / 10
```

#### 986. Kasha with butter · Russian · home

```text
- Buckwheat kasha — 200 g
- Butter — 10 g
  C butter: none / [10 g] / 20 g
```

#### 987. Sandwich and kefir on the go · Russian · shop

```text
- Sandwich (label) — 1
- Kefir (label) — 1 bottle
```

#### 988. Pelmeni with butter and vinegar · Russian · home

```text
- Pelmeni — 20
- Butter — 10 g
- Vinegar — included
```

#### 989. Salad Olivier leftovers on January 1st · Russian · home

```text
- Olivier (history) — 250 g
  C bowl: 150 g / [250 g] / 400 g
```

#### 990. Homemade compote · Russian · home

```text
- Compote — 300 ml
  P sweetness: less / [usual] / sweet
```

#### 991. Cheese and wine evening at home · home

```text
- Cheese — 100 g
  C cheese: 60 g / [100 g] / 150 g
- Crackers — 40 g
- Grapes — 80 g
- Wine — 3 glasses
```

#### 992. Pizza delivery, two people · home

```text
- Pizza — 3 slices
  P kind: [pepperoni] / margherita / BBQ chicken
  S pizza: medium / [large] / XL
  C slices: 2 / [3] / 4 / 5
- Garlic dip — 1 tub
  C dip: none / [1] / 2
- Cola — 500 ml
```

#### 993. Ramen at home from scratch · home

```text
- Ramen ×1
  - Noodles — 150 g
  - Pork belly — 80 g
  - Egg — 1
  - Broth — 400 ml
    C drank: [half] / all
```

#### 994. Holiday cookies · home

```text
- Cookies — 4
  C count: 2 / [4] / 6
```

#### 995. Strawberries with cream · home

```text
- Strawberries — 200 g
- Whipped cream — 30 g
  C cream: none / [30 g] / 60 g
```

#### 996. Banana bread slice · home

```text
- Banana bread — 1 slice
  S slice: [usual] / thick
- Butter — 0
  C butter: [none] / 5 g
```

#### 997. Leftover rice bowl · home

```text
- Rice — 200 g
- Fried egg — 1
- Soy sauce and sesame oil — 5 ml
```

#### 998. Bedtime milk and cookies · home

```text
- Milk — 200 ml
- Cookies — 2
```

#### 999. Late-night döner · street

```text
- Döner — 1
  U kind: [bread, 450 g] / dürüm, 400 g
  C eaten: half / [all]
```

#### 1000. Champagne toast at midnight · home

```text
- Champagne — 1 glass
  C glasses: [1] / 2 / 3
```
