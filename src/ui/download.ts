/** Lets the user save text as a file. */
export function downloadText(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: 'application/json' }));
}

/** Lets the user save a blob as a file. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
