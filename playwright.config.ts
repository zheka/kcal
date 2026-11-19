import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests: the built app in Chromium at the size of the target phone, a Pixel 8a.
 * They check what unit tests in jsdom can't: layout. No screenshot comparisons.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4280/kcal/',
    // Pixel 8a: 412 × 915 CSS px at 2.625×.
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    // The service worker would cache the app between tests.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'pixel-8a-light', use: { colorScheme: 'light' } },
    { name: 'pixel-8a-dark', use: { colorScheme: 'dark' } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4280/kcal/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
