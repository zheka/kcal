import { expect, test } from './fixtures';

/** The lab at /kcal/lab/: apart from the app, and clearing only its own data. */

test('the app’s service worker caches nothing of the lab', async ({ page }) => {
  const sw = await (await page.request.get('sw.js')).text();
  expect(sw).toContain('"index.html"');
  expect(sw).not.toMatch(/url:"lab\//);
});

// Playwright's navigations bypass the service worker (offline even the precached index.html
// fails), so the fallback's denylist is checked where it's built, in sw.js.
test('the app’s service worker leaves navigations to /kcal/lab/ to the network', async ({
  page,
}) => {
  const sw = await (await page.request.get('sw.js')).text();
  const route = /NavigationRoute\(.*?\{denylist:\[\/(.+?)\/\]\}\)/.exec(sw);
  expect(route, 'no navigation route with a denylist in sw.js').not.toBeNull();
  const denied = new RegExp(route![1]!);
  for (const path of ['/kcal/lab/', '/kcal/lab/index.html', '/kcal/lab/?x=1']) {
    expect(denied.test(path), path).toBe(true);
  }
  for (const path of ['/kcal/', '/kcal/index.html', '/kcal/labrador/', '/kcal/x/lab/']) {
    expect(denied.test(path), path).toBe(false);
  }
});

// Through the experiment running now (the composer), which holds its own database open.
test('the lab clears its own data and the prototype’s, and leaves everything else', async ({
  page,
}) => {
  // Another project's data on the shared origin, the app's, the prototype's leftovers, and another experiment's.
  await page.goto('lab/');
  await page.evaluate(async () => {
    localStorage.setItem('kcal', '{"real":"data"}');
    localStorage.setItem('other-project', 'x');
    localStorage.setItem('kcal-proto-gemini-key', 'k');
    localStorage.setItem('kcal-composer-options', '{}');
    for (const name of ['kcal-composer', 'kcal-lab-other', 'kcal-other', 'other-project']) {
      await new Promise((resolve) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => (request.result.close(), resolve(null));
      });
    }
  });
  await page.reload();
  await page.getByRole('button', { name: 'Menu' }).click();
  // the app's key, set from the lab: the app's, so clearing the lab keeps it
  await page.getByRole('textbox', { name: 'Key', exact: true }).fill('secret-key');
  await page.getByRole('button', { name: 'Save key', exact: true }).click();
  await expect(page.getByText('Saved on this device (…-key)')).toBeVisible();

  // a second tap confirms
  await page.getByRole('button', { name: 'Clear data' }).click();
  await page.getByRole('button', { name: 'Tap again to clear everything' }).click();
  await expect(page.getByRole('heading', { name: 'Lab data cleared' })).toBeVisible();
  const left = await page.evaluate(async () => ({
    keys: Object.keys(localStorage).sort(),
    kcal: localStorage.getItem('kcal'),
    databases: (await indexedDB.databases()).map((d) => d.name).sort(),
  }));
  expect(left).toEqual({
    keys: ['kcal', 'other-project'],
    kcal: '{"real":"data"}',
    databases: ['kcal', 'kcal-other', 'other-project'],
  });
});
