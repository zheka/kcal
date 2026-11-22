/** A photo ready to send: a JPEG, at most MAX_SIDE px on its longer side, base64-encoded. */
export interface Photo {
  type: 'image/jpeg';
  base64: string;
  width: number;
  height: number;
  bytes: number;
  /** The shrunk JPEG, e.g. to keep it. */
  blob: Blob;
  /** For showing it: an object URL of the shrunk JPEG. */
  url: string;
}

/** Enough to tell foods and portions apart, and small enough to send quickly. */
export const MAX_SIDE = 1024;

export async function shrinkPhoto(file: Blob): Promise<Photo> {
  // Respects the photo's EXIF orientation, so portrait photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('could not encode the photo'))),
      'image/jpeg',
      0.85,
    ),
  );
  const base64 = await toBase64(blob);
  return {
    type: 'image/jpeg',
    base64,
    width,
    height,
    bytes: blob.size,
    blob,
    url: URL.createObjectURL(blob),
  };
}

/** A blob's bytes as base64, e.g. a kept photo to send again. */
export async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
