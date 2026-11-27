import { render } from 'preact';
import { clearSaved, loadSaved, saveData, savedByOtherWindow, STORAGE_KEY } from './data/storage';
import { registerServiceWorker, requestPersistentStorage } from './pwa';
import { createStore, type Store } from './state/store';
import { App } from './ui/App';
import { ProblemScreen } from './ui/ProblemScreen';
// Roboto, the Pixel's own font, shipped with the app so it looks the same on every device,
// in development and in the layout tests.
import '@fontsource-variable/roboto/wght.css';
import './style.css';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');

/** Loads the saved data; if it fails its check, shows the problem screen instead of the app. */
function start(): void {
  const loaded = loadSaved();
  if (loaded.ok) {
    const store = createStore(loaded.data, saveData, savedByOtherWindow);
    showOtherWindows(store);
    render(<App store={store} />, root!);
  } else {
    render(
      <ProblemScreen
        problems={loaded.problems}
        raw={loaded.raw}
        newer={loaded.newer}
        onStartFresh={() => {
          clearSaved();
          start();
        }}
      />,
      root!,
    );
  }
}

/**
 * Shows what the app saved in another window (the installed app and a browser tab, or an old
 * tab kept alive): when it saves, and when this window comes back to the front. Errors are
 * ignored here; the next save reports them.
 */
function showOtherWindows(store: Store): void {
  const refresh = () => {
    try {
      store.refresh();
    } catch {
      // e.g. data this window can't read: saving says so
    }
  };
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) refresh();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
}

if (import.meta.env.DEV) {
  // Development: show the app in a phone-sized frame on desktop browsers (see dev/phoneFrame.ts).
  void import('./dev/phoneFrame').then(
    ({ showBackToPhoneLink, showPhoneFrame, wantsFullWidth, wantsPhoneFrame }) => {
      if (wantsPhoneFrame()) {
        showPhoneFrame();
      } else {
        start();
        if (wantsFullWidth()) showBackToPhoneLink();
      }
    },
  );
} else {
  start();
}
registerServiceWorker();
requestPersistentStorage();
