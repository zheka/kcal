# Receiving shares from other apps

The plan for making the installed app a target in Android's share sheet: a photo from Photos,
text or a link from Chrome, a file from Files.

Status (2026-11-27): **agreed, nothing built.** The first step is a debugging build: a share
only shows "Got N bytes from sharing". Importing products and meals from shared JSON comes next.

## How receiving a share works

1. **Share sheet.** The installed app is a WebAPK, an Android app Chrome builds from our
   manifest. Its `share_target` entry becomes an intent filter, so the app is listed when another
   app shares. Android shows the target only after Chrome rebuilds the WebAPK with that entry
   (on its own schedule, up to about a day; reinstalling the app forces it).
2. **The POST.** Picking the app makes Chrome **navigate** the app's window to
   `/kcal/share` with a `multipart/form-data` body: `title`, `text` and `url` as fields, files
   as file parts. An open app window navigates away from where it was: the page unloads.
3. **The service worker answers it.** A navigation to a URL in the worker's scope (`/kcal/`) goes
   to that worker's `fetch` event before the network, even with no app page open. Our route for
   `POST /kcal/share` reads the form, stores it in the inbox (below), and only after the write
   has finished answers `303 See Other` to `/kcal/#/`.
4. **The app starts as usual.** The 303 turns the POST into a plain GET, so the address and the
   history are those of a normal launch: a reload doesn't send the share again, Back doesn't
   land on it. `share.ts` takes the inbox and shows what came.

**No shared data in URLs.** The redirect carries nothing, not even an id: the app finds a share
by looking in the inbox on every start.

**`/kcal/share` exists only in the service worker.** It is not a deployed file: on github.io a
GET gives 404, a POST 405. Shared data never leaves the phone.

**When the POST reaches GitHub.** With no active worker that has the share route, the request
falls through to the network: the window shows GitHub's bare "405 Not Allowed" page and the share
is lost (offline: Chrome's offline page). Nothing on either side can recover it; reopening the
app and sharing again works once the worker has the route. It happens when:

- there is no worker (site data cleared; the app installed and the worker not active yet);
- the active worker is an **old one without the route**. A new worker waits for the next launch
  (`registerType: 'prompt'`), but Chrome may rebuild the WebAPK from the manifest on the server
  meanwhile, so the share sheet can offer the app before the worker can answer.

**The rule:** a change to `share_target` that needs new worker code ships the worker code first
and changes the manifest in a later version.

## The inbox

A database of its own, `kcal-share`, with one store, `inbox`: a record per share.

- **Its own database, not a store in `kcal`** ([src/data/db.ts](../src/data/db.ts)): the worker
  and the app update on different schedules, and a shared database would tie the worker to the
  app's schema versions (an old worker opening a database the app has upgraded, or the other way
  round).
