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

const APP = { targetMs: 10_000, limitMs: 30_000 };
const LAB = { targetMs: 30_000, limitMs: 90_000 };
const KEYS = { key: 'cheap-aaaa', key2: 'reliable-bbbb' };
const quota = (o: { daily?: boolean; retryDelay?: string } = {}) => ({
  error: {
    message: 'You exceeded your current quota',
    details: [
      { violations: [{ quotaId: `GenerateRequestsPer${o.daily ? 'Day' : 'Minute'}-FreeTier` }] },
      ...(o.retryDelay ? [{ retryDelay: o.retryDelay }] : []),
    ],
  },
});
const failed = (p: Promise<unknown>) => p.catch((e: unknown) => e as ModelError);

describe('asking Gemini', () => {
  it('asks with Key, and logs which key, its end, when and how long', async () => {
    const sent = fakeFetch();
    const { g } = gemini(KEYS);
    expect(await g.ask(REQUEST, options())).toEqual({
      stop: 'end',
      text: ['{}'],
      attempts: [{ key: 'key', keyEnd: 'aaaa', at: 0, ms: 0 }],
    });
    expect(sent).toEqual(['cheap-aaaa']);
  });

  it('asks with Key 2 when there is no Key, saying why', async () => {
    const sent = fakeFetch();
    const { g } = gemini({ key: '', key2: 'reliable-bbbb' });
    expect((await g.ask(REQUEST, options())).attempts).toEqual([
      { key: 'key2', keyEnd: 'bbbb', at: 0, ms: 0, why: 'only' },
    ]);
    expect(sent).toEqual(['reliable-bbbb']);
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

  it('without a target, tries a busy Key again after a wait, never Key 2', async () => {
    const sent = fakeFetch([503, BUSY], [500, BUSY]);
    const { g, time } = gemini(KEYS);
    const progress: Progress[] = [];
    const answered = await g.ask(REQUEST, options({ onProgress: (p) => progress.push(p) }));
    expect(answered.attempts).toEqual([
      { key: 'key', keyEnd: 'aaaa', at: 0, ms: 0, error: 'Gemini 503: overloaded' },
      { key: 'key', keyEnd: 'aaaa', at: 5_000, ms: 0, error: 'Gemini 500: overloaded' },
      { key: 'key', keyEnd: 'aaaa', at: 20_000, ms: 0 },
    ]);
    expect(sent).toEqual(['cheap-aaaa', 'cheap-aaaa', 'cheap-aaaa']);
    expect(time.waits).toEqual([5_000, 15_000]);
    expect(progress).toEqual([
      { why: 'sending', waitMs: 0 },
      { why: 'busy', waitMs: 5_000 },
      { why: 'sending', waitMs: 0 },
      { why: 'busy', waitMs: 15_000 },
      { why: 'sending', waitMs: 0 },
    ]);
  });

  it('with a target Key can’t make again, asks Key 2 at once', async () => {
    const sent = fakeFetch([503, BUSY]);
    const { g, time } = gemini(KEYS);
    const answered = await g.ask(REQUEST, options({ urgency: APP }));
    expect(answered.attempts).toEqual([
      { key: 'key', keyEnd: 'aaaa', at: 0, ms: 0, error: 'Gemini 503: overloaded' },
      { key: 'key2', keyEnd: 'bbbb', at: 0, ms: 0, why: 'busy' },
    ]);
    expect(sent).toEqual(['cheap-aaaa', 'reliable-bbbb']);
    expect(time.waits).toEqual([]);
  });

  it('cools a key over its quota, across requests, as long as Gemini says', async () => {
    fakeFetch([429, quota({ retryDelay: '20s' })]);
    const { g, time } = gemini(KEYS);
    const progress: Progress[] = [];
    // the lab waits 20 s for Key: it can still answer by 30 s
    const lab = await g.ask(
      REQUEST,
      options({ urgency: LAB, onProgress: (p) => progress.push(p) }),
    );
    expect(lab.attempts.map((a) => [a.key, a.at])).toEqual([
      ['key', 0],
      ['key', 20_000],
    ]);
    expect(progress).toContainEqual({ why: 'quota', waitMs: 20_000 });

    // no delay given: a minute, past the lab's target: Key 2; and for the next request too
    fakeFetch([429, quota()]);
    const cooled = await g.ask(REQUEST, options({ urgency: LAB }));
    expect(cooled.attempts.map((a) => [a.key, a.why])).toEqual([
      ['key', undefined],
      ['key2', 'cooling'],
    ]);
    const next = await g.ask(REQUEST, options({ urgency: APP }));
    expect(next.attempts).toEqual([{ key: 'key2', keyEnd: 'bbbb', at: 0, ms: 0, why: 'cooling' }]);
    expect(time.waits).toEqual([20_000]);
  });

  it('a key changed while the old one cools is asked at once', async () => {
    fakeFetch([429, quota({ daily: true })]);
    const keys = { ...KEYS };
    const time = fakeTime();
    const g = createGemini({ keys: async () => keys, now: time.now, wait: time.wait });
    // no target: Key cools for an hour, past the limit: given up
    expect(await failed(g.ask(REQUEST, options()))).toMatchObject({
      message: 'Gemini 429: You exceeded your current quota',
      options: { sent: true },
    });
    keys.key = 'fresh-cccc';
    expect((await g.ask(REQUEST, options())).attempts).toEqual([
      { key: 'key', keyEnd: 'cccc', at: 0, ms: 0 },
    ]);
  });

  it('fails on a key error, naming the key, without asking the other', async () => {
    const sent = fakeFetch(
      [503, BUSY],
      [400, { error: { message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } }],
    );
    const err = await failed(gemini(KEYS).g.ask(REQUEST, options({ urgency: APP })));
    expect(err).toBeInstanceOf(ModelError);
    expect(err).toMatchObject({
      message: 'Key 2: Gemini 400: API key not valid.',
      options: { sent: true, key: 'key2' },
    });
    expect(sent).toEqual(['cheap-aaaa', 'reliable-bbbb']);

    fakeFetch([429, { error: { message: 'Your prepayment credits are depleted.' } }]);
    const credit = await failed(gemini({ key: '', key2: 'k2' }).g.ask(REQUEST, options()));
    expect(credit).toMatchObject({ options: { key: 'key2' } });
  });

  it('gives up at once on a final error, and when the limit is near', async () => {
    fakeFetch([400, { error: { message: 'bad' } }]);
    const err = await failed(gemini(KEYS).g.ask(REQUEST, options()));
    expect(err).toMatchObject({
      message: 'Gemini 400: bad',
      options: { sent: true, attempts: [{ key: 'key', error: 'Gemini 400: bad' }] },
    });

    fakeFetch([503, BUSY], [503, BUSY], [503, BUSY]);
    const short = options({ urgency: { targetMs: Infinity, limitMs: 20_000 } });
    const tries = await gemini({ key: 'k', key2: '' })
      .g.ask(REQUEST, short)
      .catch((e: ModelError) => e.options.attempts);
    // a second try after 5 s; a third, 15 s later, would start at the limit
    expect(tries).toHaveLength(2);
  });

  it('keeps Key to its pace across requests; the app asks Key 2 meanwhile', async () => {
    fakeFetch();
    const { g, time } = gemini(KEYS);
    for (let i = 0; i < PER_MINUTE; i++) await g.ask(REQUEST, options());
    const app = await g.ask(REQUEST, options({ urgency: APP }));
    expect(app.attempts.map((a) => [a.key, a.why])).toEqual([['key2', 'paced']]);
    const progress: Progress[] = [];
    await g.ask(REQUEST, options({ onProgress: (p) => progress.push(p) }));
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
