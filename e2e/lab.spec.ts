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

test('the lab clears its own data and the prototype’s, and leaves everything else', async ({
  page,
}) => {
  // Another project's data and the app's, the prototype's leftovers, and two experiments'.
  await page.goto('lab/');
  await page.evaluate(async () => {
    localStorage.setItem('kcal', '{"real":"data"}');
    localStorage.setItem('clog', 'x');
    localStorage.setItem('kcal-proto-gemini-key', 'k');
    localStorage.setItem('kcal-composer-options', '{}');
    for (const name of ['kcal-composer', 'kcal-lab-one', 'kcal-lab-two', 'kcal-other', 'clog']) {
      await new Promise((resolve) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => (request.result.close(), resolve(null));
      });
    }
  });
  await page.reload();
  await expect(page.getByText('Lab data in this browser:')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveText([
    'kcal-composer',
    'kcal-lab-one',
    'kcal-lab-two',
    'kcal-composer-options',
    'kcal-proto-gemini-key',
  ]);
  // a second tap confirms
  const clear = page.getByRole('button', { name: 'Clear all lab data' });
  await clear.click();
  await expect(page.getByRole('listitem')).toHaveCount(5);
  await page.getByRole('button', { name: 'Tap again to clear' }).click();
  await expect(page.getByText('No lab data in this browser.')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear all lab data' })).toBeHidden();
  const left = await page.evaluate(async () => ({
    keys: Object.keys(localStorage).sort(),
    kcal: localStorage.getItem('kcal'),
    databases: (await indexedDB.databases()).map((d) => d.name).sort(),
  }));
  expect(left).toEqual({
    keys: ['clog', 'kcal'],
    kcal: '{"real":"data"}',
    databases: ['clog', 'kcal-other'],
  });
});
