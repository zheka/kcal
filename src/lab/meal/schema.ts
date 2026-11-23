/**
 * What the model answers (Gemini's `responseJsonSchema`): only what it perceives. Dishes named
 * as a menu or a food diary would (for finding them in history later), their products with
 * amounts and values per 100, and, where it is unsure, alternatives: whole products it could be
 * instead. Nothing about what to ask or what
 * matters: the code decides that (process.ts). Keys are in the order the model should decide
 * them (Gemini keeps the schema's order). Read by read.ts, forgivingly.
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

const PER_100 = object(
  {
    calories: number('kcal per 100 basis_unit'),
    protein_g: number('protein, g per 100 basis_unit'),
    carbs_g: number('carbohydrates, g per 100 basis_unit'),
    fat_g: number('fat, g per 100 basis_unit'),
    hydration_ml: number(
      'Water a drink or a soup gives to drink, ml per 100 basis_unit; 0 for food, and for a ' +
        'food or drink cooked into a food (milk in an omelette).',
    ),
  },
  { description: 'Values per 100 g or 100 ml of the product as eaten.' },
);

const PRODUCT = {
  name: string(
    'The specific food or drink, with its preparation when it matters, in the answer language: ' +
      '"Яйцо жареное", "Вареники с картошкой".',
  ),
  basis_unit: {
    type: 'string',
    enum: ['g', 'ml'],
    description: 'The unit of unit_amount and per_100: g, or ml for drinks and soups.',
  },
  count: orNull(
    'number',
    'How many pieces when it comes in pieces (eggs, slices, cutlets, dumplings, cookies, ' +
      'drinks); null for loose food and stated weights.',
  ),
  unit_name: orNull(
    'string',
    'The piece as counted, short: шт., ломт., стакан, бутылка; null when count is null.',
  ),
  amount_alias: orNull(
    'string',
    'A size name when there is one: a menu size (S, M, L, grande, 0,5) or a portion ' +
      '(маленькая, обычная, большая); null otherwise.',
  ),
  unit_amount: number(
    'In basis_unit: one piece when count is set (an egg: 50); otherwise the whole amount eaten ' +
      '(rice: 200). Never the total of all pieces when count is set.',
  ),
  per_100: PER_100,
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
