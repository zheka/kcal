import type { Lab } from './lab';

/**
 * Logs the page's uncaught errors and unhandled promise rejections to the experiment's log, so
 * they reach the download. Returns a function that stops it.
 */
export function captureErrors(lab: Pick<Lab<unknown>, 'log'>): () => void {
  const onError = (e: ErrorEvent) =>
    void lab.log({ event: 'error', ...describe(e.error ?? e.message), at: where(e) });
  const onRejection = (e: PromiseRejectionEvent) =>
    void lab.log({ event: 'unhandled rejection', ...describe(e.reason) });
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`,
      ...(error.stack && { stack: error.stack }),
    };
  }
  return { message: String(error) };
}

function where(e: ErrorEvent): string | undefined {
  return e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined;
}
