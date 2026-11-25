import { toBase64 } from '../image.ts';
import { ModelError, type Config, type ModelRequest, type Reply } from '../model.ts';
import type { FileSource } from '../provider.ts';

/**
 * Gemini's wire: one request to generateContent with one key, and its reply read back, an error
 * classified (busy, a quota, the key's, final). Which key, when and how often is the plan's (plan.ts,
 * run by index.ts).
 */

const API = 'https://generativelanguage.googleapis.com/v1beta';

/** Statuses of an overloaded or timed-out Gemini: worth trying again later. */
const BUSY = [500, 502, 503, 504];

/**
 * Why a try got no usable reply, as the plan treats it:
 * - `busy`: an overloaded Gemini, no answer in time, unreachable: worth another try a little later;
 * - `quota`: a rate limit (429): the key cools for a while (`quota` says how long);
 * - `key`: the key itself: invalid, expired, not allowed, out of credit: the user has to act;
 * - `final`: the request itself (a bad schema, say): no other try would do better;
 * - `cancelled`: aborted by the caller, or because another try answered.
 */
export type Failure = 'busy' | 'quota' | 'key' | 'final' | 'cancelled';

/** A try that got no usable reply: why, and what came back anyway. */
export class GeminiError extends Error {
  readonly kind: Failure;
  /** A quota error's: whether it is the day's, and how long Gemini says to wait. */
  readonly quota: { daily: boolean; retryMs?: number } | undefined;
  readonly reply: Omit<Reply, 'text'> | undefined;
  constructor(
    message: string,
    o: {
      kind?: Failure;
      quota?: GeminiError['quota'];
      reply?: Omit<Reply, 'text'> | undefined;
    } = {},
  ) {
    super(message);
    this.kind = o.kind ?? 'final';
    this.quota = o.quota;
    this.reply = o.reply;
  }
}

/**
 * Sends a request body (requestBody) to the model with this key. A try taking longer than
 * `timeoutMs` is given up, as busy; one aborted by `signal`, as cancelled.
 */
export async function send(
  key: string,
  model: string,
  body: string,
  o: { timeoutMs: number; signal?: AbortSignal | undefined },
): Promise<Reply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  const cancel = () => controller.abort();
  o.signal?.addEventListener('abort', cancel);
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
      signal: controller.signal,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body,
    });
    text = await response.text();
  } catch (err) {
    if (o.signal?.aborted) throw new GeminiError('cancelled', { kind: 'cancelled' });
    // timed out or unreachable: worth another try, as a 503 is
    throw new GeminiError(
      controller.signal.aborted
        ? `no answer within ${o.timeoutMs / 1000} s`
        : `couldn’t reach Gemini (${String(err)})`,
      { kind: 'busy' },
    );
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', cancel);
  }
  return readReply(response.status, text);
}

/**
 * Gemini's request body for a ModelRequest, with each file's data inline. A file that is gone:
 * nothing can be sent.
 */
export async function requestBody(request: ModelRequest, files: FileSource): Promise<object> {
  const parts = await Promise.all(
    request.content.map(async (part) => {
      if ('text' in part) return { text: part.text };
      const blob = await files(part.file);
      if (!blob) throw new ModelError('a file is gone', { sent: false });
      return {
        inline_data: {
          mime_type: blob.type || 'application/octet-stream',
          data: await toBase64(blob),
        },
      };
    }),
  );
  return {
    ...(request.instructions && { systemInstruction: { parts: [{ text: request.instructions }] } }),
    contents: [{ role: 'user', parts }],
    generationConfig: generationConfig(request.config),
  };
}

function generationConfig({ schema, schemaFormat, temperature, thinking }: Config): object {
  return {
    responseMimeType: 'application/json',
    ...(schemaFormat === 'json' ? { responseJsonSchema: schema } : { responseSchema: schema }),
    ...(temperature !== null && { temperature }),
    ...(thinking === 'off' && { thinkingConfig: { thinkingBudget: 0 } }),
    ...(thinking !== 'off' &&
      thinking !== 'default' && { thinkingConfig: { thinkingLevel: thinking } }),
  };
}

interface Body {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
  error?: ErrorBody;
}

/** Google's error: its message, and details that say which quota, how long to wait, why. */
interface ErrorBody {
  message?: string;
  details?: {
    reason?: string;
    retryDelay?: string;
    violations?: { quotaId?: string; quotaMetric?: string }[];
  }[];
}

/**
 * What kind of failure a status and error are (Failure). A key error: 401, any 403 (not allowed,
 * blocked), a 400 about the API key, a 429 of a prepaid account out of credit (it won't pass
 * until topped up, and no other 429 is about billing, though their message mentions it). A
 * quota's: the day's when a violated quota is per day; its wait from RetryInfo.
 */
export function classify(
  status: number,
  error: ErrorBody | undefined,
): { kind: Failure; quota?: { daily: boolean; retryMs?: number } } {
  const message = error?.message ?? '';
  const details = Array.isArray(error?.details) ? error.details : [];
  const reasons = details.map((d) => d.reason ?? '');
  if (status === 401 || status === 403) return { kind: 'key' };
  if (status === 400 && (reasons.some((r) => r.startsWith('API_KEY_')) || /api key/i.test(message)))
    return { kind: 'key' };
  if (status === 429) {
    if (
      reasons.some((r) => r.includes('BILLING')) ||
      /prepayment|credits are depleted/i.test(message)
    )
      return { kind: 'key' };
    const daily = details.some((d) =>
      (d.violations ?? []).some((v) => /PerDay/i.test(`${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`)),
    );
    const retryMs = details.map((d) => seconds(d.retryDelay)).find((ms) => ms !== undefined);
    return { kind: 'quota', quota: { daily, ...(retryMs !== undefined && { retryMs }) } };
  }
  return { kind: BUSY.includes(status) ? 'busy' : 'final' };
}

/** A Duration as Google writes it (`37s`, `0.5s`), in ms. */
function seconds(duration: string | undefined): number | undefined {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(duration ?? '');
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
}

/** Gemini's answer as a Reply, or a GeminiError saying why there is none. */
export function readReply(status: number, text: string): Reply {
  let body: Body;
  try {
    body = JSON.parse(text) as Body;
  } catch {
    const what = text.trim() ? text.trim().slice(0, 300) : 'an empty reply';
    throw new GeminiError(`Gemini ${status}: ${what}`, classify(status, undefined));
  }
  if (status < 200 || status >= 300) {
    throw new GeminiError(
      `Gemini ${status}: ${body.error?.message ?? 'error'}`,
      classify(status, body.error),
    );
  }
  const usage = body.usageMetadata;
  const about = {
    ...(body.modelVersion && { model: body.modelVersion }),
    ...(usage && {
      tokens: {
        input: usage.promptTokenCount ?? 0,
        output: usage.candidatesTokenCount ?? 0,
        ...(usage.thoughtsTokenCount && { thinking: usage.thoughtsTokenCount }),
      },
    }),
  };
  const candidate = body.candidates?.[0];
  if (!candidate) {
    const blocked = body.promptFeedback?.blockReason;
    throw new GeminiError(blocked ? `prompt blocked: ${blocked}` : 'no answer: no candidates', {
      reply: about,
    });
  }
  return {
    ...about,
    ...(candidate.finishReason && { stop: stopReason(candidate.finishReason) }),
    text: (candidate.content?.parts ?? [])
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text!),
  };
}

function stopReason(reason: string): string {
  const known: Record<string, string> = { STOP: 'end', MAX_TOKENS: 'max_tokens', SAFETY: 'safety' };
  return known[reason] ?? `other: ${reason}`;
}
