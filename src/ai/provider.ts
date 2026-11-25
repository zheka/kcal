import type { ModelRequest, Reply } from './model.ts';

/**
 * A provider, as a task asks it: the request (what to ask, coupled to its prompt: model,
 * instructions, config) and how soon an answer is needed. Everything about getting the answer
 * (keys, quotas, retries, timeouts, which key to spend) is the provider's own, as its service
 * has its own quotas and errors. The pattern: docs/ai.md.
 */
export interface Provider {
  ask(request: ModelRequest, options: AskOptions): Promise<Answered>;
}

/**
 * How soon an answer is needed. Within `targetMs` if it can: the provider may spend (a paid key)
 * to get it then; Infinity never spends. After `limitMs` it gives up, whatever is left to try.
 */
export interface Urgency {
  targetMs: number;
  limitMs: number;
}

/**
 * A file the request names by id (a Part `{ file }`), as its bytes and type; null when it is
 * gone. The caller's: the lab's from its database, the tool's from disk, each prepared as the
 * task says (photos shrunk).
 */
export type FileSource = (id: string) => Promise<Blob | null>;

/**
 * What the provider is doing, for a caller to show: sending a try, or waiting before the next
 * because the service is busy, a quota is used up, or an answer is slow.
 */
export interface Progress {
  why: 'sending' | 'busy' | 'quota' | 'slow';
  /** How long until the next try; 0 when sending. */
  waitMs: number;
}

export interface AskOptions {
  urgency: Urgency;
  files: FileSource;
  onProgress?: (progress: Progress) => void;
  /** Gives up when aborted: no more tries, the one on its way cancelled. */
  signal?: AbortSignal;
}

/** One try, as logged: which key (the provider's label for it), when, how long, why it failed. */
export interface Attempt {
  key: string;
  /** The key's last 4 characters: which real key it was, whatever its label. */
  keyEnd?: string;
  /** When it was sent, in ms since the request was asked. */
  at?: number;
  ms: number;
  error?: string;
  /** Why a costlier key was asked (the provider's words: Gemini's Key 2, plan.ts Why). */
  why?: string;
  /** Given up because another try answered first, or the caller aborted. */
  cancelled?: boolean;
}

/** A reply, with every try it took, the one that answered last. */
export type Answered = Reply & { attempts: Attempt[] };
