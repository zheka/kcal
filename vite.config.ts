/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { APP_NAME } from './src/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Served from https://zheka.github.io/kcal/
  base: '/kcal/',
  // Fixed ports of their own, away from Vite's defaults (5173, 4173) that other local projects
  // use; strictPort fails loudly instead of silently moving to another port.
  server: { port: 5280, strictPort: true },
  preview: { port: 4280, strictPort: true },
  define: {
    __APP_VERSION__: JSON.stringify(
      (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version,
    ),
  },
  // Preact's JSX, compiled by Vite itself (no Babel).
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  plugins: [
    appName(),
    VitePWA({
      // A new version waits and takes over on the next launch; the app never reloads itself.
      registerType: 'prompt',
      injectRegister: false,
      // Icons are generated from public/icon.svg at build time (see pwa-assets.config.ts).
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Compose meals against daily nutrition goals',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1f7a4d',
        background_color: '#ffffff',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
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
