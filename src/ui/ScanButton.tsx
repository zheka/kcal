import { useCallback, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { canScan } from '../barcode';
import { BarcodeScanner } from './BarcodeScanner';
import { BarcodeIcon } from './icons';

/**
 * A scan button inside the right edge of a text field (the field and the button go in a
 * `.input-with-action`), opening the camera until a barcode is read. Hidden where the browser
 * can't read barcodes.
 */
export function ScanButton({ onCode }: { onCode: (code: string) => void }) {
  const [scanning, setScanning] = useState(false);
  // The scanner restarts the camera when its callback changes: keep one, calling the latest.
  const onCodeRef = useRef(onCode);
  useLayoutEffect(() => {
    onCodeRef.current = onCode;
  });
  const read = useCallback((code: string) => {
    setScanning(false);
    onCodeRef.current(code);
  }, []);
  if (!canScan()) return null;
  return (
    <>
      <button
        type="button"
        class="icon-button input-action"
        aria-label="Scan barcode"
        onClick={() => setScanning(true)}
      >
        <BarcodeIcon />
      </button>
      {scanning && <BarcodeScanner onCode={read} onClose={() => setScanning(false)} />}
    </>
  );
}
