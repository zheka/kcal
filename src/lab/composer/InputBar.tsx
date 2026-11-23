import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { canScan } from '../../barcode';
import { BarcodeScanner } from '../../ui/BarcodeScanner';
import { BarcodeIcon, CloseIcon } from '../../ui/icons';
import { canUseCamera, startCamera, type Camera, type CameraError } from './camera';

/**
 * The bar at the bottom: each photo, text or scanned barcode is attached to the meal as it comes
 * (prepared by the caller); Update sends them. Photos and barcodes have a button each, so that
 * a barcode in sight doesn't stop a photo of the food.
 */
export function InputBar({
  disabled,
  attachText,
  attachPhoto,
  scanned,
}: {
  disabled: boolean;
  attachText: (text: string) => void;
  attachPhoto: (photo: Blob) => void;
  scanned: (code: string) => void;
}) {
  const [text, setText] = useState('');
  const [camera, setCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  // The scanner restarts the camera when its callback changes: keep one, calling the latest.
  const scannedRef = useRef(scanned);
  useEffect(() => {
    scannedRef.current = scanned;
  });
  const read = useCallback((code: string) => {
    setScanning(false);
    scannedRef.current(code);
  }, []);

  return (
    <div class="input-bar">
      <form
        class="input-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled || !text.trim()) return;
          attachText(text.trim());
          setText('');
        }}
      >
        {canUseCamera() && (
          <button
            type="button"
            class="icon-button"
            aria-label="Camera"
            disabled={disabled}
            onClick={() => setCamera(true)}
          >
            📷
          </button>
        )}
        {canScan() && (
          <button
            type="button"
            class="icon-button"
            aria-label="Scan barcode"
            disabled={disabled}
            onClick={() => setScanning(true)}
          >
            <BarcodeIcon />
          </button>
        )}
        <label class="icon-button" aria-label="Pick photos">
          🖼️
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={disabled}
            onChange={(e) => {
              for (const f of e.currentTarget.files ?? []) attachPhoto(f);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <input
          id="composer-text"
          class="input grow"
          aria-label="What you eat"
          placeholder="e.g. chicken meatballs, 100 g potatoes"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button type="submit" class="button primary" disabled={disabled || !text.trim()}>
          Add
        </button>
      </form>
      {camera && (
        <CameraView
          close={() => setCamera(false)}
          photo={(blob) => {
            setCamera(false);
            attachPhoto(blob);
          }}
        />
      )}
      {scanning && <BarcodeScanner onCode={read} onClose={() => setScanning(false)} />}
    </div>
  );
}

const CAMERA_ERRORS: Record<CameraError, string> = {
  denied: 'Camera access is blocked. Allow the camera for this site, then try again.',
  failed: 'The camera couldn’t start. Close this and try again.',
};

function CameraView({ close, photo }: { close: () => void; photo: (blob: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  useEffect(() => {
    cameraRef.current = startCamera(videoRef.current!, setError);
    return () => cameraRef.current?.stop();
  }, []);
  return (
    <div class="scanner" role="dialog" aria-label="Camera">
      <video ref={videoRef} class="scanner-video" muted playsInline />
      <p class="scanner-hint">{error ? CAMERA_ERRORS[error] : 'Point at the food'}</p>
      <button
        type="button"
        class="icon-button scanner-close"
        aria-label="Close camera"
        onClick={close}
      >
        <CloseIcon />
      </button>
      <button
        type="button"
        class="shutter"
        aria-label="Take photo"
        disabled={!!error}
        onClick={() =>
          void cameraRef.current
            ?.capture()
            .then(photo)
            .catch(() => setError('failed'))
        }
      />
    </div>
  );
}
