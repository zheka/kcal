import { afterEach, describe, expect, it, vi } from 'vitest';

// The service worker's registration, as vite-plugin-pwa hands it over.
const activate = vi.fn(() => Promise.resolve());
vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: { onRegisteredSW(url: string, reg: unknown): void }) => {
    options.onRegisteredSW('/sw.js', registration);
    return activate;
  },
}));

let waiting: object | null = null;
const registration = {
  get waiting() {
    return waiting;
  },
  installing: null,
  update: vi.fn(() => Promise.resolve()),
};

const { registerServiceWorker, updateApp, updateState } = await import('./pwa');

function online(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
  activate.mockClear();
  registration.update.mockClear();
  waiting = null;
});

describe('updateApp', () => {
  it('just reloads without a service worker', async () => {
    updateState.value = 'unavailable';
    const reload = vi.fn();
    await updateApp(reload);
    expect(reload).toHaveBeenCalledOnce();
    expect(registration.update).not.toHaveBeenCalled();
  });

  describe('with a service worker', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });

    it('switches to a waiting version', async () => {
      waiting = {};
      registerServiceWorker();
      expect(updateState.value).toBe('available');
      const reload = vi.fn();
      await updateApp(reload);
      expect(activate).toHaveBeenCalledWith(true);
      expect(registration.update).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('checks first, and switches to what it finds', async () => {
      online(true);
      updateState.value = 'idle';
      registration.update.mockImplementationOnce(() => {
        waiting = {};
        return Promise.resolve();
      });
      const reload = vi.fn();
      await updateApp(reload);
      expect(activate).toHaveBeenCalledWith(true);
      expect(reload).not.toHaveBeenCalled();
    });

    it('reloads when nothing is waiting: another window may have installed it', async () => {
      online(true);
      updateState.value = 'up-to-date';
      const reload = vi.fn();
      await updateApp(reload);
      expect(registration.update).toHaveBeenCalledOnce();
      expect(activate).not.toHaveBeenCalled();
      expect(reload).toHaveBeenCalledOnce();
    });

    it('reloads offline too, without checking', async () => {
      online(false);
      updateState.value = 'idle';
      const reload = vi.fn();
      await updateApp(reload);
      expect(registration.update).not.toHaveBeenCalled();
      expect(reload).toHaveBeenCalledOnce();
    });
  });
});
