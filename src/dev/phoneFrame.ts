/**
 * Development only: on a desktop browser, `npm run dev` shows the app inside a frame the size of
 * the target phone, a Pixel 8a (412 × 915 CSS px). The frame is an iframe, so the app gets a real
 * viewport of that size: media queries, dvh units and sticky bars behave as on the phone.
 * `?full` shows the app at full width instead.
 */

import { APP_NAME } from '../config';

export const PHONE = { name: 'Pixel 8a', width: 412, height: 915 };

/** Whether this page should show the phone frame instead of the app. */
export function wantsPhoneFrame(): boolean {
  const inFrame = window.self !== window.top;
  const narrow = window.matchMedia(`(max-width: ${PHONE.width + 100}px)`).matches;
  return !inFrame && !narrow && !new URLSearchParams(location.search).has('full');
}

/** Replaces the page with the phone frame showing the app at the current address. */
export function showPhoneFrame(): void {
  document.title = `${APP_NAME} · ${PHONE.name}`;
  const style = document.createElement('style');
  style.textContent = `
    html, body { margin: 0; height: 100%; background: #d9dfdb; font-family: system-ui, sans-serif; }
    @media (prefers-color-scheme: dark) { html, body { background: #0b0e0c; color: #cfd8d3; } }
    .dev-stage { min-height: 100%; display: grid; place-content: center; gap: 12px;
                 padding: 24px; box-sizing: border-box; justify-items: center; }
    .dev-phone { box-sizing: content-box; width: ${PHONE.width}px; height: ${PHONE.height}px;
                 border: 12px solid #1c1f1e;
                 border-radius: 44px; overflow: hidden; background: #000;
                 box-shadow: 0 24px 60px rgb(0 0 0 / 0.3); }
    .dev-phone iframe { width: 100%; height: 100%; border: 0; display: block; }
    /* Scaled to fit short windows: only the picture shrinks, the app still lays out at full size. */
    .dev-scaler { transform: scale(var(--dev-scale, 1)); transform-origin: top center;
                  height: calc(${PHONE.height + 24}px * var(--dev-scale, 1)); }
    .dev-caption { font-size: 13px; color: #5d6762; display: flex; gap: 16px; }
    .dev-caption a { color: inherit; }
  `;
  document.head.append(style);

  const url = new URL(location.href);
  const full = new URL(location.href);
  full.searchParams.set('full', '');

  const stage = document.createElement('div');
  stage.className = 'dev-stage';
  stage.innerHTML = `
    <div class="dev-scaler"><div class="dev-phone"><iframe title="${APP_NAME} on a ${PHONE.name}"></iframe></div></div>
    <div class="dev-caption">
      <span class="dev-size">${PHONE.name} · ${PHONE.width} × ${PHONE.height}</span>
      <a href="${full.href}">Full width</a>
    </div>`;
  document.body.replaceChildren(stage);

  const fit = () => {
    const scale = Math.min(1, (window.innerHeight - 80) / (PHONE.height + 24));
    stage.style.setProperty('--dev-scale', String(scale));
    const size = stage.querySelector('.dev-size');
    if (size) {
      const shown = scale < 1 ? `, shown at ${Math.round(scale * 100)}%` : '';
      size.textContent = `${PHONE.name} · ${PHONE.width} × ${PHONE.height}${shown}`;
    }
  };
  fit();
  window.addEventListener('resize', fit);

  const frame = stage.querySelector('iframe')!;
  frame.src = url.href;
  // Keep the address bar on the screen shown in the frame, so a reload stays there.
  frame.addEventListener('load', () => {
    const inner = frame.contentWindow!;
    const sync = () => history.replaceState(null, '', inner.location.hash || '#/');
    inner.addEventListener('hashchange', sync);
    inner.addEventListener('popstate', sync);
    const push = inner.history.pushState.bind(inner.history);
    inner.history.pushState = (...args: Parameters<History['pushState']>) => {
      push(...args);
      sync();
    };
    const replace = inner.history.replaceState.bind(inner.history);
    inner.history.replaceState = (...args: Parameters<History['replaceState']>) => {
      replace(...args);
      sync();
    };
    sync();
  });
}

/** Whether the app was asked for at full width (`?full`) on a screen wide enough for the frame. */
export function wantsFullWidth(): boolean {
  const inFrame = window.self !== window.top;
  const narrow = window.matchMedia(`(max-width: ${PHONE.width + 100}px)`).matches;
  return !inFrame && !narrow && new URLSearchParams(location.search).has('full');
}

/** At full width, a small link in the window's corner leads back to the phone frame. */
export function showBackToPhoneLink(): void {
  const back = new URL(location.href);
  back.searchParams.delete('full');
  const link = document.createElement('a');
  link.href = back.href;
  link.textContent = 'Phone frame';
  link.setAttribute(
    'style',
    'position: fixed; left: 12px; bottom: 12px; z-index: 100; padding: 8px 12px;' +
      'border-radius: 8px; background: #1c1f1e; color: #ffffff; font: 13px system-ui, sans-serif;' +
      'text-decoration: none; opacity: 0.85;',
  );
  // Go back to the screen shown now (the app moves between screens with pushState, no event).
  link.addEventListener('click', (e) => {
    e.preventDefault();
    back.hash = location.hash;
    location.href = back.href;
  });
  document.body.append(link);
}
