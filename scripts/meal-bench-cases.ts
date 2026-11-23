/**
 * The bench's test meals (scripts/meal-bench.ts): photos (food1.jpg … in the --photos folder,
 * not in the repo) and texts, some in several steps (the user's changes, then more input). Each
 * says what a good answer would be (by prompt-v4.md's rules) and what the user knows about the
 * photo (the truth, where known).
 */

export interface Step {
  texts?: string[];
  photos?: string[];
  /** Before this step: rows the user removed (×), by a part of the name, lower case. */
  remove?: string[];
  /**
   * Before this step: answers the user picked, by a part of the row's name (lower case), the
   * question (`amount`: its sizes or counts, whichever is a choice), the first or last option.
   */
  choose?: { row: string; question: string; pick: 'first' | 'last' }[];
}

export interface Case {
  id: string;
  title: string;
  expect: string;
  steps: Step[];
}

export const CASES: Case[] = [
  // Photos ------------------------------------------------------------------------------------
  {
    id: 'p1',
    title: 'rösti, fried eggs, bacon',
    expect:
      'Строки, не блюдо: рёшти 3, яичница 2 яйца, бекон ~4–5 полосок. Помидорки и петрушка отброшены. Вопросов 0–1 (бекон?).',
    steps: [{ photos: ['food1.jpg'] }],
  },
  {
    id: 'p2',
    title: 'two plates: grilled squid, grilled tuna; oil and balsamic on the table',
    expect:
      'Обе тарелки в фокусе: кальмар с овощами и тунец с картофелем и овощами. Масло и бальзамик на столе не включены.',
    steps: [{ photos: ['food2.jpg'] }],
  },
  {
    id: 'p2t',
    title: 'two plates, only the squid mine (text)',
    expect: 'Только кальмар с овощами; тунца нет.',
    steps: [{ photos: ['food2.jpg'], texts: ['я ел только кальмара'] }],
  },
  {
    id: 'p3',
    title: 'waffle, cappuccino; another plate and cup behind',
    expect:
      'Вафля с сахарной пудрой, сливки, капучино (размер или молоко под вопросом?); дозатор сахара не включён. Тарелка и чашка на заднем плане не включены.',
    steps: [{ photos: ['food3.jpg'] }],
  },
  {
    id: 'p4',
    title: 'sushi tray and a Coca-Cola can; another tray and can behind',
    expect:
      'Строки, не блюдо, по строке на вид: ролл с тобико ~4, нигири с опалённой рыбой 2, с крабом 2, с сурими 2, с угрём 2; имбирь отброшен или вместе. Кока-кола банка 330 мл, обычная. Поднос и банка сзади не включены.',
    steps: [{ photos: ['food4.jpg'] }],
  },
  {
    id: 'p5',
    title: 'shrimp tostadas ×3 and a shrimp taco',
    expect:
      'Тостады с креветкой и гуакамоле ×3 (без вопроса о числе), тако с креветками и перцами. Лайм и зелень отброшены; напиток у края не включён.',
    steps: [{ photos: ['food5.jpg'] }],
  },
  {
    id: 'p6',
    title: 'homemade: bread bowl and two folded toasts with egg and sausage',
    expect:
      'Хлеб-«горшочек» с яйцом, сыром и сосиской; 2 свёрнутых тоста с яйцом и сосиской. Вопросы — о том, что знаю я (яйца, сосиски)? Правды нет.',
    steps: [{ photos: ['food6.jpg'] }],
  },
  {
    id: 'p7',
    title: 'boiled potatoes and meatballs; bread, cheese, sausage',
    expect:
      'Тефтели ~8–9 с вопросом о виде (на самом деле куриные) и, может, о числе; картофель — вопрос о порции (маленькая / обычная / большая); хлеб 1 ломтик, сыр 2 ломтика, колбаса 2 ломтика.',
    steps: [{ photos: ['food7.jpg'] }],
  },
  {
    id: 'p7u',
    title: 'meatballs, then a large potato portion picked and "chicken meatballs" said',
    expect:
      'Шаг 2: тефтели куриные, без вопроса о виде; картофель — выбранная мной большая порция сохранена; остальное без изменений.',
    steps: [
      { photos: ['food7.jpg'] },
      {
        choose: [{ row: 'картоф', question: 'amount', pick: 'last' }],
        texts: ['тефтели куриные'],
      },
    ],
  },
  {
    id: 'p8',
    title: 'borscht with salo, pampushka, sour cream; a dark drink at the edge',
    expect:
      'Борщ с мясом, сало ~5 ломтиков, пампушка, сметана (сколько съел?). Напиток у края не включён.',
    steps: [{ photos: ['food8.jpg'] }],
  },
  {
    id: 'p9',
    title: 'a small borscht, pampushka, sour cream',
    expect: 'Борщ (с мясом или без?), пампушка, сметана. Игрушка и фон не при чём.',
    steps: [{ photos: ['food9.jpg'] }],
  },

  // Texts -------------------------------------------------------------------------------------
  {
    id: 't1',
    title: 'latte on oat milk and an almond croissant',
    expect:
      'Латте на овсяном — молоко известно, размер под вопросом; миндальный круассан — уверенно.',
    steps: [{ texts: ['латте на овсяном и миндальный круассан'] }],
  },
  {
    id: 't2',
    title: 'three al pastor tacos, one with a double tortilla, and a 0.5 cola',
    expect:
      'Тако аль пастор 3 (тортильи: 4 всего, или блюдо ×3 с вопросом о тортилье); кола 500 мл, уверенно.',
    steps: [{ texts: ['три тако аль пастор, одно с двойной тортильей, и кола 0.5'] }],
  },
  {
    id: 't3',
    title: 'buckwheat with a cutlet weighed 350 g, tea with sugar ×2',
    expect:
      'Гречка с котлетой — один продукт 350 г, вопрос о пропорции; чай с сахаром — блюдо ×2 с вопросом о сахаре.',
    steps: [{ texts: ['гречка с котлетой, взвесил 350 г, и чай с сахаром, два стакана'] }],
  },
  {
    id: 't4',
    title: 'business lunch',
    expect: 'Типичный бизнес-ланч, без придуманных вопросов.',
    steps: [{ texts: ['бизнес-ланч'] }],
  },
  {
    id: 't5',
    title: 'an omelette described part by part',
    expect:
      'Омлет из 3 яиц, 50 мл молока, на сливочном масле (масло — вопрос о количестве или уверенно); хлеб 1 кусок. Количества уверенные.',
    steps: [{ texts: ['омлет из 3 яиц с 50 мл молока на сливочном масле, кусок хлеба'] }],
  },
  {
    id: 't6',
    title: 'pelmeni with sour cream, then "20 of them", sour cream removed',
    expect:
      'Шаг 1: пельмени (вид? число — вопрос), сметана (сколько). Шаг 2: 20 шт. уверенно; сметана не вернулась.',
    steps: [{ texts: ['пельмени со сметаной'] }, { remove: ['сметан'], texts: ['съел 20 штук'] }],
  },
  {
    id: 't8',
    title: 'latte and a croissant, then the largest latte picked and "the croissant was almond"',
    expect:
      'Шаг 1: латте с вопросом о размере, круассан (вид?). Шаг 2: круассан миндальный, уверенно; размер латте — выбранный мной наибольший, сохранён.',
    steps: [
      { texts: ['латте и круассан'] },
      {
        choose: [{ row: 'латте', question: 'amount', pick: 'last' }],
        texts: ['круассан был миндальный'],
      },
    ],
  },
  {
    id: 't7',
    title: 'tonkotsu ramen',
    expect: 'Блюдо: лапша (порция?), чашу, яйцо, бульон с вопросом «выпил».',
    steps: [{ texts: ['рамен тонкоцу'] }],
  },
];
