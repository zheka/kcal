import { expect, expectNoHorizontalScroll, expectOnScreen, test } from './fixtures';

/** The sample's quick buttons, by their accessible names: 💧 water, then 🍽️ an empty meal. */
const QUICK = ['💧: water · 250 ml', '🍽️: New meal'] as const;

test.describe('day screen', () => {
  test('fits the chart, all meals and the quick buttons on one screen', async ({
    seeded: page,
  }) => {
    await page.goto('#/');
    await expectNoHorizontalScroll(page);
    for (const name of ['Previous day', 'Next day', 'Menu']) {
      const button = page.getByRole('button', { name });
      await expectOnScreen(button);
      const box = (await button.boundingBox())!;
      expect(box.width, `${name} is too small to tap`).toBeGreaterThanOrEqual(48);
    }
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(5);
    const rows = page.locator('.meal-row');
    await expect(rows).toHaveCount(6);
    for (const row of await rows.all()) await expectOnScreen(row);
    for (const name of QUICK) {
      const button = page.getByRole('button', { name });
      await expectOnScreen(button);
      const box = (await button.boundingBox())!;
      expect(box.width, `${name} is too small to tap`).toBeGreaterThanOrEqual(48);
      expect(box.height, `${name} is too small to tap`).toBeGreaterThanOrEqual(48);
    }
  });

  test('stacks the quick buttons round in the bottom-right corner, in their order', async ({
    seeded: page,
  }) => {
    await page.goto('#/day/2020-01-01');
    const [water, eat] = await Promise.all(
      QUICK.map(async (name) => (await page.getByRole('button', { name }).boundingBox())!),
    );
    // the last one at the bottom, within thumb reach, on the right edge
    expect(915 - (eat!.y + eat!.height)).toBeLessThan(40);
    expect(412 - (eat!.x + eat!.width)).toBeLessThan(24);
    expect(water!.y + water!.height).toBeLessThan(eat!.y);
    expect(water!.x + water!.width).toBeCloseTo(eat!.x + eat!.width, 0);
    // round
    expect(eat!.width).toBeCloseTo(eat!.height, 0);
  });

  test('lets the last meal scroll clear of the quick buttons', async ({ seeded: page }) => {
    await page.goto('#/');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = (await page.locator('.meal-row').last().boundingBox())!;
    const top = (await page.getByRole('button', { name: QUICK[0] }).boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(top.y);
  });

  test('shows meal rows on one line each', async ({ seeded: page }) => {
    await page.goto('#/');
    for (const row of await page.locator('.meal-totals').all()) {
      const box = (await row.boundingBox())!;
      expect(box.height, `wraps: ${await row.textContent()}`).toBeLessThan(40);
    }
  });
});

test.describe('meal composer', () => {
  test('shows the chart, every ingredient with its amount and unit, and Save', async ({
    seeded: page,
  }) => {
    await page.goto('#/meal/m4');
    await expectNoHorizontalScroll(page);
    for (const food of ['chicken breast', 'basmati rice, cooked', 'olive oil']) {
      await expectOnScreen(page.getByLabel(`Amount of ${food}`));
      await expectOnScreen(page.getByLabel(`Unit of ${food}`));
      await expectOnScreen(page.getByRole('button', { name: `Remove ${food}` }));
    }
    await expectOnScreen(page.getByRole('button', { name: 'Save' }));
  });

  test('keeps Save on screen with many ingredients', async ({ seeded: page }) => {
    await page.goto('#/meal/new');
    for (const food of [
      'egg',
      'banana',
      'skyr natural',
      'honey',
      'oat flakes',
      'coffee',
      'water',
    ]) {
      await page.getByLabel('Find food').fill(food);
      await page.getByLabel('Foods').getByText(food, { exact: true }).click();
    }
    await expectNoHorizontalScroll(page);
    await expectOnScreen(page.getByRole('button', { name: 'Save' }));
  });

  test('logs a glass of water with the 💧 quick button', async ({ seeded: page }) => {
    await page.goto('#/');
    await page.getByRole('button', { name: QUICK[0] }).click();
    await expect(page.getByRole('heading', { name: 'New meal' })).toBeVisible();
    await expect(page.getByLabel('Amount of water')).toHaveValue('250');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.locator('.meal-row')).toHaveCount(7);
    // saved: still there after a reload
    await page.reload();
    await expect(page.locator('.meal-row')).toHaveCount(7);
  });
});

test.describe('forms', () => {
  test('recipe form: ingredients with amounts and units, units, totals', async ({
    seeded: page,
  }) => {
    await page.goto('#/recipe/oats');
    await expectNoHorizontalScroll(page);
    for (const food of ['oat flakes', 'milk 1.5%', 'honey']) {
      await expectOnScreen(page.getByLabel(`Amount of ${food}`));
      await expectOnScreen(page.getByLabel(`Unit of ${food}`));
    }
    await expect(page.getByLabel('Unit name')).toHaveValue('bowl');
    await expectOnScreen(page.getByRole('button', { name: 'Save' }));
  });

  test('product form: every nutrient and unit field fits', async ({ seeded: page }) => {
    await page.goto('#/product/coffee');
    await expectNoHorizontalScroll(page);
    for (const label of [
      'kcal',
      'Protein (g)',
      'Fat (g)',
      'Carbs (g)',
      'Water (ml)',
      'Per amount',
      'Per unit',
    ]) {
      await expectOnScreen(page.getByLabel(label, { exact: true }));
    }
    for (const label of ['per g', 'per ml']) {
      await expectOnScreen(page.getByRole('button', { name: label, exact: true }));
    }
    for (const unit of await page.getByLabel('Unit name').all()) await expect(unit).toBeVisible();
  });

  for (const [name, route] of [
    ['library', '#/library'],
    ['menu', '#/menu'],
    ['goals', '#/goals'],
    ['new product', '#/product/new'],
    ['new recipe', '#/recipe/new'],
  ] as const) {
    test(`${name} fits the screen`, async ({ seeded: page }) => {
      await page.goto(route);
      await expectNoHorizontalScroll(page);
      const close = page.getByRole('button', { name: 'Close', exact: true });
      await expectOnScreen(close);
      // the traditional place and a full tap target: the top-right corner, at least 48 × 48
      const box = (await close.boundingBox())!;
      expect(412 - (box.x + box.width)).toBeLessThan(16);
      expect(box.y).toBeLessThan(16);
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    });
  }
});

test('the close button returns to the screen it was opened from', async ({ seeded: page }) => {
  await page.goto('#/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
});
