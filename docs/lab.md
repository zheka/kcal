# The lab: the meal composer experiment

What runs at https://zheka.github.io/kcal/lab/ (see README, Lab, for the setup), how it logs,
and what comes next.

## Screens

- **Meals:** the list (title, time, kcal), ☰ for the menu, 🍽️ for a new meal.
- **A meal:** meant to become the app's meal screen, so nothing on it is for debugging. Its total,
  its dishes (each with its kcal) and their products (the amount as said, kcal, protein, water to
  drink when there is any); under a product, the questions worth asking as chips (what, size, how
  many), the model's guess chosen. A tap answers: the product, its values and the totals change on
  the phone, with no request (`process` in `src/lab/meal/process.ts`, with the answers), and the
  answer is kept; another product shows at its own size, and each product's size chosen is kept for
  when it is chosen again. Then what it is composed from (attached, each removable), and Update when
  that changed (Retry after a failure, with a short note why). An update brings a new answer, and
  the user's answers start again. Attaching prepares each thing at once: a photo is shrunk and kept,
  a barcode is looked up on Open Food Facts (a popup when it can't be, and nothing is attached).
- **Menu:** the Gemini key and the answer language (a code, `ru` by default); how the model is
  asked, as `src/lab/meal/settings.ts` says (model, thinking, retries: the tool's settings, not
  the user's); Download logs, Clear logs, Clear all lab data; the build.

## Requests

Update sends one request with the meal's whole context, the same request the command-line tool
sends (`mealRequest` in `src/lab/meal/request.ts`, see
[lab-meal-prompt.md](lab-meal-prompt.md)): prompt v6 as the system instruction, the answer
language and the time, every attached thing as a part of its own in the order attached (a text,
a photo, a scanned product as JSON), and the checklist. Nothing of the meal so far is sent: each
update perceives the whole input afresh. The answer is read forgivingly (`read.ts`: what can be
used is, repairs are flagged in the log) and replaces the meal. Meals answered by prompt v3 keep
what they are composed from, without their answer: Update makes them again.

A scanned product is what Open Food Facts says about it, nothing of my foods: the shared
`ScannedProductData` (`src/data/openFoodFacts.ts`, also what fills the app's product form). It
keeps what helps tell the product apart (names in the product's language and the answer language,
description, brands, categories, ingredients, pack and serving sizes) and the label values we
track per 100 g or ml (kcal, protein, fat, carbs). A busy or unreachable Open Food Facts is tried
again after 1 s and 3 s, each try given 8 s.

Requests are built provider-neutral (`src/ai/model.ts`); `src/ai/gemini.ts` turns them into
Gemini's and reads Gemini's reply back. Retries and the timeout are the tool's and the bench's
(`settings.ts`): a busy Gemini (429, 500, 503, 504), one that doesn't answer within 120 s, or one
that can't be reached, is tried again after 5, 15, 30, 60 and 120 s. Long for a phone, but the
lab is a test as much as the bench is: a busy minute (503s at a busy hour are common) shouldn't
lose it.

## Logs

One entry per update that sent something (none for "no API key" or offline); the download is the
entries as a JSON array, oldest first. No key, no image data, no meals.

```jsonc
{
  "time": "2026-11-22T13:48:05.120Z", // when the request was sent
  "build": "da4cdb7", // the commit that sent it
  "meal": "m3k…",
  "request": {
    "model": "gemini-3.5-flash-lite", // as asked: an id or an alias
    "instructions": "<prompt v6>", // the system instruction
    "content": [
      // in order
      { "text": "answer language: ru\ntime: 13:00\n…" },
      { "image": "<lab file id>" },
      { "text": "вареники" },
      { "text": "{\"code\":\"…\",\"language\":\"de\",\"names\":{\"de\":\"…\"},…}" },
      { "text": "Before answering, check: …" },
    ],
    "config": { "schema": {}, "schemaFormat": "json", "temperature": null, "thinking": "low" },
  },
  "response": {
    "model": "gemini-3.5-flash-lite", // as answered (an alias resolved)
    "stop": "end", // end | max_tokens | safety | other: <reason>
    "tokens": { "input": 2100, "output": 900, "thinking": 640 },
    "ms": 8123, // the last try
    "retried": ["Gemini 503: …"], // busy tries before it, if any
    "answer": {}, // when the answer is JSON: the model's, as it came
    "undecoded": ["…"], // the answer's text parts as received, when not JSON
    "error": "…", // why there's no usable answer, when there isn't
  },
}
```

`model`, `stop` and `tokens` are there whenever the provider replied.

## Next steps

- **The model perceives, the code decides: prompt v6** (`src/lab/meal/`): the model returns dishes
  and products with how far their amounts may be off and what else they may be; the code adds up,
  turns those into questions and asks only those that matter. In code with a command-line tool
  (`scripts/meal.ts`) and the bench on it (`scripts/meal-bench.ts`). The format and why:
  [lab-meal-format.md](lab-meal-format.md); the settings, the prompt's rules and why, the tool and
  the bench: [lab-meal-prompt.md](lab-meal-prompt.md). The lab's meal screen runs on it
  (2026-11-23). Next: the prompt's rule on stated things.
- **Choices and a new request**: with no meal sent back, a tap may become a small text in the
  context (see lab-meal-format.md, Open questions).
- **History in the prompt**: prompt v3 sent "history matches" (from the app's data and earlier
  composed meals); prompts v5 and v6 send none yet, and the lab doesn't read the app's data any
  more. Dish names are meant for matching against it.
- **Editing a product** (its amount, removing it): prompt v3's screen had both, on its own
  format; the new one has only the chips so far.
- **The day chart** on the meal screen, as in the app's: today's meals and this one against the
  goals (read-only from the app's data).
- **Requests in the background.** Model requests and Open Food Facts lookups (with their retries)
  should run in the background while the UI stays responsive: attaching more, answering,
  leaving the meal and coming back, with the meal showing what's pending and the result applied
  when it arrives. Now the meal screen waits (busy) while one runs.
- **Retire the `proto/meal-composer` branch** once the lab works on the phone.
