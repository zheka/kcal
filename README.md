# kcal

A personal nutrition tracker: compose each meal from products and recipes while a chart shows
how it moves the day towards its goals (kcal, protein, …), then save it. Offline-first PWA;
all data stays on the device (`localStorage`).

Live: https://zheka.github.io/kcal/

See [docs/design.md](docs/design.md) for the design and decisions.

## Development

Requires Node 26 (see `.nvmrc`).

```bash
npm install
npm run dev        # dev server at http://localhost:5280/kcal/, in a Pixel 8a frame (?full: full width)
npm test           # unit and UI tests (Vitest, jsdom)
npm run e2e        # layout tests in Chromium at Pixel 8a size (Playwright; builds and serves the app)
npm run lint       # ESLint
npm run format     # Prettier
npm run typecheck  # TypeScript
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ at http://localhost:4280/kcal/ (offline mode, updates)
```

## Layout

```
src/
  config.ts       what the app tracks: nutrients, g and ml
  core/           pure logic: no DOM, storage or Preact
    types.ts        the stored data (docs/backup-format.md): products, recipes, meals, goals
    builtins.ts     built-in foods: water, protein, fat, carbs
    nutrition.ts    the in-memory food table (derived, exact quantities), meal and day totals
    canonical.ts    canonical order and JSON: the same data always gives the same file
    validate.ts     integrity checks for saved data and imports
    decimal.ts      rounding stored numbers to 3 decimals, exact thousandths
    goals.ts        goals that apply to a day, saving goals
    meals.ts        meal times (UTC, minute edits), macro split
    foods.ts        picking foods, chip order, usages, ids
    units.ts        product units, converting label values to per gram
    text.ts         cleaning names
    time.ts         UTC timestamps and local dates and minutes
    format.ts       reading typed numbers, formatting amounts
  data/
    backup.ts       versioned document, strict import, backup export
    storage.ts      saved data in localStorage, checked on load
  state/
    store.ts        app state (signals): stored data and derived tables; the only changes
  ui/             Preact components: screens, forms, the ingredient editor
    router.ts       hash routes, back navigation
  pwa.ts          service worker registration
  **/*.test.ts(x) tests next to the code they test (run in Europe/Berlin time)
```

On a desktop browser, `npm run dev` shows the app inside a frame the size of the target phone,
a Pixel 8a (412 × 915 CSS px): an iframe, so media queries, `dvh` and sticky bars behave as on
the phone. The frame scales down to fit short windows without changing the app's layout, and
the address bar follows the screen shown in it. Add `?full` to the address (or use the
"Full width" link under the frame) for full width; a "Phone frame" link in the corner leads back.
The frame is development-only (`src/dev/phoneFrame.ts`) and not part of the production build.

## Stack

- **Preact** + **@preact/signals** for the UI, JSX compiled by Vite (no Babel).
- **Vite** builds a static site; **vite-plugin-pwa** (Workbox) generates the service worker,
  which precaches the whole app, so it works offline. App icons (favicon, 64/192/512 px,
  maskable 512 px, Apple touch 180 px) are generated from `public/icon.svg` at build time.
  The icon itself, a hedgehog hugged by a croissant, is drawn by `scripts/make-icon.py`
  (`python3 scripts/make-icon.py public/icon.svg`); its content stays inside the maskable safe
  zone.
- **Vitest** with jsdom and Testing Library for unit and UI tests.
- **Playwright** (Chromium) for end-to-end tests of the built app at Pixel 8a size, light and
  dark, one test at a time: layout checks jsdom can't do (nothing wider than the screen, headers, buttons and
  form fields on screen), plus a few flows. No screenshot comparisons. The first run needs a
  browser: `npx playwright install chromium`. CI runs them in Playwright's Docker image, whose
  tag must match the exactly pinned `@playwright/test` version.

Runtime libraries are bundled into the app and cached with it; nothing is loaded from a CDN.
The app's font is Roboto (`@fontsource-variable/roboto`, SIL Open Font License), the Pixel's
own font, shipped with the app so text has the same width on the phone, in `npm run dev` and in
the layout tests; only its Latin file (43 KB) is cached for offline use.

## Open Food Facts

Scanning a barcode in a new product looks it up on [Open Food Facts](https://world.openfoodfacts.org),
the free open food database, to fill in the name and the macros. Only the barcode is sent;
nothing else leaves the device. Scanning uses the browser's built-in barcode reader (Chrome on
Android), so the button only appears where the browser has one.

## Installing on a phone

kcal is a PWA: open https://zheka.github.io/kcal/ in Chrome and choose **⋮ → Add to Home screen
→ Install**. It then opens full-screen and works offline; the data stays on the device. A new
version downloads in the background and takes over on the next launch, or right away from the
menu: **App version** shows the version and build, and a tap checks for an update or installs
one that is ready.

## Dependencies

CI runs `npm audit --omit=dev`, which covers everything that ships. For the build tooling,
`overrides` in `package.json` force a patched `glob` (pulled in by `workbox-build`); drop it
once Workbox depends on a fixed version itself.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) checks formatting, lints, tests, builds and
runs the end-to-end tests on every PR, and deploys `dist/` to GitHub Pages on every push to
`main` once both pass.
