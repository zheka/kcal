/** A photo ready to send: a JPEG, at most `maxSide` px on its longer side, base64-encoded. */
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

/** How a photo is sent: its longer side at most, in px; JPEG quality, 0–100. A task's setting. */
export interface PhotoSize {
  maxSide: number;
  quality: number;
}

export async function shrinkPhoto(file: Blob, { maxSide, quality }: PhotoSize): Promise<Photo> {
  // Respects the photo's EXIF orientation, so portrait photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
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
      quality / 100,
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
