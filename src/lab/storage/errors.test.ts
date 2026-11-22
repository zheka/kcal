import { expect, it } from 'vitest';
import { captureErrors } from './errors';

it('logs uncaught errors and unhandled rejections until stopped', () => {
  const logged: Record<string, unknown>[] = [];
  const stop = captureErrors({ log: async (record) => void logged.push(record) });

  window.dispatchEvent(
    new ErrorEvent('error', {
      error: new TypeError('x is undefined'),
      filename: 'https://zheka.github.io/kcal/lab/assets/main.js',
      lineno: 3,
      colno: 7,
    }),
  );
  const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
  Object.defineProperty(rejection, 'reason', { value: 'offline' });
  window.dispatchEvent(rejection);
  stop();
  window.dispatchEvent(new ErrorEvent('error', { message: 'after stop' }));

  expect(logged).toEqual([
    {
      event: 'error',
      message: 'TypeError: x is undefined',
      stack: expect.any(String),
      at: 'https://zheka.github.io/kcal/lab/assets/main.js:3:7',
    },
    { event: 'unhandled rejection', message: 'offline' },
  ]);
});
