import { expect, test as base, type Locator, type Page } from '@playwright/test';

/**
 * A realistic day for layout tests: goals, eleven products (food per g, drinks per ml, water
 * both), a recipe, six meals and drinks today, and the two default quick buttons, in the
 * stored format of docs/backup-format.md.
 */
export function sampleDocument(now: Date): object {
  const at = (h: number, m: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 7, 123).toISOString();
  const p = (id: string, name: string, perG: object, units?: object[]) => ({
    id,
    name,
    perG,
    ...(units && { units }),
  });
  const drink = (id: string, name: string, perMl: object, units?: object[]) => ({
    id,
    name,
    perMl,
    ...(units && { units }),
  });
  const ing = (food: string, amount: number, unit = 'g') => ({ amount, food, unit });
  return {
    goals: [
      { perDay: { kcal: 2000, protein: 150, water: 2000 }, setAt: '2026-11-01T18:20:05.114Z' },
    ],
    meals: [
      { consumedAt: at(7, 40), id: 'm1', ingredients: [ing('oats', 1, 'u-bowl')] },
      { consumedAt: at(8, 10), id: 'm2', ingredients: [ing('coffee', 1, 'u-mug')] },
      {
        consumedAt: at(10, 30),
        id: 'm3',
        ingredients: [ing('banana', 1, 'u-banana'), ing('water', 330, 'ml')],
      },
      {
        consumedAt: at(13, 0),
        id: 'm4',
        ingredients: [ing('chicken', 180), ing('rice', 250), ing('oil', 1, 'u-tbsp')],
      },
      { consumedAt: at(15, 5), id: 'm5', ingredients: [ing('water', 500, 'ml')] },
      { consumedAt: at(16, 20), id: 'm6', ingredients: [ing('skyr', 200)] },
    ],
    products: [
      p('banana', 'banana', { carbs: 0.23, fat: 0.003, kcal: 0.89, protein: 0.011 }, [
        { g: 120, id: 'u-banana', name: 'piece' },
      ]),
      p('chicken', 'chicken breast', { fat: 0.015, kcal: 1.1, protein: 0.23 }),
      drink('coffee', 'coffee', { kcal: 0.02, protein: 0.001, water: 0.99 }, [
        { id: 'u-mug', ml: 300, name: 'mug' },
      ]),
      p('egg', 'egg', { carbs: 0.007, fat: 0.095, kcal: 1.43, protein: 0.126 }, [
        { g: 60, id: 'u-egg', name: 'piece' },
      ]),
      p('flakes', 'oat flakes', { carbs: 0.59, fat: 0.07, kcal: 3.7, protein: 0.13 }),
      p('honey', 'honey', { carbs: 0.82, kcal: 3.04 }, [{ g: 7, id: 'u-tsp', name: 'tsp' }]),
      drink(
        'milk',
        'milk 1.5%',
        { carbs: 0.049, fat: 0.015, kcal: 0.47, protein: 0.034, water: 0.88 },
        [{ id: 'u-cup', ml: 250, name: 'cup' }],
      ),
      p('oil', 'olive oil', { fat: 1, kcal: 8.84 }, [{ g: 13, id: 'u-tbsp', name: 'tbsp' }]),
      p('rice', 'basmati rice, cooked', { carbs: 0.28, fat: 0.003, kcal: 1.3, protein: 0.027 }),
      p('skyr', 'skyr natural', { carbs: 0.04, fat: 0.002, kcal: 0.63, protein: 0.11 }),
      { id: 'water', name: 'water', perG: { water: 1 }, perMl: { water: 1 } },
    ],
    recipes: [
      {
        id: 'oats',
        ingredients: [ing('flakes', 60), ing('milk', 1, 'u-cup'), ing('honey', 1, 'u-tsp')],
        name: 'oats with honey',
        units: [{ id: 'u-bowl', makes: 1, name: 'bowl' }],
      },
    ],
    settings: {
      quickButtons: [{ amount: 250, food: 'water', label: '💧', unit: 'ml' }, { label: '🍽️' }],
    },
    version: 'kcal 0.2.0',
  };
}

/** A page whose app starts with the sample day saved (only on the first load of a test). */
export const test = base.extend<{ seeded: Page }>({
  seeded: async ({ page }, use) => {
    await page.addInitScript((doc) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('kcal', JSON.stringify(doc));
        sessionStorage.setItem('seeded', '1');
      }
    }, sampleDocument(new Date()));
    await use(page);
  },
});

export { expect };

/** The page doesn't scroll sideways: nothing is wider than the screen. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'page is wider than the screen').toBeLessThanOrEqual(clientWidth);
}

/** The element is visible and lies entirely inside the screen, without scrolling. */
export async function expectOnScreen(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const size = locator.page().viewportSize()!;
  expect(box, 'element has no box').not.toBeNull();
  expect(box!.x, 'starts left of the screen').toBeGreaterThanOrEqual(0);
  expect(box!.y, 'starts above the screen').toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, 'ends right of the screen').toBeLessThanOrEqual(size.width + 0.5);
  expect(box!.y + box!.height, 'ends below the screen').toBeLessThanOrEqual(size.height + 0.5);
}
