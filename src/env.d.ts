/** The app's version from package.json, set at build time. */
declare const __APP_VERSION__: string;

/** The commit the app was built from (short hash), set at build time. */
declare const __APP_BUILD__: string;

/** The browser's built-in barcode reader (Chrome on Android); not in TypeScript's DOM types. */
interface BarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}
interface Window {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetector;
}
