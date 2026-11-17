/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Served from https://zheka.github.io/kcal/
  base: '/kcal/',
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
