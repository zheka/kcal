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

| Task                   | Target | Limit | Why                                                                       |
| ---------------------- | ------ | ----- | ------------------------------------------------------------------------- |
| The app's product form | 15 s   | 30 s  | someone is waiting, and can type the values instead                       |
| The lab                | 30 s   | 90 s  | someone is waiting at the phone, less hurried                             |
| The tool, a meal       | 60 s   | 90 s  | someone is at the terminal; `--target`, `--limit` change it               |
| The bench              | 60 s   | 300 s | unattended; a busy minute shouldn't lose a run; `--target`, `--limit` too |

A target of `inf` (`Infinity`) never spends: Key only, as long as there is a Key.

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
  key: string; //      the provider's label: Gemini's `key`, `key2`
  keyEnd?: string; //  the key's last 4 characters: which real key, whatever its label
  at?: number; //      sent, in ms since the request was asked
  ms: number;
  error?: string;
  why?: string; //     why a costlier key was asked (Gemini: busy, cooling, paced, slow, only)
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
  `reply` (what came back anyway), `attempts`, and `key` when a key failed it and the user has
  to act (invalid, out of credit).
- **The log** (`ModelResponse`): `ms` is the whole time, waits included; `attempts` each try in
  order, with the key that sent it (the provider's label: `key`, `key2`), its last 4
  characters, when it was sent and why a costlier key was asked. Lab logs before 2026-11-25
  have `retried` (the busy errors) and `{ image: id }` parts instead; before 2026-11-26, no
  `keyEnd`: `key` was whichever key was set, free or paid.

## Keys: a key source

A provider is created once per tab or process, with a function that reads its keys:

```ts
createGemini({ keys: () => Promise<{ key: string; key2: string }> }); // '' when not set
```

|                                                   | Key (cheap)               | Key 2 (reliable)   |
| ------------------------------------------------- | ------------------------- | ------------------ |
| The app and the lab (`src/ai/browser.ts`)         | IndexedDB secret `gemini` | `gemini-2`         |
| The tools (`envGemini` in `scripts/meal-tool.ts`) | `GEMINI_API_KEY`          | `GEMINI_API_KEY_2` |

- **One instance per tab or process,** so what it knows of a key (its pace, its
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

## Gemini

The plan (`gemini/plan.ts`) is a pure function of the urgency, the time and what is known of
each key; `gemini/index.ts` runs it, asking it again after every wait and every try.

### Which key

- **Key when it can answer before the target,** that is, when it can start soon enough to
  answer within `ANSWER_MS` (5 s: answers take 2–9 s) before the target. What holds it back: its
  backoff after busy tries, its cooldown after a quota error, its pace.
- **Else Key 2, when it can.** Else whichever key can start first: Key 2 on a tie before the
  target (it is what the target pays for), Key on a tie past it (the target is lost; free is as
  fast).
- **No target (`inf`): Key only.** Key 2 is never asked while there is a Key, even when Key
  can't be asked again within the limit.
- **A target no longer than `ANSWER_MS`:** Key can't make it from the start, so Key 2 alone,
  at once. Never both: a request that pays anyway gains little from a free try beside it.
- **A slow try is hedged:** a try on its way is waited for until the last moment another
  could still answer by the target (target − `ANSWER_MS`: 10 s in the app, 25 s in the lab,
  never without a target); then Key 2 is asked too, the first answer taken and the other try
  cancelled (`cancelled` in the log; a paid one cancelled is likely billed anyway). Why not cut
  the slow try and switch: it costs the same paid try, and loses a free answer that may be a
  second away. At most one try per key at once, and Key never beside Key 2: in the bench runs
  Key 2 never failed (0 of 28), and a free try beside it only spends Key's pace and quota.
- **Within the limit:** no try starts with less than 5 s left; each may take 120 s at most,
  never past the limit.

What that does, Key busy each time it's asked (a 503 takes about 2 s, 1–4 s):

| Target       | Key's tries, then Key 2                                  |
| ------------ | -------------------------------------------------------- |
| 5 s          | none: Key 2 alone, at once                               |
| 15 s (app)   | 2 (at 0, 4 s), Key 2 at about 6 s                        |
| 30 s (lab)   | 3 (0, 4, 16 s), Key 2 at about 18 s                      |
| 60 s (bench) | 4 (0, 4, 16, 48 s), Key 2 at about 50 s                  |
| ∞            | Key again after 2, 10, 30, 60, 120 s (the last repeated) |

Why the first retry after only 2 s: measured at a quiet hour, about half of Key's tries were
503s, and a retry 5 s later failed about as often as a first try, so a 503 looked like that
try's alone. The 5 s first wait cost about 2 s of median time; at 2 s, with the app's target at
15 s, a simulation of these tries gave a median of about 6 s at every target, with Key 2 asked
for about 28% of the app's requests, 13% of the lab's, 6% of the bench's (at a 10 s target:
58%). To check at a busy hour: whether 503s then come in runs, which a 2 s retry wouldn't
outwait.

Key 2 is paid; one meal with a photo costs a fraction of a cent. The log's `why` says what
each Key 2 try paid for.

### Errors

Each failed try is classified by its status and Google's error details (`gemini/http.ts`):

| Kind    | What                                                                            | Then                                                                                                                       |
| ------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `busy`  | 500, 502, 503, 504; no answer in time; unreachable                              | that key backs off: 2, 10, 30, 60, 120 s, counted per key and request                                                      |
| `quota` | a 429                                                                           | that key cools: Gemini's `RetryInfo` delay, else a minute; an hour for a day's quota (`PerDay` in the violated quota's id) |
| `key`   | 401; any 403; a 400 about the API key; a 429 of a prepaid account out of credit | the request fails, naming the key (`Key 2: Gemini 400: API key not valid…`)                                                |
| `final` | any other error: the request's own                                              | the request fails                                                                                                          |

- **A key error fails the request, not just the key,** with Key 2 as with Key, once no try
  with the other key is on its way: one on its way is waited for (not cancelled), and its
  answer taken if it comes; no new try is sent. Why: a key that
  silently stops working is a key the user stops paying attention to; a request that needs it
  says so, so it gets fixed or removed. Nothing is remembered of it: the next request that
  needs it asks it again, so a key fixed meanwhile (topped up, replaced) works at once. A key
  the plan doesn't need is never asked: with Key 2 broken, a request Key answers works.
- **Out of credit is a key error, not a quota's:** a cooldown would keep a topped-up key unused.
  Only a prepaid account's message ("prepayment credits are depleted") or a billing reason
  counts: every free-tier 429's message mentions billing too.
- **Cooldowns are by the key's value,** not its name: a key changed meanwhile is asked at once.
- **Failed tries count toward the quota** (Google's billing FAQ, for 400s and 500s; reports for
  503s), but aren't billed. So every try sent counts toward the pace, and a busy Key backs off
  rather than being tried again at once.

### Pace

**Key keeps to 12 tries a minute,** across every request in the tab or process, failed or not:
under the free tier's 15 for Flash-Lite, leaving room for the app and the lab, which share
Key's project without knowing of each other (a 429 corrects it then: Key cools). Key's next
turn is one more thing that holds it back: an urgent request asks Key 2 meanwhile, a patient
one waits. Key 2 has no pace: a paid project's quota is far larger.

Cooldowns and the pace are per tab or process: the app, the lab and the tool learn of a 429
each at the cost of one try.
