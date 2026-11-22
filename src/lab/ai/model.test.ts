import { describe, expect, it, vi } from 'vitest';
import { ModelError, run, type ModelRequest, type Reply } from './model';

const REQUEST: ModelRequest = {
  model: 'm',
  instructions: '',
  content: [{ text: 'hi' }],
  config: { schema: {}, temperature: null, thinking: 'default' },
};
const ABOUT = { model: 'm-001', stop: 'end', tokens: { input: 10, output: 5 } };
const reply = (...text: string[]): Reply => ({ ...ABOUT, text });
const noCheck = () => [];
// a clock that moves 100 ms per reading, and waits that take no time
const clock = () => {
  let t = 0;
  return () => (t += 100);
};
const go = (send: () => Promise<Reply>, more: Partial<Parameters<typeof run>[1]> = {}) =>
  run(REQUEST, { send, check: noCheck, wait: async () => {}, now: clock(), ...more });

describe('running a request', () => {
  it('gives the answer decoded, with what the reply says', async () => {
    expect(await go(async () => reply('{"a":', '1}'))).toEqual({
      ...ABOUT,
      ms: 100,
      answer: { a: 1 },
    });
  });

  it('keeps text parts that aren’t JSON as they came', async () => {
    expect(await go(async () => reply('{"a":', '1'))).toEqual({
      ...ABOUT,
      ms: 100,
      undecoded: ['{"a":', '1'],
      error: 'answer isn’t JSON',
    });
    expect(await go(async () => ({ ...ABOUT, stop: 'safety', text: [] }))).toMatchObject({
      error: 'no answer: safety',
    });
  });

  it('keeps an answer that doesn’t fit the schema, saying why it isn’t used', async () => {
    const response = await go(async () => reply('{"a":1}'), { check: () => ['no items'] });
    expect(response).toMatchObject({
      answer: { a: 1 },
      error: 'answer doesn’t fit the schema: no items',
    });
  });

  it('tries a busy model again, listing what it said', async () => {
    const send = vi
      .fn<() => Promise<Reply>>()
      .mockRejectedValueOnce(new ModelError('Gemini 503: overloaded', { sent: true, busy: true }))
      .mockResolvedValueOnce(reply('{}'));
    const onRetry = vi.fn();
    expect(await go(send, { onRetry })).toEqual({
      ...ABOUT,
      ms: 100,
      retried: ['Gemini 503: overloaded'],
      answer: {},
    });
    expect(onRetry).toHaveBeenCalledWith(2, 3, 5000);
  });

  it('gives up after the last try, and at once on other errors', async () => {
    const busy = new ModelError('Gemini 503: overloaded', { sent: true, busy: true });
    expect(
      await go(async () => {
        throw busy;
      }),
    ).toEqual({
      ms: 100,
      retried: ['Gemini 503: overloaded', 'Gemini 503: overloaded'],
      error: 'Gemini 503: overloaded',
    });
    const bad = new ModelError('Gemini 400: bad', { sent: true, reply: { model: 'm-001' } });
    expect(
      await go(async () => {
        throw bad;
      }),
    ).toEqual({ model: 'm-001', ms: 100, error: 'Gemini 400: bad' });
  });

  it('gives nothing to log when nothing was sent, saying why', async () => {
    const notSent = vi.fn();
    expect(
      await go(
        async () => {
          throw new ModelError('no API key', { sent: false });
        },
        { notSent },
      ),
    ).toBeNull();
    expect(notSent).toHaveBeenCalledWith('no API key');
  });
});
