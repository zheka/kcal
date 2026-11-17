import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// The icon is a full-bleed square: the OS applies its own rounded mask, and the plate stays
// inside the maskable safe zone, so no padding is added.
export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0 },
    apple: { ...preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
});
