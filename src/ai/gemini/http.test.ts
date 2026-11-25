import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelError, type ModelRequest } from '../model';
import { classify, GeminiError, readReply, requestBody, send } from './http';

const REQUEST: ModelRequest = {
  model: 'gemini-x',
  instructions: '',
  content: [{ text: 'the prompt' }, { file: 'p1' }, { text: 'chicken meatballs' }],
  config: { schema: { type: 'OBJECT' }, temperature: 0.2, thinking: 'default' },
};
// three zero bytes: AAAA in base64
const files = async (id: string) =>
  id === 'p1' ? new Blob([new Uint8Array(3)], { type: 'image/jpeg' }) : null;

afterEach(() => vi.unstubAllGlobals());

describe('the request to Gemini', () => {
  it('has the content as parts, in order, with each file’s data, and the config', async () => {
    expect(await requestBody(REQUEST, files)).toEqual({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'the prompt' },
            { inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } },
            { text: 'chicken meatballs' },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT' },
        temperature: 0.2,
      },
    });
  });

  it('sends instructions as the system instruction, and turns thinking off when asked', async () => {
    const body = await requestBody(
      {
        ...REQUEST,
        instructions: 'be brief',
        config: { ...REQUEST.config, temperature: null, thinking: 'off' },
      },
      files,
    );
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: 'be brief' }] },
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    expect(body).not.toHaveProperty('generationConfig.temperature');
  });

  it('can’t be made with a file gone: nothing is sent', async () => {
    const err: unknown = await requestBody(
      { ...REQUEST, content: [{ file: 'gone' }] },
      files,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ModelError);
    expect(err).toMatchObject({ options: { sent: false } });
  });
});

describe('a try', () => {
  const hang = (_url: string, init: RequestInit) =>
    new Promise((_, reject) =>
      init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
    );

  it('sends the body to the model with the key', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ candidates: [{}] })));
    vi.stubGlobal('fetch', fetch);
    await send('k', 'gemini-x', '{}', { timeoutMs: 1000 });
    expect(fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
        headers: expect.objectContaining({ 'x-goog-api-key': 'k' }),
      }),
    );
  });

  it('gives up when Gemini doesn’t answer in time, as busy: worth another try', async () => {
    vi.stubGlobal('fetch', hang);
    const err: unknown = await send('k', 'm', '{}', { timeoutMs: 50 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err).toMatchObject({ message: 'no answer within 0.05 s', kind: 'busy' });
  });

  it('is cancelled when the caller aborts, not busy', async () => {
    vi.stubGlobal('fetch', hang);
    const abort = new AbortController();
    const sent = send('k', 'm', '{}', { timeoutMs: 10_000, signal: abort.signal });
    abort.abort();
    expect(await sent.catch((e: unknown) => e)).toMatchObject({ kind: 'cancelled' });
  });
});

const error = (status: number, text: string) => {
  try {
    readReply(status, text);
  } catch (err) {
    return err as GeminiError;
  }
  throw new Error('no error');
};

describe('Gemini’s reply', () => {
  it('gives the answer’s text parts as received, without thoughts, and what it says', () => {
    const body = {
      candidates: [
        {
          content: {
            parts: [{ text: 'hmm', thought: true }, { text: '{"a":' }, { text: '1}' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 900, thoughtsTokenCount: 640 },
      modelVersion: 'gemini-x-001',
    };
    expect(readReply(200, JSON.stringify(body))).toEqual({
      model: 'gemini-x-001',
      stop: 'end',
      tokens: { input: 2100, output: 900, thinking: 640 },
      text: ['{"a":', '1}'],
    });
  });

  it('names why it stopped', () => {
    const stop = (finishReason: string) =>
      readReply(200, JSON.stringify({ candidates: [{ finishReason }] })).stop;
    expect(stop('MAX_TOKENS')).toBe('max_tokens');
    expect(stop('SAFETY')).toBe('safety');
    expect(stop('RECITATION')).toBe('other: RECITATION');
  });

  it('is an error when Gemini says so: busy ones are worth trying again', () => {
    const busy = error(503, JSON.stringify({ error: { message: 'The model is overloaded.' } }));
    expect(busy.message).toBe('Gemini 503: The model is overloaded.');
    expect(busy.kind).toBe('busy');
    expect(error(400, '{"error":{"message":"Invalid schema"}}').kind).toBe('final');
    expect(error(502, '<html>Bad Gateway</html>').message).toBe(
      'Gemini 502: <html>Bad Gateway</html>',
    );
    expect(error(200, '').message).toBe('Gemini 200: an empty reply');
    const blocked = error(200, JSON.stringify({ promptFeedback: { blockReason: 'OTHER' } }));
    expect(blocked.message).toBe('prompt blocked: OTHER');
    expect(blocked.kind).toBe('final');
  });

  it('is a quota’s, with how long to wait, or a key’s, as its error says', () => {
    const quota = error(
      429,
      JSON.stringify({
        error: {
          message: 'You exceeded your current quota, please check your plan and billing details.',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
              violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }],
            },
            { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37.5s' },
          ],
        },
      }),
    );
    expect(quota).toMatchObject({ kind: 'quota', quota: { daily: false, retryMs: 37_500 } });
    expect(quota.message).toMatch(/^Gemini 429: You exceeded/);
  });
});

describe('a failure’s kind', () => {
  const day = {
    details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }],
  };
  it.each([
    ['an overloaded Gemini', 503, { message: 'The model is overloaded.' }, { kind: 'busy' }],
    ['a gateway’s error, without a body', 502, undefined, { kind: 'busy' }],
    [
      'a minute’s quota, no delay given',
      429,
      { message: 'quota' },
      { kind: 'quota', quota: { daily: false } },
    ],
    ['a day’s quota', 429, day, { kind: 'quota', quota: { daily: true } }],
    ['a 429 without a body', 429, undefined, { kind: 'quota', quota: { daily: false } }],
    [
      'a prepaid account out of credit',
      429,
      { message: 'Your prepayment credits are depleted.' },
      { kind: 'key' },
    ],
    ['a billing reason', 429, { details: [{ reason: 'BILLING_DISABLED' }] }, { kind: 'key' }],
    [
      'an invalid key',
      400,
      {
        message: 'API key not valid. Please pass a valid API key.',
        details: [{ reason: 'API_KEY_INVALID' }],
      },
      { kind: 'key' },
    ],
    [
      'an expired key, by its message',
      400,
      { message: 'API key expired. Please renew the API key.' },
      { kind: 'key' },
    ],
    [
      'a key not allowed',
      403,
      { message: 'Method doesn’t allow unregistered callers.' },
      { kind: 'key' },
    ],
    ['unauthenticated', 401, undefined, { kind: 'key' }],
    ['a bad request', 400, { message: 'Invalid JSON payload received.' }, { kind: 'final' }],
    ['an unknown model', 404, { message: 'models/x is not found' }, { kind: 'final' }],
  ] as const)('%s', (_, status, body, expected) => {
    expect(classify(status, body as Parameters<typeof classify>[1])).toEqual(expected);
  });
});
