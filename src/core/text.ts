/**
 * Cleans typed text: Unicode NFC, trimmed, any run of whitespace collapsed into one space.
 * Letter case is kept.
 */
export function cleanText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ');
}

export function isClean(text: string): boolean {
  return text === cleanText(text);
}

/** Key for comparing names: cleaned and lowercase, so `Skyr` and ` skyr ` are the same name. */
export function nameKey(name: string): string {
  return cleanText(name).toLowerCase();
}
