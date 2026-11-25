import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelError, type ModelRequest } from '../model';
import type { AskOptions, Progress } from '../provider';
import { createGemini, type GeminiKeys, PER_MINUTE } from './index';

const REQUEST: ModelRequest = {
  model: 'gemini-x',
  instructions: '',
  content: [{ text: 'hi' }],
  config: { schema: {}, temperature: null, thinking: 'default' },
};
const OK = { candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }] };
const BUSY = { error: { message: 'overloaded' } };

/** Gemini answering each request in turn: a status and a body; the keys it was sent with. */
function fakeFetch(...replies: [number, object][]) {
  const keys: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      keys.push((init.headers as Record<string, string>)['x-goog-api-key']!);
      const [status, body] = replies.shift() ?? [200, OK];
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return keys;
}

/** A clock that only moves when waited on; each wait, as asked. */
function fakeTime() {
  let t = 0;
  const waits: number[] = [];
  return {
    now: () => t,
    wait: async (ms: number) => {
      waits.push(ms);
      t += ms;
    },
    waits,
  };
}

const gemini = (keys: GeminiKeys, more: { online?: () => boolean } = {}) => {
  const time = fakeTime();
  const g = createGemini({ keys: async () => keys, now: time.now, wait: time.wait, ...more });
  return { g, time };
};
const options = (more: Partial<AskOptions> = {}): AskOptions => ({
  urgency: { targetMs: Infinity, limitMs: 300_000 },
  files: async () => null,
  ...more,
});

afterEach(() => vi.unstubAllGlobals());

describe('asking Gemini', () => {
  it('asks with Key, and says which key answered', async () => {
    const sent = fakeFetch();
    const { g } = gemini({ key: 'cheap', key2: 'reliable' });
    expect(await g.ask(REQUEST, options())).toEqual({
      stop: 'end',
      text: ['{}'],
      attempts: [{ key: 'key', ms: 0 }],
    });
    expect(sent).toEqual(['cheap']);
  });

  it('asks with Key 2 when there is no Key', async () => {
    const sent = fakeFetch();
    const { g } = gemini({ key: '', key2: 'reliable' });
    expect((await g.ask(REQUEST, options())).attempts).toEqual([{ key: 'key2', ms: 0 }]);
    expect(sent).toEqual(['reliable']);
  });

  it('sends nothing without a key, offline, or with a file gone', async () => {
    fakeFetch();
    const notSent = { options: { sent: false } };
    await expect(gemini({ key: '', key2: '' }).g.ask(REQUEST, options())).rejects.toMatchObject({
      message: 'no Gemini key',
      ...notSent,
    });
    const offline = gemini({ key: 'k', key2: '' }, { online: () => false }).g;
    await expect(offline.ask(REQUEST, options())).rejects.toMatchObject({
      message: 'offline',
      ...notSent,
    });
    const withFile = { ...REQUEST, content: [{ file: 'gone' }] };
    await expect(gemini({ key: 'k', key2: '' }).g.ask(withFile, options())).rejects.toMatchObject(
      notSent,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tries a busy Gemini again after a wait, saying so', async () => {
    fakeFetch([503, BUSY], [429, BUSY]);
    const { g, time } = gemini({ key: 'k', key2: '' });
    const progress: Progress[] = [];
    const answered = await g.ask(REQUEST, options({ onProgress: (p) => progress.push(p) }));
    expect(answered.attempts).toEqual([
      { key: 'key', ms: 0, error: 'Gemini 503: overloaded' },
      { key: 'key', ms: 0, error: 'Gemini 429: overloaded' },
      { key: 'key', ms: 0 },
    ]);
    expect(time.waits).toEqual([5_000, 15_000]);
    expect(progress).toEqual([
      { why: 'sending', waitMs: 0 },
      { why: 'busy', waitMs: 5_000 },
      { why: 'sending', waitMs: 0 },
      { why: 'busy', waitMs: 15_000 },
      { why: 'sending', waitMs: 0 },
    ]);
  });

  it('gives up at once on an error that isn’t busy, and when the limit is near', async () => {
    fakeFetch([400, { error: { message: 'bad' } }]);
    const { g } = gemini({ key: 'k', key2: '' });
    const err: unknown = await g.ask(REQUEST, options()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ModelError);
    expect(err).toMatchObject({
      message: 'Gemini 400: bad',
      options: { sent: true, attempts: [{ key: 'key', ms: 0, error: 'Gemini 400: bad' }] },
    });

    fakeFetch([503, BUSY], [503, BUSY], [503, BUSY]);
    const short = options({ urgency: { targetMs: Infinity, limitMs: 20_000 } });
    const tries = await gemini({ key: 'k', key2: '' })
      .g.ask(REQUEST, short)
      .catch((e: ModelError) => e.options.attempts);
    // a second try after 5 s; a third, 15 s later, would start at the limit
    expect(tries).toHaveLength(2);
  });

  it('keeps to its pace across requests, saying so', async () => {
    fakeFetch();
    const { g, time } = gemini({ key: 'k', key2: '' });
    const progress: Progress[] = [];
    for (let i = 0; i <= PER_MINUTE; i++) {
      await g.ask(REQUEST, options({ onProgress: (p) => progress.push(p) }));
    }
    expect(time.waits).toEqual([60_000]);
    expect(progress).toContainEqual({ why: 'quota', waitMs: 60_000 });
  });

  it('stops when the caller aborts', async () => {
    fakeFetch([503, BUSY]);
    const { g } = gemini({ key: 'k', key2: '' });
    const abort = new AbortController();
    const asked = g.ask(
      REQUEST,
      options({ signal: abort.signal, onProgress: (p) => p.why === 'busy' && abort.abort() }),
    );
    await expect(asked).rejects.toMatchObject({
      message: 'cancelled',
      options: { sent: true, attempts: [{ error: 'Gemini 503: overloaded' }] },
    });
  });
});
