# Asking a model

How the app, the lab and the command-line tools ask an AI model, and the pattern each provider
follows (Gemini now, others later). The code: `src/ai/`.

## Two kinds of settings

|                       | What                                                                  | Where                                                                           | Changes                         |
| --------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------- |
| **The task's**        | model, thinking, temperature, schema, prompt, photo size; **urgency** | `src/ai/tasks.ts`, the lab's `src/lab/meal/settings.ts`; sent with each request | in a build, after the bench     |
| **The environment's** | who pays: the API keys                                                | the device (the app's IndexedDB) or the tool's environment                      | any time, even during a request |

Why apart: a prompt is tuned to exactly its model, thinking and temperature, so they travel
together with the request and are never a user's or a device's setting. Keys are the only thing
a provider reads from its environment, and it reads them afresh before every try.

## How soon: the urgency

A task says how soon it needs the answer, never how to get it:

```ts
interface Urgency {
  targetMs: number; // answer within this if it can: the provider may spend (a paid key) to
  //                   meet it; Infinity never spends
  limitMs: number; //  give up after this, whatever is left to try
}
```

| Task                         | Target | Limit | Why                                                                  |
| ---------------------------- | ------ | ----- | -------------------------------------------------------------------- |
| The app's product form       | 10 s   | 40 s  | someone is waiting, and can type the values instead                  |
| The lab, the tool, the bench | ∞      | 5 min | tests: free, and runs comparable; a busy minute shouldn't lose a run |

Why two numbers: one budget can't say what happens past it (spend, give up, or keep waiting).
Why the task decides only these: retries, timeouts and which key to spend depend on the
provider's quotas and errors, which differ from provider to provider. Only the limit is a
promise; the target is a best effort (a paid key can be busy too).

## Layers

| Layer                                                   | Knows                                                                   | Doesn't know                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| The caller (a task: the lab's update, the tool's `ask`) | the request, the urgency, its files, how to show progress, where to log | keys, retries, the provider's errors |
| `run` (`model.ts`)                                      | JSON, the schema check, the response as logged                          | retries, keys, the provider          |
| `Provider` (`provider.ts`)                              | the interface: `ask(request, { urgency, files, onProgress, signal })`   | —                                    |
| A provider (`gemini/index.ts`)                          | its keys (from a key source), their pace, the plan, hedging, cancelling | what the task is                     |
| Its plan (`gemini/plan.ts`)                             | the strategy, pure: the next try (key, wait, timeout) or none           | the clock, the network               |
| Its wire (`gemini/http.ts`)                             | the service's request and reply; errors classified (busy or not)        | the strategy                         |

A usable reply is never asked again by `run`: an answer that isn't JSON or doesn't fit the
schema is the prompt's problem, not the provider's.

## The interface

```ts
interface Provider {
  ask(
    request: ModelRequest,
    o: {
      urgency: Urgency;
      files: FileSource; // (id) => Promise<Blob | null>: a part { file: id }'s bytes
      onProgress?: (p: Progress) => void;
      signal?: AbortSignal; // abort: no more tries, the one on its way cancelled
    },
  ): Promise<Reply & { attempts: Attempt[] }>;
}
interface Progress {
  why: 'sending' | 'busy' | 'quota' | 'slow';
  waitMs: number;
}
interface Attempt {
  key: string;
  ms: number;
  error?: string;
  hedged?: boolean;
  cancelled?: boolean;
}
```

- **Files by id.** A request's content is text and `{ file: id }` parts, so a request, as
  logged, never holds a file's data. The caller resolves an id to a `Blob` (its bytes and MIME
  type): the lab from its database, the tool from disk, each prepared as the task says (photos
  shrunk). The provider decides how to send it (inline now; an upload API for large ones
  later). Why per request and not per provider: a file belongs to the caller's request.
