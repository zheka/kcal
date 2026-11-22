import { defineConfig } from 'vite';
import { shared } from './vite.config.ts';

/**
 * The lab: AI experiments at https://zheka.github.io/kcal/lab/ (see README, Lab). Built on
 * its own, after the app (`npm run build` runs both), into dist/lab/, so nothing of it reaches
 * the app's bundle or its service worker's precache. No service worker and no PWA of its own.
 * In development, `npm run dev` serves it too, at /kcal/lab/.
 */
export default defineConfig({
  ...shared,
  // The app's public files (icons) are already in dist/.
  publicDir: false,
  build: {
    outDir: 'dist',
    // dist/ holds the app, built just before.
    emptyOutDir: false,
    assetsDir: 'lab/assets',
    rollupOptions: { input: 'lab/index.html' },
  },
});
