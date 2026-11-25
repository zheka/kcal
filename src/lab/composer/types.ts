import type { ScannedProductData } from '../../data/openFoodFacts';
import type { Meal } from '../meal/read';
import type { Answers } from '../meal/process';

/**
 * The meal composer experiment's records (kept in its lab data, see data.ts): what a meal is
 * composed from, the model's last answer as read (src/lab/meal/read.ts), and the user's answers
 * to its questions. Everything shown is made from these on the phone (process.ts), so a tap on an
 * answer needs no request. Kept apart from the app's data, which the experiment only reads.
 */

/** What the meal is composed from, as attached (already prepared: photos shrunk, codes looked up). */
export type Attached =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'photo'; file: string }
  /** A scanned barcode: what Open Food Facts says about it, as it is. */
  | { id: string; kind: 'product'; product: ScannedProductData };

export interface ComposedMeal {
  id: string;
  /** For the list: the model's title. */
  title: string;
  /** When the meal was started (UTC). */
  at: string;
  context: Attached[];
  /** The model's last answer, as read; none before the first update. */
  meal?: Meal;
  /**
   * The model's last answer as it came (the schema's JSON), and when its update was sent, local
   * time with the offset (`2026-11-25T08:10:31+01:00`: the time the model was told). Kept since
   * 2026-11-25, for downloading a meal as a test.
   */
  answer?: unknown;
  answeredAt?: string;
  /** The user's answers to its questions; reset by an update. */
  answers: Answers;
  /** The context changed since the answer: Update sends it all. */
  changed: boolean;
  /** Why the last update failed, until the context changes or an update works. */
  failed?: string;
}
