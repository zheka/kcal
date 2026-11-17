# Kcal

A personal nutrition tracker: compose each meal from products and recipes while a chart shows
how it moves the day towards its goals (kcal, protein, …), then save it. Offline-first PWA;
all data stays on the device (`localStorage`).

Live: https://zheka.github.io/kcal/

See [docs/design.md](docs/design.md) for the design and decisions.

## Development

Requires Node 26 (see `.nvmrc`).

```bash
npm install
npm run dev        # dev server at http://localhost:5173/kcal/
npm test           # unit and UI tests (Vitest, jsdom)
npm run lint       # ESLint
npm run format     # Prettier
npm run typecheck  # TypeScript
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally (the way to try offline mode and updates)
```

## Layout

```
src/
  config.ts       what the app tracks: nutrients, required nutrients, built-in units
  core/           pure logic: no DOM, storage or Preact
    types.ts        the stored data: products, recipes, meals, goals
    nutrition.ts    the food table (everything derived live), meal and day totals
    units.ts        units of a food, grams conversion, label conversion
    goals.ts        goals valid on a date, saving goals
    meals.ts        default meal time, macro split
    validate.ts     integrity checks for saved data and imports
    foods.ts        usages, ids
    text.ts         cleaning names
    time.ts         local dates and times
    format.ts       reading typed numbers, formatting amounts
  data/
    backup.ts       versioned document format, strict import, backup export
    storage.ts      saved data in localStorage, checked on load
  state/
    store.ts        app state (signals) and the only functions that change it
  ui/             Preact components: screens, forms, the ingredient editor
    router.ts       hash routes, back navigation
  pwa.ts          service worker registration
  **/*.test.ts(x) tests next to the code they test
```

## Stack

- **Preact** + **@preact/signals** for the UI, JSX compiled by Vite (no Babel).
- **Vite** builds a static site; **vite-plugin-pwa** (Workbox) generates the service worker,
  which precaches the whole app, so it works offline. App icons are generated from
  `public/icon.svg` at build time.
- **Vitest** with jsdom and Testing Library for tests.

Runtime libraries are bundled into the app and cached with it; nothing is loaded from a CDN.

## Dependencies

CI runs `npm audit --omit=dev`, which covers everything that ships. For the build tooling,
`overrides` in `package.json` force a patched `glob` (pulled in by `workbox-build`); drop it
once Workbox depends on a fixed version itself.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) checks formatting, lints, tests and builds
every PR, and deploys `dist/` to GitHub Pages on every push to `main`.
