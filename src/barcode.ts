/**
 * Reading barcodes with the camera and the browser's built-in barcode reader (BarcodeDetector,
 * in Chrome on Android). No library: where the browser has no reader, scanning isn't offered.
 */

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

/** Whether this browser can scan: a camera and a built-in barcode reader. */
export function canScan(): boolean {
  return typeof window.BarcodeDetector === 'function' && !!navigator.mediaDevices?.getUserMedia;
}

export type ScanError = 'denied' | 'failed';

/** A running scan; `stop` turns the camera off, at any moment, also while it is starting. */
export interface Scan {
  stop(): void;
}

/**
 * Shows the back camera in `video` and reports the first barcode it reads, then stops.
 * Errors: `denied` when camera access is refused, `failed` when the camera can't start.
 * Returns at once: the camera starts in the background.
 */
export function startScan(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
  onError: (error: ScanError) => void,
): Scan {
  const running: {
    stopped: boolean;
    stream?: MediaStream;
    timer?: ReturnType<typeof setInterval>;
  } = { stopped: false };
  const stop = () => {
    running.stopped = true;
    if (running.timer) clearInterval(running.timer);
    running.stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  void (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      running.stream = stream;
      // Stopped while the camera was starting: turn it off as soon as it is there.
      if (running.stopped) return stop();
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      if (running.stopped) return;
      stop();
      onError((err as Error).name === 'NotAllowedError' ? 'denied' : 'failed');
      return;
    }
    if (running.stopped) return stop();
    const detector = new window.BarcodeDetector!({ formats: FORMATS });
    let busy = false;
    running.timer = setInterval(() => {
      if (busy || video.readyState < 2) return;
      busy = true;
      detector
        .detect(video)
        .then((codes) => {
          const code = codes.map((c) => c.rawValue).find((v) => /^\d{8,14}$/.test(v));
          if (code && !running.stopped) {
            stop();
            onCode(code);
          }
        })
        .catch(() => {})
        .finally(() => (busy = false));
    }, 250);
  })();

  return { stop };
}
