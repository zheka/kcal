import { render } from 'preact';
import { clearSaved, loadSaved, saveData } from './data/storage';
import { registerServiceWorker, requestPersistentStorage } from './pwa';
import { createStore } from './state/store';
import { App } from './ui/App';
import { ProblemScreen } from './ui/ProblemScreen';
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

start();
registerServiceWorker();
requestPersistentStorage();
