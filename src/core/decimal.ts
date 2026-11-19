import { STORED_DECIMALS } from '../config';

const SCALE = 10 ** STORED_DECIMALS;

/**
 * Rounds a number for storing: at most 3 decimals, half up, on the decimal value. The shift is
 * done in decimal notation (`1.0005e3`), so binary floats can't flip a half: 1.0005 → 1.001,
 * where `toFixed` would give 1.000. -0 becomes 0.
 */
export function roundStored(n: number): number {
  const sign = n < 0 ? -1 : 1;
  const shifted = Math.round(Number(`${Math.abs(n)}e${STORED_DECIMALS}`));
  const result = sign * Number(`${shifted}e-${STORED_DECIMALS}`);
  return result === 0 ? 0 : result;
}

/** Whether a number is finite and has at most the stored number of decimals. */
export function isStoredPrecision(n: number): boolean {
  return Number.isFinite(n) && roundStored(n) === n;
}

/** A stored number as an exact integer number of thousandths: 1.03 → 1030. */
export function thousandths(n: number): number {
  return Math.round(n * SCALE);
}

export const THOUSANDTHS = SCALE;
