import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Scanning in the lab's meal composer: a barcode is looked up on Open Food Facts, its data is
 * attached and sent to the model as it is; my foods play no part in it.
 */

const CODE = '4006040002093';

// A fake camera stream from Chromium, and a stand-in for the built-in barcode reader (Chromium
// on Linux has none): it "reads" CODE after a few frames.
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

/** The lab with a new meal open; Open Food Facts knows CODE or not; what was asked and sent. */
async function newMeal(page: Page, known: boolean) {
  await page.addInitScript((code) => {
    let frames = 0;
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      detect() {
        frames += 1;
        return Promise.resolve(frames > 3 ? [{ rawValue: code, format: 'ean_13' }] : []);
      }
    };
  }, CODE);
  const asked: string[] = [];
  await page.route('https://world.openfoodfacts.org/**', (route) => {
    asked.push(route.request().url());
    if (!known) return route.fulfill({ json: { status: 0 } });
    return route.fulfill({
      json: {
        status: 1,
        product: {
          lang: 'de',
          product_name: 'Skyr Natur',
          brands: 'Arla',
          product_quantity_unit: 'g',
          serving_quantity: '150',
          nutriments: {
            'energy-kcal_100g': 63,
            proteins_100g: 11,
            fat_100g: 0.2,
            carbohydrates_100g: 4,
          },
        },
      },
    });
  });
  const sent: { text?: string }[][] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (route.request().url().includes('/models?')) {
      await route.fulfill({
        json: {
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          ],
        },
      });
      return;
    }
    const body = route.request().postDataJSON() as { contents: { parts: { text?: string }[] }[] };
    sent.push(body.contents[0]!.parts);
    await route.fulfill({ status: 400, json: { error: { message: 'not needed here' } } });
  });

  await page.goto('lab/');
  // my skyr has the same barcode
  await page.evaluate((code) => {
    const doc = JSON.parse(localStorage.getItem('kcal')!) as { products: { id: string }[] };
    Object.assign(
      doc.products.find((p) => p.id === 'skyr')!,
      { barcode: code },
    );
    localStorage.setItem('kcal', JSON.stringify(doc));
  }, CODE);
  await page.reload();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('textbox', { name: 'Key', exact: true }).fill('test-key');
  await page.getByRole('button', { name: 'Save key', exact: true }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'New meal' }).click();

  return { asked, sent };
}

async function scan(page: Page) {
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  // the fake camera usually reads in about 2 s, but at times starts slowly
  await expect(page.getByRole('dialog', { name: 'Scan barcode' })).toBeHidden({ timeout: 15_000 });
}

test('a scanned barcode is Open Food Facts’ data, attached and sent as it is', async ({
  seeded: page,
}) => {
  const { asked, sent } = await newMeal(page, true);
  await scan(page);
  const attached = page.getByRole('region', { name: 'Attached' }).locator('.attached');
  await expect(attached).toHaveText([`Skyr Natur (Arla) ${CODE}`]);
  expect(asked).toHaveLength(1);
  expect(asked[0]).toContain(`https://world.openfoodfacts.org/api/v2/product/${CODE}.json`);
  // the name in the answer language (ru by default) is asked for too
  expect(asked[0]).toContain('product_name_ru');

  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByText('Couldn’t update')).toBeVisible();
  // Open Food Facts' data only, though my skyr has the same barcode
  expect(JSON.parse(sent[0]![1]!.text!)).toEqual({
    code: CODE,
    language: 'de',
    names: { de: 'Skyr Natur' },
    brands: ['Arla'],
    categories: [],
    serving: 150,
    liquid: false,
    per100: { kcal: 63, protein: 11, fat: 0.2, carbs: 4 },
  });
});

test('a barcode Open Food Facts doesn’t have is not attached, and says so', async ({
  seeded: page,
}) => {
  const { asked } = await newMeal(page, false);
  const popup = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  const dialog = await popup;
  expect(dialog.message()).toBe(`${CODE}: not in Open Food Facts. Describe it in text instead.`);
  await dialog.dismiss();
  await expect(page.getByRole('dialog', { name: 'Scan barcode' })).toBeHidden();
  expect(asked).toHaveLength(1);
  await expect(page.getByRole('region', { name: 'Attached' })).toHaveCount(0);
});

test('the photo camera reads no barcodes: it stays open with one in sight', async ({
  seeded: page,
}) => {
  const { asked } = await newMeal(page, true);
  await page.getByRole('button', { name: 'Camera' }).click();
  const camera = page.getByRole('dialog', { name: 'Camera' });
  await expect(camera).toBeVisible();
  // the stand-in reader would have read CODE after a few frames by now
  await page.waitForTimeout(1500);
  await expect(camera).toBeVisible();
  expect(asked).toHaveLength(0);
  await page.getByRole('button', { name: 'Close camera' }).click();
  await expect(camera).toBeHidden();
});
