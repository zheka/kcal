/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import { APP_NAME } from './src/config.ts';
import { VitePWA } from 'vite-plugin-pwa';

/** What the app's build and the lab's (vite.lab.config.ts) have in common. */
export const shared = {
  // Served from https://zheka.github.io/kcal/
  base: '/kcal/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  // Preact's JSX, compiled by Vite itself (no Babel).
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
} satisfies UserConfig;

export default defineConfig({
  ...shared,
  // Fixed ports of their own, away from Vite's defaults (5173, 4173) that other local projects
  // use; strictPort fails loudly instead of silently moving to another port.
  server: { port: 5280, strictPort: true },
  preview: { port: 4280, strictPort: true },
  plugins: [
    appName(),
    VitePWA({
      // A new version waits and takes over on the next launch; the app never reloads itself.
      registerType: 'prompt',
      injectRegister: false,
      // Icons are generated from public/icon.svg at build time (see pwa-assets.config.ts).
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        // A stable identity for the installed app, whatever its start URL becomes.
        id: '/kcal/',
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Compose meals against daily nutrition goals',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#121514',
        background_color: '#121514',
      },
      workbox: {
        // Of the font's character sets only Latin is cached for offline use; others (Cyrillic,
        // Greek…) still load on demand when online.
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,webmanifest}',
          '**/roboto-latin-wght-normal-*.woff2',
        ],
        // The lab (/kcal/lab/, built on its own by vite.lab.config.ts) isn't part of the app:
        // opening it must load the lab from the network, not this app from the cache.
        navigateFallbackDenylist: [/^\/kcal\/lab\//],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // A fixed time zone with daylight saving, so tests of local times are the same everywhere.
    env: { TZ: 'Europe/Berlin' },
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

/** Fills in the app's name (from src/config.ts) where index.html says %APP_NAME%. */
function appName(): Plugin {
  return {
    name: 'kcal-app-name',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
  };
}

/**
 * The app's version, shown in the menu: the commit it was built from (CI sets GITHUB_SHA) and
 * the build date. The data format has a version of its own (SCHEMA_VERSION in backup.ts).
 */
function appVersion(): string {
  return `${commit()} · ${new Date().toISOString().slice(0, 10)}`;
}

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}
