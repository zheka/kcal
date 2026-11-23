import { afterEach, describe, expect, it, vi } from 'vitest';
import { gemini, readReply, requestBody } from './gemini';
import { ModelError, type ModelRequest } from './model';

const REQUEST: ModelRequest = {
  model: 'gemini-x',
  instructions: '',
  content: [{ text: 'the prompt' }, { image: 'p1' }, { text: 'chicken meatballs' }],
  config: { schema: { type: 'OBJECT' }, temperature: 0.2, thinking: 'default' },
};
const photo = async (id: string) => (id === 'p1' ? { type: 'image/jpeg', base64: 'AAAA' } : null);

afterEach(() => vi.unstubAllGlobals());

describe('the request to Gemini', () => {
  it('has the content as parts, in order, with each photo’s data, and the config', async () => {
    expect(await requestBody(REQUEST, photo)).toEqual({
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
      photo,
    );
    expect(body).toMatchObject({
      systemInstruction: { parts: [{ text: 'be brief' }] },
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    });
    expect(body).not.toHaveProperty('generationConfig.temperature');
  });

  it('isn’t sent without a key, offline, or with a photo gone', async () => {
    const notSent = (err: unknown) => err instanceof ModelError && !err.options.sent;
    await expect(gemini('', photo, 1000)(REQUEST)).rejects.toSatisfy(notSent);
    await expect(
      gemini('k', photo, 1000)({ ...REQUEST, content: [{ image: 'gone' }] }),
    ).rejects.toSatisfy(notSent);
    vi.stubGlobal('navigator', { onLine: false });
    await expect(gemini('k', photo, 1000)(REQUEST)).rejects.toThrow('offline');
  });

  it('gives up when Gemini doesn’t answer in time, as busy: worth another try', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const err: unknown = await gemini('k', photo, 50)(REQUEST).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ModelError);
    expect(err).toMatchObject({ message: 'no answer within 0.05 s', options: { busy: true } });
  });
});

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
    const error = (status: number, text: string) => {
      try {
        readReply(status, text);
      } catch (err) {
        return err as ModelError;
      }
      throw new Error('no error');
    };
    const busy = error(503, JSON.stringify({ error: { message: 'The model is overloaded.' } }));
    expect(busy.message).toBe('Gemini 503: The model is overloaded.');
    expect(busy.options).toEqual({ sent: true, busy: true });
    expect(error(400, '{"error":{"message":"Bad key"}}').options.busy).toBe(false);
    expect(error(502, '<html>Bad Gateway</html>').message).toBe(
      'Gemini 502: <html>Bad Gateway</html>',
    );
    expect(error(200, '').message).toBe('Gemini 200: an empty reply');
    const blocked = error(200, JSON.stringify({ promptFeedback: { blockReason: 'OTHER' } }));
    expect(blocked.message).toBe('prompt blocked: OTHER');
  });
});
