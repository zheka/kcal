import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  defaultAssetName,
  defineConfig,
  minimal2023Preset as preset,
} from '@vite-pwa/assets-generator/config';

const source = 'public/icon.svg';

// Android rebuilds an installed app's icon only when the manifest changes, and a redrawn icon.svg
// under the same PNG names leaves the manifest as it was. So every generated name ends in a hash
// of icon.svg: a new drawing gives new URLs, and the installed app picks it up.
const hash = createHash('sha256').update(readFileSync(source)).digest('hex').slice(0, 8);

// The icon is a full-bleed square: the OS applies its own rounded mask, and the hedgehog and
// croissant stay inside the maskable safe zone (a circle of radius 205 of 512), so no padding
// is added to any icon.
export default defineConfig({
  preset: {
    ...preset,
    transparent: { ...preset.transparent, padding: 0 },
    maskable: { ...preset.maskable, padding: 0 },
    apple: { ...preset.apple, padding: 0 },
    assetName: (type, size) => defaultAssetName(type, size).replace(/\.png$/, `-${hash}.png`),
  },
  images: [source],
});
