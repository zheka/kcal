import { checkForUpdate, installUpdate, updateState, type UpdateState } from '../pwa';
import { navigate } from './router';

/** Where to go (Library, Goals, Settings), and last the app's version, which also updates it. */
export function MenuScreen() {
  return (
    <div class="menu">
      <button type="button" class="menu-item" onClick={() => navigate('/library')}>
        Library
      </button>
      <button type="button" class="menu-item" onClick={() => navigate('/goals')}>
        Goals
      </button>
      <button type="button" class="menu-item" onClick={() => navigate('/settings')}>
        Settings
      </button>
      <AppVersion />
    </div>
  );
}

const STATUS: Record<UpdateState, string> = {
  unavailable: import.meta.env.DEV
    ? 'Updates work in the built app (npm run preview)'
    : 'Updates are not available in this browser',
  idle: 'Tap to check for updates',
  checking: 'Checking for updates…',
  'up-to-date': 'Up to date. Tap to check again',
  available: 'Update available: tap to install',
  installing: 'Installing the update…',
  offline: 'Offline: connect to check for updates',
  failed: 'Could not check for updates. Tap to try again',
};

/** The app's version and build; a tap checks for an update, or installs one that is ready. */
function AppVersion() {
  const state = updateState.value;
  const busy = state === 'checking' || state === 'installing' || state === 'unavailable';
  return (
    <button
      type="button"
      class={`menu-item version ${state === 'available' ? 'update' : ''}`}
      disabled={busy}
      onClick={() => void (state === 'available' ? installUpdate() : checkForUpdate())}
    >
      <span class="menu-item-title">App version</span>
      <span class="menu-item-detail">{__APP_VERSION__}</span>
      <span class="menu-item-status" aria-live="polite">
        {STATUS[state]}
      </span>
    </button>
  );
}
