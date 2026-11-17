import { registerSW } from 'virtual:pwa-register';

/**
 * Makes the app work offline. A new version downloads in the background and takes over on
 * the next launch; the app never reloads by itself.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
