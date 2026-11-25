import { describe, expect, it, vi } from 'vitest';
import { ModelError, run, type ModelRequest } from './model';
import type { Answered, Provider } from './provider';

const REQUEST: ModelRequest = {
  model: 'm',
  instructions: '',
  content: [{ text: 'hi' }],
  config: { schema: {}, temperature: null, thinking: 'default' },
};
const ABOUT = { model: 'm-001', stop: 'end', tokens: { input: 10, output: 5 } };
const ONE = [{ key: 'key', ms: 80 }];
const reply = (...text: string[]): Answered => ({ ...ABOUT, text, attempts: ONE });
const noCheck = () => [];
// a clock that moves 100 ms per reading
const clock = () => {
  let t = 0;
  return () => (t += 100);
};
const provider = (ask: () => Promise<Answered>): Provider => ({ ask });
const go = (ask: () => Promise<Answered>, more: Partial<Parameters<typeof run>[1]> = {}) =>
  run(REQUEST, {
    provider: provider(ask),
    urgency: { targetMs: 10_000, limitMs: 40_000 },
    files: async () => null,
    check: noCheck,
    now: clock(),
    ...more,
  });

describe('running a request', () => {
  it('gives the answer decoded, with what the reply says and its tries', async () => {
    expect(await go(async () => reply('{"a":', '1}'))).toEqual({
      ...ABOUT,
      ms: 100,
      attempts: ONE,
      answer: { a: 1 },
    });
  });

  it('asks the provider with the urgency, files, progress and signal as given', async () => {
    const ask = vi.fn(async () => reply('{}'));
    const files = async () => null;
    const onProgress = () => {};
    const signal = new AbortController().signal;
    const urgency = { targetMs: Infinity, limitMs: 1000 };
    await run(REQUEST, { provider: { ask }, urgency, files, onProgress, signal, check: noCheck });
    expect(ask).toHaveBeenCalledWith(REQUEST, { urgency, files, onProgress, signal });
  });

  it('keeps text parts that aren’t JSON as they came', async () => {
    expect(await go(async () => reply('{"a":', '1'))).toEqual({
      ...ABOUT,
      ms: 100,
      attempts: ONE,
      undecoded: ['{"a":', '1'],
      error: 'answer isn’t JSON',
    });
    expect(
      await go(async () => ({ ...ABOUT, stop: 'safety', text: [], attempts: ONE })),
    ).toMatchObject({ error: 'no answer: safety' });
  });

  it('keeps an answer that doesn’t fit the schema, saying why it isn’t used', async () => {
    const response = await go(async () => reply('{"a":1}'), { check: () => ['no items'] });
    expect(response).toMatchObject({
      answer: { a: 1 },
      error: 'answer doesn’t fit the schema: no items',
    });
  });

  it('gives the provider’s error, with what came back and the tries', async () => {
    const attempts = [
      { key: 'key', ms: 50, error: 'Gemini 503: overloaded' },
      { key: 'key', ms: 60, error: 'Gemini 400: bad' },
    ];
    const bad = new ModelError('Gemini 400: bad', {
      sent: true,
      reply: { model: 'm-001' },
      attempts,
    });
    expect(
      await go(async () => {
        throw bad;
      }),
    ).toEqual({ model: 'm-001', ms: 100, attempts, error: 'Gemini 400: bad' });
  });

  it('gives nothing to log when nothing was sent, saying why', async () => {
    const notSent = vi.fn();
    expect(
      await go(
        async () => {
          throw new ModelError('no Gemini key', { sent: false });
        },
        { notSent },
      ),
    ).toBeNull();
    expect(notSent).toHaveBeenCalledWith('no Gemini key');
  });
});
