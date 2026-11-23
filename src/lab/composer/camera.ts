/**
 * The camera for photos: it shows until the shutter (`capture`) or closing. It reads no
 * barcodes; scanning has its own button and scanner.
 */

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

export function startCamera(
  video: HTMLVideoElement,
  onError: (error: CameraError) => void,
): Camera {
  const running: { stopped: boolean; stream?: MediaStream } = { stopped: false };
  const stop = () => {
    running.stopped = true;
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
