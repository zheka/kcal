import { render } from 'preact';
import { clearSaved, loadSaved, saveData } from './data/storage';
import { registerServiceWorker, requestPersistentStorage } from './pwa';
import { createStore } from './state/store';
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
    render(<App store={createStore(loaded.data, saveData)} />, root!);
  } else {
    render(
      <ProblemScreen
        problems={loaded.problems}
        raw={loaded.raw}
        onStartFresh={() => {
          clearSaved();
          start();
        }}
      />,
      root!,
    );
  }
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
