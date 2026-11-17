import { signal } from '@preact/signals';
import { localDate } from '../core/time';

/**
 * Hash routes (`#/library`, `#/product/<id>`), so the phone's back button and reloads work
 * with static hosting.
 */
export interface Route {
  path: string;
  params: URLSearchParams;
}

function current(): Route {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path = '/', query = ''] = hash.split('?');
  return { path, params: new URLSearchParams(query) };
}

export const route = signal<Route>(current());

const update = () => (route.value = current());
window.addEventListener('popstate', update);
window.addEventListener('hashchange', update);

/** Opens a screen; the back button returns from it. */
export function navigate(path: string): void {
  history.pushState({ kcal: true }, '', `#${path}`);
  update();
}

/**
 * Leaves the current screen: back to where it was opened from, or to `fallback` when it was
 * opened directly (from a link or a reload).
 */
export function goBack(fallback = '/'): void {
  if ((history.state as { kcal?: boolean } | null)?.kcal) {
    history.back();
  } else {
    history.replaceState(null, '', `#${fallback}`);
    update();
  }
}

/** Shows another screen in place of this one: back skips it (moving between days). */
export function replaceRoute(path: string): void {
  history.replaceState(history.state, '', `#${path}`);
  update();
}

/** Today's local date as a signal, refreshed when the app comes back to the foreground. */
export const today = signal(localDateNow());

function localDateNow(): string {
  return localDate(new Date());
}

const refreshToday = () => (today.value = localDateNow());
document.addEventListener('visibilitychange', refreshToday);
window.addEventListener('focus', refreshToday);
