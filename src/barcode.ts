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

/** A running scan; `stop` turns the camera off. */
export interface Scan {
  stop(): void;
}

/**
 * Shows the back camera in `video` and reports the first barcode it reads, then stops.
 * Errors: `denied` when camera access is refused, `failed` when the camera can't start.
 */
export async function startScan(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
  onError: (error: ScanError) => void,
): Promise<Scan> {
  const running: { stream?: MediaStream; timer?: ReturnType<typeof setInterval> } = {};
  const stop = () => {
    if (running.timer) clearInterval(running.timer);
    running.stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  try {
    running.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    video.srcObject = running.stream;
    await video.play();
  } catch (err) {
    stop();
    onError((err as Error).name === 'NotAllowedError' ? 'denied' : 'failed');
    return { stop };
  }
  const detector = new window.BarcodeDetector!({ formats: FORMATS });
  let busy = false;
  running.timer = setInterval(() => {
    if (busy || video.readyState < 2) return;
    busy = true;
    detector
      .detect(video)
      .then((codes) => {
        const code = codes.map((c) => c.rawValue).find((v) => /^\d{8,14}$/.test(v));
        if (code) {
          stop();
          onCode(code);
        }
      })
      .catch(() => {})
      .finally(() => (busy = false));
  }, 250);
  return { stop };
}
