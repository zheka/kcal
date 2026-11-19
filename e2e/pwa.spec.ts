import { expect, test } from './fixtures';

// This file runs the real service worker (the layout tests block it).
test.use({ serviceWorkers: 'allow' });

test('installs a service worker, works offline, and checks for updates', async ({
  seeded: page,
  context,
}) => {
  await page.goto('#/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  // the service worker installs and takes control after a reload
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // offline: the app still starts, from the cache (Playwright's reload bypasses the service
  // worker, so open the app again instead, as a phone does)
  await context.setOffline(true);
  await page.goto('#/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  const version = page.getByRole('button', { name: /^App version/ });
  await expect(version).toContainText('Tap to check for updates');
  await version.click();
  await expect(version).toContainText('Offline: connect to check for updates');

  // online again: the same version is up to date
  await context.setOffline(false);
  await version.click();
  await expect(version).toContainText('Up to date. Tap to check again');
});

test('the manifest makes the app installable', async ({ page }) => {
  const response = await page.request.get('manifest.webmanifest');
  const manifest = (await response.json()) as Record<string, unknown>;
  expect(manifest).toMatchObject({
    id: '/kcal/',
    name: 'kcal',
    short_name: 'kcal',
    start_url: '/kcal/',
    display: 'standalone',
  });
  const icons = manifest.icons as { sizes: string; purpose?: string }[];
  expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
});