- **Progress is neutral:** what the provider is doing, never "try 2 of 6" (with an urgency the
  number of tries isn't known in advance); the caller words it.
- **Errors:** `ModelError` with `sent` (false: nothing to log: no key, offline, a file gone),
  `reply` (what came back anyway) and `attempts`.
- **The log** (`ModelResponse`): `ms` is the whole time, waits included; `attempts` each try in
  order, with the key that sent it (the provider's label: `key`, `key2`). Lab logs before
  2026-11-25 have `retried` (the busy errors) and `{ image: id }` parts instead.

## Keys: a key source

A provider is created once per tab or process, with a function that reads its keys:

```ts
createGemini({ keys: () => Promise<{ key: string; key2: string }> }); // '' when not set
```

|                                                   | Key (cheap)               | Key 2 (reliable)   |
| ------------------------------------------------- | ------------------------- | ------------------ |
| The app and the lab (`src/ai/browser.ts`)         | IndexedDB secret `gemini` | `gemini-2`         |
| The tools (`envGemini` in `scripts/meal-tool.ts`) | `GEMINI_API_KEY`          | `GEMINI_API_KEY_2` |

- **One instance per tab or process,** so what it knows of a key (its pace, later its
  cooldowns) holds for every request sent through it.
- **Read before every try,** so a key set or forgotten meanwhile (in another tab, the menu) is
  the one used.
- **Only keys, not a general config.** Why: a "provider config" would invite the model or
  thinking to be set per environment, apart from the prompt they're tuned with. A second real
  environment setting (a proxy URL, say) widens it then, renamed `account`.
- **Either key alone does everything;** neither: nothing is sent.
- **Key is free tier, Key 2 paid.** Running strictly free must stay possible (no paid spending
  piling up): leave Key 2 empty. Free-tier requests may be used by Google to improve its
  products. The fields say only "Cheap Gemini key" and "Reliable Gemini key". The two keys must
  come from different Google Cloud projects: quota and billing are per project.

## Adding a provider

1. `src/ai/<provider>/http.ts`: its request from a `ModelRequest` (files from the `FileSource`),
   its reply as a `Reply`, its errors classified (worth another try or not; later: which quota,
   retry after).
2. `src/ai/<provider>/plan.ts`: its strategy as a pure function, tested as a table.
3. `src/ai/<provider>/index.ts`: `create<Provider>({ keys })` → `Provider`, with its pace and
   what it learns of its keys.
4. Its keys: names in `src/ai/keys.ts` (`<provider>`, `<provider>-2`), its fields in Settings,
   its instance in `src/ai/browser.ts`, its environment variables in the tools.
5. `Provider` in `tasks.ts` gains its name; a task moves to it only through the bench, with its
   prompt.

## Gemini now

The restructure kept the behaviour from before two keys:

- **One key at a time:** Key when set, else Key 2. The target isn't used yet.
- **A busy Gemini** (429, 500, 503, 504; no answer in time; unreachable) is tried again after
  5, 15, 30, 60, 120 s (the last repeated) while the limit allows, never starting a try with
  less than 5 s left. Each try may take up to 120 s, never past the limit. Any other error is
  final.
- **Pace: 9 tries a minute per key,** across every request in the tab or process: under the
  free tier's 15 for Flash-Lite.

## Next: the cheap and the reliable key

To decide and build in `gemini/plan.ts`:

- Classify 429s: a minute's quota (cool the key for Gemini's `RetryInfo.retryDelay`) or a day's
  (cool it until the daily reset). A cooling key is skipped, not tried.
- Key busy (429, 503) → Key 2 at once when the target says it's worth it; Key 2 busy → back off.
- **Hedging:** Key with no answer by the target's share (about 8–10 s: answers take 2–9 s) →
  ask Key 2 too, take the first answer, cancel the other (a paid request already started is
  billed).
- Cooldowns are per tab: the app and the lab draw on the same project quota without knowing of
  each other; a 429 corrects it at the cost of one fast try.
