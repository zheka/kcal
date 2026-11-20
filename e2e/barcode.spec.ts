import { expect, expectNoHorizontalScroll, expectOnScreen, test } from './fixtures';

const CODE = '4006040002093';

// A fake camera stream from Chromium, and a stand-in for the built-in barcode reader (Chromium
// on Linux has none): it "reads" CODE after a few frames.
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

test('scans a barcode, looks it up and fills the new product', async ({ seeded: page }) => {
  await page.addInitScript((code) => {
    let frames = 0;
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      detect() {
        frames += 1;
        return Promise.resolve(frames > 3 ? [{ rawValue: code, format: 'ean_13' }] : []);
      }
    };
  }, CODE);
  let asked = '';
  await page.route('https://world.openfoodfacts.org/**', (route) => {
    asked = route.request().url();
    return route.fulfill({
      json: {
        status: 1,
        product: {
          product_name: 'Skyr Natur',
          brands: 'Arla',
          product_quantity_unit: 'g',
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

  await page.goto('#/product/new');
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan barcode' });
  await expect(scanner).toBeVisible();
  // full screen, with its close button on screen
  const box = (await scanner.boundingBox())!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, 412, 915]);
  await expectOnScreen(scanner.getByRole('button', { name: 'Close' }));

  await expect(page.getByText(/Filled from Open Food Facts, per 100 g/)).toBeVisible();
  await expect(scanner).toBeHidden();
  expect(asked).toContain(`/api/v2/product/${CODE}.json`);
  await expect(page.getByLabel(/^Name/)).toHaveValue('Skyr Natur (Arla)');
  await expect(page.getByLabel('kcal', { exact: true })).toHaveValue('63');
  await expectNoHorizontalScroll(page);
  await expectOnScreen(page.getByRole('button', { name: 'Save' }));

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(page.getByText('Skyr Natur (Arla)')).toBeVisible();
});

test('the scanner closes with ×, turning the camera off', async ({ seeded: page }) => {
  await page.addInitScript(() => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      detect() {
        return Promise.resolve([]);
      }
    };
    // keep every camera stream the app asks for, to check they're all turned off
    const streams: MediaStream[] = [];
    (window as unknown as { cameraStreams: MediaStream[] }).cameraStreams = streams;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      streams.push(stream);
      return stream;
    };
  });
  await page.goto('#/product/new');
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.querySelector('video')?.srcObject))
    .toBe(true);
  await page
    .getByRole('dialog', { name: 'Scan barcode' })
    .getByRole('button', { name: 'Close' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Scan barcode' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'New product' })).toBeVisible();
  // one stream, its track ended (allowing the browser a moment to report it)
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as unknown as { cameraStreams: MediaStream[] }).cameraStreams.map((s) =>
            s.getTracks().map((t) => t.readyState),
          ),
        ),
      { timeout: 3000 },
    )
    .toEqual([['ended']]);
});

test('closing while the camera is still starting turns it off too', async ({ seeded: page }) => {
  await page.addInitScript(() => {
    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
      detect() {
        return Promise.resolve([]);
      }
    };
    // a slow camera: the stream arrives half a second after it is asked for
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const stream = await getUserMedia(constraints);
      (window as unknown as { cameraStream: MediaStream }).cameraStream = stream;
      return stream;
    };
  });
  await page.goto('#/product/new');
  await page.getByRole('button', { name: 'Scan barcode' }).click();
  await page
    .getByRole('dialog', { name: 'Scan barcode' })
    .getByRole('button', { name: 'Close' })
    .click();
  // the stream arrives after closing, and is turned off as soon as it does
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { cameraStream?: MediaStream }).cameraStream
          ?.getTracks()
          .map((t) => t.readyState),
      ),
    )
    .toEqual(['ended']);
});
