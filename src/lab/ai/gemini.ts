import { ModelError, type Config, type ModelRequest, type Reply } from './model';

/**
 * Gemini, called straight from the browser with the user's own key (kept on the device): the
 * adapter between a ModelRequest (model.ts) and Gemini's generateContent.
 */

const API = 'https://generativelanguage.googleapis.com/v1beta';

/** How long a request may take before it is given up. */
export const TIMEOUT_MS = 120_000;

/** Statuses of an overloaded, rate-limited or timed-out Gemini: worth trying again later. */
const BUSY = [429, 500, 503, 504];

/** A photo's data, by its id in the request (null when it is gone). */
export type PhotoData = (id: string) => Promise<{ type: string; base64: string } | null>;

/** Sends requests to Gemini with this key; photos are loaded by id as they are sent. */
export function gemini(key: string, photo: PhotoData, timeoutMs = TIMEOUT_MS) {
  return async (request: ModelRequest): Promise<Reply> => {
    if (!key) throw new ModelError('no API key', { sent: false });
    if (!navigator.onLine) throw new ModelError('offline', { sent: false });
    const body = JSON.stringify(await requestBody(request, photo));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    let text: string;
    try {
      response = await fetch(`${API}/models/${encodeURIComponent(request.model)}:generateContent`, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body,
      });
      text = await response.text();
    } catch (err) {
      throw new ModelError(
        controller.signal.aborted
          ? `no answer within ${timeoutMs / 1000} s`
          : `couldn’t reach Gemini (${String(err)})`,
        { sent: true },
      );
    } finally {
      clearTimeout(timer);
    }
    return readReply(response.status, text);
  };
}

/** Gemini's request body for a ModelRequest, with each photo's data. */
export async function requestBody(request: ModelRequest, photo: PhotoData): Promise<object> {
  const parts = await Promise.all(
    request.content.map(async (part) => {
      if ('text' in part) return { text: part.text };
      const data = await photo(part.image);
      if (!data) throw new ModelError('a photo of the meal is gone', { sent: false });
      return { inline_data: { mime_type: data.type, data: data.base64 } };
    }),
  );
  return {
    ...(request.instructions && { systemInstruction: { parts: [{ text: request.instructions }] } }),
    contents: [{ role: 'user', parts }],
    generationConfig: generationConfig(request.config),
  };
}

function generationConfig({ schema, temperature, thinking }: Config): object {
  return {
    responseMimeType: 'application/json',
    responseSchema: schema,
    ...(temperature !== null && { temperature }),
    ...(thinking === 'off' && { thinkingConfig: { thinkingBudget: 0 } }),
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

/** Gemini's answer as a Reply, or a ModelError saying why there is none. */
export function readReply(status: number, text: string): Reply {
  let body: Body;
  try {
    body = JSON.parse(text) as Body;
  } catch {
    const what = text.trim() ? text.trim().slice(0, 300) : 'an empty reply';
    throw new ModelError(`Gemini ${status}: ${what}`, { sent: true, busy: BUSY.includes(status) });
  }
  if (status < 200 || status >= 300) {
    throw new ModelError(`Gemini ${status}: ${body.error?.message ?? 'error'}`, {
      sent: true,
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
    throw new ModelError(blocked ? `prompt blocked: ${blocked}` : 'no answer: no candidates', {
      sent: true,
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

/** The models this key can use to answer (generateContent), as ids like `gemini-…-flash`. */
export async function listModels(key: string): Promise<string[]> {
  const response = await fetch(`${API}/models?pageSize=1000`, {
    headers: { 'x-goog-api-key': key },
  });
  const body = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
}
