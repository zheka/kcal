/**
 * The bench's test meals (scripts/meal-bench.ts): photos (food1.jpg … in the --photos folder, not
 * in the repo) and texts, sent in the order given. Each says what a good answer would be by
 * src/lab/meal/prompt.md's rules, and what the user knows about the photo (the truth, where
 * known). No meal is sent back, so what was a later step (a correction) is just more input.
 */

export type CaseInput = { photo: string } | { text: string };

export interface Case {
  id: string;
  title: string;
  expect: string;
  inputs: CaseInput[];
}

export const CASES: Case[] = [
  // Photos ------------------------------------------------------------------------------------
  {
    id: 'p1',
    title: 'rösti, fried eggs, bacon',
    expect:
      'Рёшти 3, яичница 2 яйца, бекон ~4–5 полосок — штуками; одно блюдо («Яичница с беконом и рёшти») или по блюду на каждое, но не «Тарелка» и не «Завтрак». Помидорки и петрушка отброшены. Альтернатив почти нет.',
    inputs: [{ photo: 'food1.jpg' }],
  },
  {
    id: 'p2',
    title: 'two plates: grilled squid, grilled tuna; oil and balsamic on the table',
    expect:
      'Два блюда: кальмар с овощами и тунец с картофелем и овощами (тунец: альтернативы — разные рыбы/мясо). Масло и бальзамик на столе не включены.',
    inputs: [{ photo: 'food2.jpg' }],
  },
  {
    id: 'p2t',
    title: 'two plates, only the squid mine (text)',
    expect: 'Только кальмар с овощами; тунца нет.',
    inputs: [{ photo: 'food2.jpg' }, { text: 'я ел только кальмара' }],
  },
  {
    id: 'p3',
    title: 'waffle, cappuccino; another plate and cup behind',
    expect:
      'Вафля с сахарной пудрой, сливки, капучино (размер или молоко — альтернативы); дозатор сахара не включён. Тарелка и чашка на заднем плане не включены.',
    inputs: [{ photo: 'food3.jpg' }],
  },
  {
    id: 'p4',
    title: 'sushi tray and a Coca-Cola can; another tray and can behind',
    expect:
      'По блюду на вид, названному по виду (не «Сет» и не «Поднос»): ролл с тобико ~4, нигири с опалённой рыбой 2, с крабом 2, с сурими 2, с угрём 2; имбирь отброшен. Кока-кола банка 330 мл, обычная. Поднос и банка сзади не включены.',
    inputs: [{ photo: 'food4.jpg' }],
  },
  {
    id: 'p5',
    title: 'shrimp tostadas ×3 and a shrimp taco',
    expect:
      'Тостады с креветкой и гуакамоле 3 шт. (без альтернатив числа), тако с креветками и перцами. Лайм и зелень отброшены; напиток у края не включён.',
    inputs: [{ photo: 'food5.jpg' }],
  },
  {
    id: 'p6',
    title: 'homemade: bread bowl and two folded toasts with egg and sausage',
    expect:
      'Хлеб-«горшочек» с яйцом, сыром и сосиской; 2 свёрнутых тоста с яйцом и сосиской. Яйца штуками, не граммами (альтернатива 1 / 2 яйца уместна). Правды нет.',
    inputs: [{ photo: 'food6.jpg' }],
  },
  {
    id: 'p7',
    title: 'boiled potatoes and meatballs; bread, cheese, sausage',
    expect:
      'Тефтели ~8–9 с альтернативами вида (на самом деле куриные) и, может, числа; картофель — альтернативы порции; хлеб 1 ломтик, сыр 2 ломтика, колбаса 2 ломтика.',
    inputs: [{ photo: 'food7.jpg' }],
  },
  {
    id: 'p7t',
    title: 'meatballs, and "chicken meatballs" said',
    expect: 'Тефтели куриные, без альтернатив вида; остальное как в p7.',
    inputs: [{ photo: 'food7.jpg' }, { text: 'тефтели куриные' }],
  },
  {
    id: 'p8',
    title: 'borscht with salo, pampushka, sour cream; a dark drink at the edge',
    expect:
      'Борщ с мясом и сметаной в нём (вид мяса — альтернативы?); сало ~5 ломтиков и пампушка — отдельные блюда; всё съедено. Напиток у края не включён.',
    inputs: [{ photo: 'food8.jpg' }],
  },
  {
    id: 'p9',
    title: 'a small borscht, pampushka, sour cream',
    expect: 'Борщ (с мясом или без — альтернатива), пампушка, сметана. Игрушка и фон не при чём.',
    inputs: [{ photo: 'food9.jpg' }],
  },

  // Texts -------------------------------------------------------------------------------------
  {
    id: 't1',
    title: 'latte on oat milk and an almond croissant',
    expect:
      'Латте на овсяном — молоко известно, альтернативы только размера; миндальный круассан — без альтернатив.',
    inputs: [{ text: 'латте на овсяном и миндальный круассан' }],
  },
  {
    id: 't2',
    title: 'three al pastor tacos, one with a double tortilla, and a 0.5 cola',
    expect: 'Тако аль пастор 3 (тортильи: 4 всего); кола 500 мл, без альтернатив.',
    inputs: [{ text: 'три тако аль пастор, одно с двойной тортильей, и кола 0.5' }],
  },
  {
    id: 't3',
    title: 'buckwheat with a cutlet weighed 350 g, tea with sugar ×2',
    expect:
      'Гречка с котлетой — один продукт 350 г, альтернативы пропорции; чай 2 стакана, сахар — альтернативы количества.',
    inputs: [{ text: 'гречка с котлетой, взвесил 350 г, и чай с сахаром, два стакана' }],
  },
  {
    id: 't4',
    title: 'business lunch',
    expect: 'Типичный бизнес-ланч, без придуманных альтернатив вида.',
    inputs: [{ text: 'бизнес-ланч' }],
  },
  {
    id: 't5',
    title: 'an omelette described part by part',
    expect:
      'Омлет: яйца 3 шт. (не граммы), 50 мл молока, сливочное масло; хлеб 1 кусок. Количества уверенные, без альтернатив.',
    inputs: [{ text: 'омлет из 3 яиц с 50 мл молока на сливочном масле, кусок хлеба' }],
  },
  {
    id: 't6',
    title: 'pelmeni with sour cream',
    expect: 'Пельмени (вид? число — альтернативы), сметана.',
    inputs: [{ text: 'пельмени со сметаной' }],
  },
  {
    id: 't6t',
    title: 'pelmeni with sour cream, then "20 of them, no sour cream"',
    expect: 'Пельмени 20 шт., без альтернатив числа; сметаны нет.',
    inputs: [{ text: 'пельмени со сметаной' }, { text: 'съел 20 штук, сметану не ел' }],
  },
  {
    id: 't7',
    title: 'tonkotsu ramen',
    expect:
      'Рамен целиком, как подан (всё съедено и выпито); альтернативы разве что размера порции.',
    inputs: [{ text: 'рамен тонкоцу' }],
  },
  {
    id: 't8',
    title: 'latte and a croissant, then "the croissant was almond"',
    expect: 'Латте с альтернативами размера; круассан миндальный, без альтернатив вида.',
    inputs: [{ text: 'латте и круассан' }, { text: 'круассан был миндальный' }],
  },
];
