import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appData } from '../core/testData';
import { checkForUpdate, installUpdate, updateState } from '../pwa';
import { createStore } from '../state/store';
import { MenuScreen } from './MenuScreen';

vi.mock('../pwa', async (original) => ({
  ...(await original<typeof import('../pwa')>()),
  checkForUpdate: vi.fn(),
  installUpdate: vi.fn(),
}));

const versionItem = () => screen.getByRole('button', { name: /^App version/ });

beforeEach(() => {
  vi.mocked(checkForUpdate).mockClear();
  vi.mocked(installUpdate).mockClear();
  render(<MenuScreen store={createStore(appData(), vi.fn())} />);
});
afterEach(() => {
  cleanup();
  updateState.value = 'unavailable';
});

describe('App version', () => {
  it('shows the version and the build', () => {
    expect(versionItem().textContent).toContain(`kcal ${__APP_VERSION__} · ${__APP_BUILD__}`);
  });

  it('says what a tap does in every state', async () => {
    const expected = {
      idle: 'Tap to check for updates',
      checking: 'Checking for updates…',
      'up-to-date': 'Up to date. Tap to check again',
      available: 'Update available: tap to install',
      installing: 'Installing the update…',
      offline: 'Offline: connect to check for updates',
      failed: 'Could not check for updates. Tap to try again',
    } as const;
    for (const [state, text] of Object.entries(expected)) {
      updateState.value = state as keyof typeof expected;
      expect(await screen.findByText(text)).toBeTruthy();
    }
  });

  it('checks for an update on a tap', async () => {
    updateState.value = 'idle';
    await screen.findByText('Tap to check for updates');
    fireEvent.click(versionItem());
    expect(checkForUpdate).toHaveBeenCalledOnce();
    expect(installUpdate).not.toHaveBeenCalled();
  });

  it('installs a waiting update on a tap', async () => {
    updateState.value = 'available';
    await screen.findByText('Update available: tap to install');
    fireEvent.click(versionItem());
    expect(installUpdate).toHaveBeenCalledOnce();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('can’t be tapped while checking or without a service worker', async () => {
    updateState.value = 'checking';
    await screen.findByText('Checking for updates…');
    expect((versionItem() as HTMLButtonElement).disabled).toBe(true);
    updateState.value = 'unavailable';
    await screen.findByText('Updates work in the built app (npm run preview)');
    expect((versionItem() as HTMLButtonElement).disabled).toBe(true);
  });
});
