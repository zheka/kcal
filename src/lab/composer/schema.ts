/**
 * The meal's shape as a JSON Schema, for the model's answer (Gemini's `responseJsonSchema`): see
 * docs/lab-meal-format.md, read by meal.ts. Keys are listed in the order the model should write them (Gemini keeps
 * the schema's order), and every field is required: the model only decides what goes in them.
 * A row is one of three wrappers, each with a single key that names its kind, so the kind is
 * the first thing written and nothing has to be told apart by its fields.
 */

type Schema = Record<string, unknown>;

const object = (properties: Record<string, Schema>, extra: Schema = {}): Schema => ({
  type: 'object',
  ...extra,
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const string = (description?: string): Schema => ({
  type: 'string',
  ...(description && { description }),
});

// No minimum (≥ 0) or item counts: Gemini rejects the schema with them as "too many states";
// the reader (meal.ts) checks them instead.
const amount = (description?: string): Schema => ({
  type: 'number',
  ...(description && { description }),
});

const PER_100 = object(
  {
    kcal: amount(),
    protein: amount(),
    fat: amount(),
    carbs: amount(),
    water: amount(),
  },
  { description: 'Values per 100 g or 100 ml of the product as eaten.' },
);

const PRODUCT = {
  label: string('The chip: only what tells this option apart from the others.'),
  name: string('The full name, shown as the row’s name when chosen.'),
  base: { type: 'string', enum: ['g', 'ml'] },
  per_100: PER_100,
};

const SIZED_PRODUCT = object({
  ...PRODUCT,
  unit: object({
    name: string('The unit as said in the amount: шт., бокал, порция.'),
    size: amount('One unit in the product’s base.'),
  }),
});

const SIZE = object({
  label: string(
    'The unit in the amount: a menu size (grande), a named portion (обычная), a piece (шт.); ' +
      '"г" or "мл" only for a size of 1.',
  ),
  size: amount('In the product’s base.'),
});

const COUNT = object({
  label: string('The chip: the number, or words that say it better.'),
  count: amount(),
});

/**
 * A question: the doubt, the guess, the options; one option and an empty why when certain. The
 * rules the model breaks most when it writes without thinking are here, where it writes them.
 */
const OPTIONS =
  'One option when certain, and always when the input states it (a stated kind, amount or ' +
  'size). 2–4 only for a doubt the user can settle with a tap that changes 80+ kcal or 10+ g ' +
  'protein; never for what nobody said or showed.';
const question = (option: Schema, options = OPTIONS): Schema =>
  object({
    why: string('The doubt in a few words, shown as the hint; empty when there is one option.'),
    chosen: string('The label of the best guess, copied from an option.'),
    options: { type: 'array', items: option, description: options },
  });

const KINDS =
  OPTIONS +
  ' Unsure what a food is: options that are different foods (cod / chicken / pork), not ' +
  'variants of the first guess.';
const COUNTS =
  OPTIONS +
  ' Pieces (eggs, slices, cutlets, dumplings) are counted, also in a dish; a stated number ' +
  'of pieces is one option.';

const SIZED_FOOD = object(
  {
    sized_food: object({
      sized_products: question(SIZED_PRODUCT, KINDS),
      counts: question(COUNT, COUNTS),
    }),
  },
  {
    title: 'SizedFood',
    description:
      'A food whose size comes with its kind, and anything that comes in pieces (an egg, a ' +
      'slice, a cutlet): counted in its units.',
  },
);

const FOOD = object(
  {
    food: object({
      products: question(object(PRODUCT), KINDS),
      sizes: question(SIZE),
      counts: question(COUNT, COUNTS),
    }),
  },
  {
    title: 'Food',
    description:
      'A food whose size is chosen on its own (a menu size), or loose food: a named portion ' +
      'counted 1, or grams (a size "г" of 1) when the weight is stated or small.',
  },
);

const DISH = object(
  {
    dish: object({
      name: string('What is certain about the dish.'),
      items: { type: 'array', items: { anyOf: [SIZED_FOOD, FOOD] } },
      counts: question(COUNT),
    }),
  },
  { title: 'Dish', description: 'A dish of foods per serving, counted in servings.' },
);

export const MEAL_SCHEMA: Schema = object({
  title: string('A short title for the meals list.'),
  items: { type: 'array', items: { anyOf: [SIZED_FOOD, FOOD, DISH] } },
});
