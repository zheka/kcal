import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

/**
 * Offline support and updates. The service worker caches the whole app, so it works offline.
 * A new version downloads in the background and waits; it takes over on the next launch, or
 * right away from the menu (App version). The app never reloads by itself.
 */

export type UpdateState =
  /** No service worker: in development, or a browser without them. */
  | 'unavailable'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  /** A new version is downloaded and waiting. */
  | 'available'
  | 'installing'
  | 'offline'
  | 'failed';

export const updateState = signal<UpdateState>('unavailable');

let registration: ServiceWorkerRegistration | undefined;
let activateUpdate: ((reload?: boolean) => Promise<void>) | undefined;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  activateUpdate = registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (updateState.value === 'unavailable')
        updateState.value = reg?.waiting ? 'available' : 'idle';
    },
    onNeedRefresh() {
      updateState.value = 'available';
    },
  });
}

/** Asks the server for a new version; a new one is downloaded before this resolves. */
export async function checkForUpdate(): Promise<void> {
  if (!registration) return;
  if (!navigator.onLine) {
    updateState.value = 'offline';
    return;
  }
  updateState.value = 'checking';
  try {
    await registration.update();
    const installing = registration.installing;
    if (installing) await installed(installing);
  } catch {
    updateState.value = navigator.onLine ? 'failed' : 'offline';
    return;
  }
  updateState.value = registration.waiting ? 'available' : 'up-to-date';
}

/** Switches to the downloaded version now: the app reloads into it. */
export async function installUpdate(): Promise<void> {
  if (!activateUpdate) return;
  updateState.value = 'installing';
  await activateUpdate(true);
}

/** Resolves once a new service worker has finished installing (or failed). */
function installed(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      if (worker.state === 'installed' || worker.state === 'redundant') resolve();
    };
    worker.addEventListener('statechange', done);
    done();
  });
}

/** Asks the browser not to evict the saved data under storage pressure. */
export function requestPersistentStorage(): void {
  void navigator.storage?.persist?.();
}
