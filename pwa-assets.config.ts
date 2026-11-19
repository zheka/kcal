import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// The icon is a full-bleed square: the OS applies its own rounded mask, and the hedgehog and
// croissant stay inside the maskable safe zone (a circle of radius 205 of 512), so no padding
// is added to any icon.
export default defineConfig({
  preset: {
    ...preset,
    transparent: { ...preset.transparent, padding: 0 },
    maskable: { ...preset.maskable, padding: 0 },
    apple: { ...preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
});
