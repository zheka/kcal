import { toBase64 } from '../image.ts';
import { ModelError, type Config, type ModelRequest, type Reply } from '../model.ts';
import type { FileSource } from '../provider.ts';

/**
 * Gemini's wire: one request to generateContent with one key, and its reply read back, an error
 * classified (worth trying again or not). Which key, when and how often is the plan's (plan.ts,
 * run by index.ts).
 */

const API = 'https://generativelanguage.googleapis.com/v1beta';

/** Statuses of an overloaded, rate-limited or timed-out Gemini: worth trying again later. */
const BUSY = [429, 500, 503, 504];

/**
 * A try that got no usable reply. `busy`: worth another try a little later (an overloaded or
 * rate-limited Gemini, no answer in time, unreachable); `cancelled`: aborted by the caller;
 * `reply`: what came back anyway.
 */
export class GeminiError extends Error {
  readonly busy: boolean;
  readonly cancelled: boolean;
  readonly reply: Omit<Reply, 'text'> | undefined;
  constructor(
    message: string,
    o: { busy?: boolean; cancelled?: boolean; reply?: Omit<Reply, 'text'> } = {},
  ) {
    super(message);
    this.busy = o.busy ?? false;
    this.cancelled = o.cancelled ?? false;
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
    if (o.signal?.aborted) throw new GeminiError('cancelled', { cancelled: true });
    // timed out or unreachable: worth another try, as a 503 is
    throw new GeminiError(
      controller.signal.aborted
        ? `no answer within ${o.timeoutMs / 1000} s`
        : `couldn’t reach Gemini (${String(err)})`,
      { busy: true },
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
  error?: { message?: string };
}

/** Gemini's answer as a Reply, or a GeminiError saying why there is none. */
export function readReply(status: number, text: string): Reply {
  let body: Body;
  try {
    body = JSON.parse(text) as Body;
  } catch {
    const what = text.trim() ? text.trim().slice(0, 300) : 'an empty reply';
    throw new GeminiError(`Gemini ${status}: ${what}`, { busy: BUSY.includes(status) });
  }
  if (status < 200 || status >= 300) {
    throw new GeminiError(`Gemini ${status}: ${body.error?.message ?? 'error'}`, {
      busy: BUSY.includes(status),
    });
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
