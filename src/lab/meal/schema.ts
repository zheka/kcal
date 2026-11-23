/**
 * What the model answers (Gemini's `responseJsonSchema`): only what it perceives. Dishes named
 * as a menu or a food diary would (for finding them in history later), their products with
 * amounts and values per 100 of their unit, and, where it is unsure, alternatives: whole
 * products it could be instead. Nothing about what to ask or what matters: the code decides
 * that (process.ts). Keys are in the order the model should decide them (Gemini keeps the
 * schema's order). Read by read.ts, forgivingly.
 *
 * Names and descriptions say everything, units and scale included: the model follows them more
 * closely than the prompt (`hydration_ml` alone was read as the ml drunk, see
 * docs/lab-meal-format.md).
 */

type Schema = Record<string, unknown>;

const object = (properties: Record<string, Schema>, extra: Schema = {}): Schema => ({
  type: 'object',
  ...extra,
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const string = (description: string): Schema => ({ type: 'string', description });
const orNull = (type: string, description: string): Schema => ({
  type: [type, 'null'],
  description,
});
// No minimum or item counts: Gemini rejects a schema with many of them ("too many states").
const number = (description: string): Schema => ({ type: 'number', description });

const PRODUCT = {
  name: string(
    'The specific food or drink, with its preparation when it matters, in the answer language: ' +
      '"Яйцо жареное", "Вареники с картошкой".',
  ),
  base_unit: {
    type: 'string',
    enum: ['g', 'ml'],
    description: "The unit of this product's amounts and values: g, or ml for drinks and soups.",
  },
  piece_count: orNull(
    'number',
    'How many pieces when it comes in pieces (eggs, slices, cutlets, dumplings, cookies, ' +
      'drinks); null for loose food and stated weights.',
  ),
  piece_name: orNull(
    'string',
    'The piece as counted, short: шт., ломт., стакан, бутылка; null when piece_count is null.',
  ),
  piece_size_name: orNull(
    'string',
    "The piece's size by name when there is one: a menu size (S, M, L, grande, 0,5) or a " +
      'portion (маленькая, обычная, большая); null otherwise.',
  ),
  base_units_in_piece: number(
    'In base_unit: one piece (an egg: 50); for loose food and stated weights, the whole amount ' +
      'eaten, as one piece (rice: 200). Never the total of all pieces.',
  ),
  kcal_per_100_base_units: number('kcal in 100 base_unit of the product as eaten.'),
  protein_g_per_100_base_units: number('Protein, g in 100 base_unit of the product as eaten.'),
  carbs_g_per_100_base_units: number('Carbohydrates, g in 100 base_unit of the product as eaten.'),
  fat_g_per_100_base_units: number('Fat, g in 100 base_unit of the product as eaten.'),
  hydration_ml_per_100_base_units: number(
    'Water it gives to drink, ml in 100 base_unit of it, so at most 100: from a drink or a ' +
      'soup; 0 for food, and for a food or drink cooked into a food (milk in an omelette).',
  ),
};

const ALTERNATIVE = object(PRODUCT, {
  description: 'A complete product, as it would be if this reading were right.',
});

const DISH_PRODUCT = object({
  ...PRODUCT,
  alternatives: {
    type: 'array',
    items: ALTERNATIVE,
    description:
      'Other real readings of this product, most likely first, up to 4: a different food it ' +
      'could be (cod / chicken / pork, another filling), another size, another count when ' +
      'pieces are hidden. Change one thing per alternative. [] when the input states it or ' +
      'the photo shows it clearly. Do not judge whether it matters: the app does.',
  },
});

const DISH = object({
  name: string(
    'The dish as a menu or a food diary names it, the same each time: "Борщ", "Тефтели с ' +
      'картофелем", "Капучино". What is certain only; never the plate, cup or board, the meal, ' +
      'an amount or a doubt.',
  ),
  products: {
    type: 'array',
    items: DISH_PRODUCT,
    description: 'What the dish is made of or served with as its part (a side, a sauce, sugar).',
  },
});

export const MEAL_SCHEMA: Schema = object({
  title: string('A short title for the meals list: "Завтрак", "Борщ с пампушкой".'),
  dishes: {
    type: 'array',
    items: DISH,
    description: 'The dishes of the meal; a food of its own (bread, a drink) is a dish of its own.',
  },
});
