import { createGemini } from './gemini/index.ts';
import { geminiKeys } from './keys.ts';

/**
 * The providers as the app and the lab ask them: one each per tab, with the keys kept on this
 * device (keys.ts), read afresh before every try.
 */
export const gemini = createGemini({ keys: geminiKeys });
