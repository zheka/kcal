// IndexedDB (jsdom has none), for the keys.
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appData, egg, milk } from '../core/testData';
import type { AppData } from '../core/types';
import { serializeBackup } from '../data/backup';
import { createStore } from '../state/store';
import { DB_NAME } from '../data/db';
import { resetKeys } from '../ai/keys';
import { downloadText } from './download';
import { SettingsScreen } from './SettingsScreen';

vi.mock('./download', () => ({ downloadText: vi.fn() }));

afterEach(async () => {
  cleanup();
  vi.mocked(downloadText).mockClear();
  resetKeys();
  await deleteDB(DB_NAME);
});

/** Pastes `value` into the key field `label` and saves it. */
async function paste(label: string, value: string) {
  fireEvent.input(await screen.findByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: `Save ${label.toLowerCase()}` }));
}

/** Matches a saved key's line by its end, though the end is its own element. */
const saved = (label: string, end: string) => (_: string, el: Element | null) =>
  !!el?.classList.contains('key-saved') &&
  el.textContent === `${label} saved on this device (…${end})`;

describe('Gemini keys', () => {
  it('keeps each key on the device, shows its end, and forgets it', async () => {
    render(<SettingsScreen store={createStore(appData(), vi.fn())} />);
    await paste('Key', ' AIzaFirst1234 ');
    await screen.findByText(saved('Key', '1234'));
    expect(screen.getByLabelText('Key 2')).toBeTruthy(); // still empty

    await paste('Key 2', 'AIzaSecond5678');
    await screen.findByText(saved('Key 2', '5678'));

    // Read back from the database, as on the next start.
    cleanup();
    resetKeys();
    render(<SettingsScreen store={createStore(appData(), vi.fn())} />);
    await screen.findByText(saved('Key', '1234'));
    expect(screen.getByText(saved('Key 2', '5678'))).toBeTruthy();

    // One tap only arms Forget; the key stays until the second.
    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }));
    expect(screen.getByText(saved('Key', '1234'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to forget' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Key: cheap Gemini key')).toBeTruthy());
    expect(screen.getByText(saved('Key 2', '5678'))).toBeTruthy();
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

describe('Backup and another window', () => {
  /** What another window saved since this one loaded; `undefined`: nothing. */
  let saved: AppData | undefined;
  let unreadable = false;
  const changes = () => {
    if (unreadable) throw new Error('another window saved data this one can’t read');
    const data = saved ?? null;
    saved = undefined;
    return data;
  };
  afterEach(() => {
    saved = undefined;
    unreadable = false;
  });

  /** Picks `data`, as a backup file, in the import field. */
  function pick(data: AppData) {
    const file = new File([serializeBackup(data, new Date())], 'backup.json');
    const input = screen.getByLabelText<HTMLInputElement>('Import backup');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
  }

  it('exports what is saved now, with what the other window saved', () => {
    render(<SettingsScreen store={createStore(appData({ products: [egg] }), vi.fn(), changes)} />);
    saved = appData({ products: [egg, milk] });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const text = vi.mocked(downloadText).mock.calls[0]![1];
    expect(text).toContain('"milk"');
  });

  it('refuses to export or import when the other window’s data can’t be read', async () => {
    const persist = vi.fn();
    render(<SettingsScreen store={createStore(appData({ products: [egg] }), persist, changes)} />);
    unreadable = true;
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(downloadText).not.toHaveBeenCalled();
    expect(screen.getByText(/^Could not export: another window saved data/)).toBeTruthy();

    pick(appData({ products: [milk] }));
    fireEvent.click(await screen.findByRole('button', { name: 'Replace my data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to replace' }));
    expect(screen.getByText(/^Could not import: another window saved data/)).toBeTruthy();
    expect(persist).not.toHaveBeenCalled();
  });
});
