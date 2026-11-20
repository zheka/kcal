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

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Characters as seen: an emoji (💧, a flag, 👍🏽) counts as one. */
export function charCount(text: string): number {
  return [...graphemes.segment(text)].length;
}