- **The name** fits the shared origin (zheka.github.io's `SHARED-ORIGIN.md`) and must not start
  with `kcal-lab-`: the lab's "Clear all lab data" deletes every database with that prefix.
- **IndexedDB**, not localStorage (a worker can't use it) or the Cache API: it stores Blobs
  directly, so the same inbox carries photos and files later. `idb` is already a dependency.
- **Taking** is reading and deleting the records in one transaction: with two windows open,
  only one gets a share. Records older than a day are dropped when taken.
- The cost: one IndexedDB read per start, after the app has rendered.

## The debugging build

1. **`vite.config.ts`**
   - the manifest gets `share_target`: `action: '/kcal/share'`, `method: 'POST'`,
     `enctype: 'multipart/form-data'`, params `title`, `text`, `url` and `files` accepting `*/*`
     (anything, to try sharing all kinds of things, the JSON for the next step included);
   - vite-plugin-pwa switches to `strategies: 'injectManifest'` (`srcDir: 'src'`,
     `filename: 'sw.ts'`); `globPatterns` move under `injectManifest`; the `workbox` block goes,
     its work moves into `src/sw.ts`.
2. **`src/sw.ts`**, our own worker:
   - `precacheAndRoute(self.__WB_MANIFEST)` and `cleanupOutdatedCaches()`;
   - a `NavigationRoute` to `index.html`, still denying `/kcal/lab/`;
   - the `SKIP_WAITING` message listener: the generated worker had it, and without it the menu's
     "install the update now" silently stops working;
   - `registerRoute('/kcal/share', handler, 'POST')`: sums the files' sizes and the UTF-8 bytes
     of `title`, `text` and `url`, puts `{ at, bytes }` into the inbox, answers 303 to `/kcal/#/`;
   - new devDependencies `workbox-precaching` and `workbox-routing`, of the same 7.4 line as
     `workbox-build`.
3. **`tsconfig.sw.json`** for `src/sw.ts` alone (`lib: ["ES2023", "WebWorker"]`), excluded from
   `tsconfig.json`; `typecheck` runs it too. The `DOM` and `WebWorker` libs declare the same
   globals with different types (`self` is `Window` in one, `WorkerGlobalScope` in the other;
   `onmessage`, `postMessage`, `location`…): together they either fail or, with `skipLibCheck`,
   leave `self` a `Window`. `/// <reference lib="webworker" />` in `sw.ts` would instead apply to
   the whole program, letting the app's code use worker globals unnoticed.
4. **`src/share.ts`**, all of the share's app code: called from `main.tsx` after `start()`, it
   takes the inbox and, if there was a share, shows a popup over the app ("Got N bytes from
   sharing", OK), an element of its own on `document.body`. `App` and its screens don't change.
   A little style in `style.css`.
5. **Tests**
   - unit: taking the inbox (one take gets it, the next nothing; old records dropped);
   - e2e, in `pwa.spec.ts` with the real worker: once it controls the page, submit a
     `<form method=post enctype=multipart/form-data action=share>` with a known file and text
     (a navigation POST, as Android makes); expect the popup with the right count at `/kcal/#/`,
     and no popup after a reload;
   - the existing pwa test (offline start, update check) still passes: it is what shows the
     switch to `injectManifest` broke nothing.
6. **On the Pixel 8a:** reinstall the app (the WebAPK rebuild), share a photo from Photos and
   text from Chrome, check the counts, screenshot at 412×915.

## Later: what was shared decides the form

The worker stays dumb: it stores `{ at, title, text, url, files: Blob[] }` and redirects; it
can't reach the app's code, and it is the slowest part to update. `share.ts` classifies a
share (plain code, tested in jsdom) and routes it:

| Shared                           | Recognized by                | Goes to                                                                                                        |
| -------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Kcal JSON with products or meals | parses, passes `validate.ts` | the import (the next step): a product form for one product, the meal composer for one meal, a list for several |
| an Open Food Facts link          | the URL's pattern, a barcode | the product form with that barcode (`ProductRequest.barcode`: looked up, as after a scan)                      |
| a photo                          | `image/*`                    | the AI screen ([dishes-and-ai.md](dishes-and-ai.md)): a meal by default, a product for a label                 |
| other text or a link             | the rest                     | the AI screen as text; until then the popup says it can't be used                                              |

**Prefilling uses what the forms have** ([src/ui/drafts.ts](../src/ui/drafts.ts)):

- the product form: `requestProduct({ data, product })` with the parsed product, then the new
  product's route; it opens on that product, unsaved;
- the meal composer: a `PendingDraft` (rows, pending products for foods not in the library) kept
  with `keepDraft` under the new meal's key, then its route; the composer reopens it as if left
  and come back.

Either way a share lands as an **unsaved form**: nothing is stored until Save. The inbox record
is deleted once a form is opened from it.

## Open

- **A form open when a share comes is lost.** Drafts live in memory and a share reloads the
  page. Acceptable for the debugging build. Options: accept it (sharing is mostly from the day
  screen); keep drafts in `sessionStorage`, which also survives Android killing the app in the
  background (preferred); `launch_handler` `focus-existing` with `launchQueue`, which avoids the
  reload but probably doesn't deliver a POST's body on Android (to check first).
- **A share while a form is open**, once drafts survive: ask to replace it, or open a form of its
  own.
