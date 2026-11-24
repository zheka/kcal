// IndexedDB (jsdom has none), for the Gemini key.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { deleteDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appData } from '../core/testData';
import { checkForUpdate, installUpdate, updateState } from '../pwa';
import { DB_NAME } from '../data/db';
import { resetGeminiKey } from '../state/aiKey';
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
afterEach(async () => {
  cleanup();
  updateState.value = 'unavailable';
  resetGeminiKey();
  await deleteDB(DB_NAME);
});

describe('App version', () => {
  it('shows the build, and the data format separately', () => {
    expect(versionItem().textContent).toContain(__APP_VERSION__);
    expect(screen.getByText('Data format: kcal 0.2.1')).toBeTruthy();
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

describe('AI', () => {
  it('keeps the Gemini key on the device, shows its end, and forgets it', async () => {
    const field = await screen.findByLabelText('Gemini key');
    fireEvent.input(field, { target: { value: ' AIzaSecret1234 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Gemini key saved on this device (…1234)');

    // Read back from the database, as on the next start.
    cleanup();
    resetGeminiKey();
    render(<MenuScreen store={createStore(appData(), vi.fn())} />);
    await screen.findByText('Gemini key saved on this device (…1234)');

    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    await waitFor(() => expect(screen.getByLabelText('Gemini key')).toBeTruthy());
  });

  it('says which model a task asks: built in, or as the settings change it', async () => {
    cleanup();
    const data = appData({
      settings: { ai: { product: { model: 'gemini-x' } }, quickButtons: [] },
    });
    render(<MenuScreen store={createStore(data, vi.fn())} />);
    expect(await screen.findByText(/Products: gemini-x, thinking low\./)).toBeTruthy();
  });
});
