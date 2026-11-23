/**
 * What the model answers (Gemini's `responseJsonSchema`): only what it perceives. Dishes named
 * as a menu or a food diary would (for finding them in history later); their products with
 * amounts and values per 100 of their unit; where it is unsure, the fewest and the most pieces,
 * the smallest and the largest size, and other products it could be. Nothing about what to ask
 * or what matters: the code decides that (process.ts). Keys are in the order the model should
 * decide them (Gemini keeps the schema's order). Read by read.ts, forgivingly.
 *
 * Names and descriptions say everything, units and scale included: the model follows them more
 * closely than the prompt (`hydration_ml` alone was read as the ml drunk, see
 * docs/lab-meal-format.md). Examples are in English, of form only (never values to copy), and
 * the answer is in the answer language: copied Russian words came out uninflected, and copied
 * English ones untranslated ("cup", "small"), so piece names have no examples. Sizes have no names
 * (a menu's M, grande, 0,5 read wrong next to the piece's name): the code shows them by amount.
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

/** A product's size and its likely range: the product's own, or an alternative product's. */
const SIZE = {
  base_units_in_piece: number(
    'In base_unit: one piece (an egg: 50); for loose food and stated weights, the whole amount ' +
      'eaten, as one piece (rice: 200). Never the total of all pieces.',
  ),
  smaller_base_units_in_piece: orNull(
    'number',
    'The smallest one piece likely is, or the next smaller size on the menu, in base_unit; 0 ' +
      'when it may not be there at all. null when the size is stated, weighed or a standard ' +
      'package.',
  ),
  larger_base_units_in_piece: orNull(
    'number',
    'The largest one piece likely is, or the next larger size on the menu, in base_unit. null ' +
      'when the size is stated, weighed or a standard package.',
  ),
};

const VALUES = {
  kcal_per_100_base_units: number('kcal in 100 base_unit of the product as eaten.'),
  protein_g_per_100_base_units: number('Protein, g in 100 base_unit of the product as eaten.'),
  carbs_g_per_100_base_units: number('Carbohydrates, g in 100 base_unit of the product as eaten.'),
  fat_g_per_100_base_units: number('Fat, g in 100 base_unit of the product as eaten.'),
  hydration_ml_per_100_base_units: number(
    'Water it gives to drink, ml in 100 base_unit of it, so at most 100: from a drink or a ' +
      'soup; 0 for food, and for a food or drink cooked into a food (milk in an omelette).',
  ),
};

const ALTERNATIVE_PRODUCT = object(
  {
    name: string('The specific food or drink, as the product’s name, in the answer language.'),
    ...SIZE,
    ...VALUES,
  },
  {
    description:
      'Another food or drink it may be, at the same count: its own size and range (the same ' +
      'as the product’s unless it comes in its own size) and its own values.',
  },
);

const PRODUCT = object({
  name: string(
    'The specific food or drink, with its preparation when it matters, in the answer ' +
      'language: "Fried egg", "Potato vareniki".',
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
  fewer_piece_count: orNull(
    'number',
    'The fewest pieces it likely is, when some are hidden or hard to count; 0 for an add-on ' +
      'that may not be there. null when all are in plain view or the count is stated, or ' +
      'piece_count is null.',
  ),
  more_piece_count: orNull(
    'number',
    'The most pieces it likely is, when some are hidden or hard to count. null when all are ' +
      'in plain view or the count is stated, or piece_count is null.',
  ),
  piece_name: orNull(
    'string',
    'The piece as counted, by its usual short name in the answer language, when it has one; ' +
      'null when it has none, or piece_count is null.',
  ),
  ...SIZE,
  ...VALUES,
  alternative_products: {
    type: 'array',
    items: ALTERNATIVE_PRODUCT,
    description:
      'Other foods or drinks it likely is, most likely first: another meat, another filling, ' +
      'another drink. [] when the input states what it is or the photo shows it clearly.',
  },
});

const DISH = object({
  name: string(
    'The dish as a menu or a food diary names it, the same each time, in the answer language: ' +
      '"Borscht", "Meatballs with potatoes", "Cappuccino". What is certain only; never the ' +
      'plate, cup or board, the meal, an amount or a doubt.',
  ),
  products: {
    type: 'array',
    items: PRODUCT,
    description: 'What the dish is made of or served with as its part (a side, a sauce, sugar).',
  },
});

export const MEAL_SCHEMA: Schema = object({
  title: string(
    'A short title for the meals list, in the answer language: "Breakfast", "Borscht with ' +
      'pampushka".',
  ),
  dishes: {
    type: 'array',
    items: DISH,
    description: 'The dishes of the meal; a food of its own (bread, a drink) is a dish of its own.',
  },
});
