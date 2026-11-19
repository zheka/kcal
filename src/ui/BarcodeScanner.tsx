import { useEffect, useRef, useState } from 'preact/hooks';
import { startScan, type ScanError } from '../barcode';
import { CloseIcon } from './icons';

const ERRORS: Record<ScanError, string> = {
  denied:
    'Camera access is blocked. Allow the camera for this site in Chrome’s settings, then try again.',
  failed: 'The camera couldn’t start. Close this and try again.',
};

/** The camera, full screen, until a barcode is read or the user closes it. */
export function BarcodeScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<ScanError | null>(null);

  useEffect(() => {
    let scan: { stop(): void } | undefined;
    let closed = false;
    void startScan(video.current!, onCode, setError).then((s) => {
      if (closed) s.stop();
      else scan = s;
    });
    return () => {
      closed = true;
      scan?.stop();
    };
  }, [onCode]);

  return (
    <div class="scanner" role="dialog" aria-label="Scan barcode">
      <video ref={video} class="scanner-video" muted playsInline />
      <div class="scanner-frame" aria-hidden="true" />
      <p class="scanner-hint">{error ? ERRORS[error] : 'Point the camera at the barcode'}</p>
      <button type="button" class="icon-button scanner-close" aria-label="Close" onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
