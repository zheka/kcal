import { useEffect, useRef, useState } from 'preact/hooks';
import { CloseIcon } from '../../ui/icons';
import { canUseCamera, startCamera, type Camera, type CameraError } from './camera';

/**
 * The bar at the bottom: each photo, text or scanned barcode is attached to the meal as it comes
 * (prepared by the caller); Update sends them.
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
          code={(c) => {
            setCamera(false);
            scanned(c);
          }}
        />
      )}
    </div>
  );
}

const CAMERA_ERRORS: Record<CameraError, string> = {
  denied: 'Camera access is blocked. Allow the camera for this site, then try again.',
  failed: 'The camera couldn’t start. Close this and try again.',
};

function CameraView({
  close,
  photo,
  code,
}: {
  close: () => void;
  photo: (blob: Blob) => void;
  code: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const onCodeRef = useRef(code);
  useEffect(() => {
    onCodeRef.current = code;
  });
  useEffect(() => {
    cameraRef.current = startCamera(videoRef.current!, (c) => onCodeRef.current(c), setError);
    return () => cameraRef.current?.stop();
  }, []);
  return (
    <div class="scanner" role="dialog" aria-label="Camera">
      <video ref={videoRef} class="scanner-video" muted playsInline />
      <p class="scanner-hint">
        {error ? CAMERA_ERRORS[error] : 'Point at the food, or at a barcode'}
      </p>
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
