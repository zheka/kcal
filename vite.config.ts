/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
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
    VitePWA({
      // A new version waits and takes over on the next launch; the app never reloads itself.
      registerType: 'prompt',
      injectRegister: false,
      // Icons are generated from public/icon.svg at build time (see pwa-assets.config.ts).
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Kcal',
        short_name: 'Kcal',
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
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
