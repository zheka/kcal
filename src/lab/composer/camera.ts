/**
 * One camera, two behaviours: while it shows, it watches for barcodes and
 * reports the first one at once (no shutter); a photo is taken with the shutter (`capture`).
 * Barcodes are read only where the browser has a reader; photos work with any camera.
 */

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

export type CameraError = 'denied' | 'failed';

export interface Camera {
  /** The current frame as a JPEG. */
  capture(): Promise<Blob>;
  /** Turns the camera off, at any moment, also while it is starting. */
  stop(): void;
}

export function canUseCamera(): boolean {
  return !!navigator.mediaDevices?.getUserMedia;
}

export function canReadBarcodes(): boolean {
  return typeof window.BarcodeDetector === 'function';
}

export function startCamera(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
  onError: (error: CameraError) => void,
): Camera {
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
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      });
      running.stream = stream;
      if (running.stopped) return stop();
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      if (running.stopped) return;
      stop();
      onError((err as Error).name === 'NotAllowedError' ? 'denied' : 'failed');
      return;
    }
    if (running.stopped || !canReadBarcodes()) return;
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

  return {
    stop,
    capture: () =>
      new Promise<Blob>((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (!canvas.width) return reject(new Error('the camera has no picture yet'));
        canvas.getContext('2d')!.drawImage(video, 0, 0);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('could not take the photo'))),
          'image/jpeg',
          0.92,
        );
      }),
  };
}
