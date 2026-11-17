/**
 * Unsaved forms, kept while the user leaves them for another screen (e.g. to create a
 * product for a recipe) and dropped on save or cancel.
 */
const drafts = new Map<string, unknown>();

export function loadDraft<T>(key: string): T | undefined {
  return drafts.get(key) as T | undefined;
}

export function keepDraft(key: string, draft: unknown): void {
  drafts.set(key, draft);
}

export function dropDraft(key: string): void {
  drafts.delete(key);
}

/** A food just created from a picker, to be added where the picker was. */
let createdFood: string | null = null;

export function handOverCreatedFood(id: string): void {
  createdFood = id;
}

export function takeCreatedFood(): string | null {
  const id = createdFood;
  createdFood = null;
  return id;
}

/** Forgets every draft (tests). */
export function clearDrafts(): void {
  drafts.clear();
  createdFood = null;
}
