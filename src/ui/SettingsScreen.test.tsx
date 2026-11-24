// IndexedDB (jsdom has none), for the keys.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { TASKS } from '../ai/tasks';
import { DB_NAME } from '../data/db';
import { resetKeys } from '../state/keys';
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
    render(<SettingsScreen />);
    await paste('Key', ' AIzaFirst1234 ');
    await screen.findByText('Saved on this device (…1234)');
    expect(screen.getByLabelText('Key 2')).toBeTruthy(); // still empty

    await paste('Key 2', 'AIzaSecond5678');
    await screen.findByText('Saved on this device (…5678)');

    // Read back from the database, as on the next start.
    cleanup();
    resetKeys();
    render(<SettingsScreen />);
    await screen.findByText('Saved on this device (…1234)');
    expect(screen.getByText('Saved on this device (…5678)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Paste a key')).toBeTruthy());
    expect(screen.getByText('Saved on this device (…5678)')).toBeTruthy();
  });

  it('says which model a task asks: built in', async () => {
    render(<SettingsScreen />);
    const { model, thinking } = TASKS.product;
    expect(
      await screen.findByText(new RegExp(`Products: ${model}, thinking ${thinking}\\.`)),
    ).toBeTruthy();
  });
});
