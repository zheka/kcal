// IndexedDB (jsdom has none), for the keys.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appData, egg } from '../core/testData';
import { createStore } from '../state/store';
import { DB_NAME } from '../data/db';
import { resetKeys } from '../ai/keys';
import { SettingsScreen } from './SettingsScreen';

afterEach(async () => {
  cleanup();
  resetKeys();
  await deleteDB(DB_NAME);
});

/** Pastes `value` into the key field `label` and saves it. */
async function paste(label: string, value: string) {
  fireEvent.input(await screen.findByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: `Save ${label.toLowerCase()}` }));
}

describe('Gemini keys', () => {
  it('keeps each key on the device, shows its end, and forgets it', async () => {
    render(<SettingsScreen store={createStore(appData(), vi.fn())} />);
    await paste('Key', ' AIzaFirst1234 ');
    await screen.findByText('Saved on this device (…1234)');
    expect(screen.getByLabelText('Key 2')).toBeTruthy(); // still empty

    await paste('Key 2', 'AIzaSecond5678');
    await screen.findByText('Saved on this device (…5678)');

    // Read back from the database, as on the next start.
    cleanup();
    resetKeys();
    render(<SettingsScreen store={createStore(appData(), vi.fn())} />);
    await screen.findByText('Saved on this device (…1234)');
    expect(screen.getByText('Saved on this device (…5678)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Cheap Gemini key')).toBeTruthy());
    expect(screen.getByText('Saved on this device (…5678)')).toBeTruthy();
  });
});

describe('Backup', () => {
  it('comes first, and says what is saved, how big, in which format', () => {
    render(<SettingsScreen store={createStore(appData({ products: [egg] }), vi.fn())} />);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Backup', 'Gemini']);
    expect(screen.getByText('Saved: 1 product, 0 recipes, 0 meals')).toBeTruthy();
    expect(screen.getByText(/MB · data format kcal 0\.2\.0$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    expect(screen.getByLabelText('Import backup')).toBeTruthy();
  });
});
