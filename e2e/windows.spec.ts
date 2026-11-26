import { expect, test, type Page } from '@playwright/test';

/**
 * The app open in two windows at once (the installed app and a browser tab, or an old tab the
 * browser keeps alive): each window saves on top of what the other saved.
 */

async function logWater(page: Page): Promise<void> {
  await page.getByRole('button', { name: '💧: water · 250 ml' }).click();
  await expect(page.getByRole('heading', { name: 'New meal' })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
}

test('two windows: a meal saved in each keeps both, and each shows the other’s', async ({
  context,
}) => {
  const a = await context.newPage();
  await a.goto('#/');
  const b = await context.newPage();
  await b.goto('#/');
  await expect(b.locator('.meal-row')).toHaveCount(0);

  await logWater(a);
  await expect(a.locator('.meal-row')).toHaveCount(1);
  // B shows A's meal without a reload
  await expect(b.locator('.meal-row')).toHaveCount(1);

  await logWater(b);
  await expect(b.locator('.meal-row')).toHaveCount(2);
  await expect(a.locator('.meal-row')).toHaveCount(2);

  for (const page of [a, b]) {
    await page.reload();
    await expect(page.locator('.meal-row')).toHaveCount(2);
  }
});
