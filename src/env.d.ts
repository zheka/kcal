/** The app's version, set at build time: the commit it was built from and the build date. */
declare const __APP_VERSION__: string;

/** The browser's built-in barcode reader (Chrome on Android); not in TypeScript's DOM types. */
interface BarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}
interface Window {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetector;
}
