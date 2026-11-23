# The lab: the meal composer experiment

What runs at https://zheka.github.io/kcal/lab/ (see README, Lab, for the setup), how it logs,
and what comes next.

## Screens

- **Meals:** the list (title, time, kcal), ☰ for the menu, 🍽️ for a new meal.
- **A meal:** meant to become the app's meal screen, so nothing on it is for debugging. Its items
  (amounts and variants adjusted on the phone), what it is composed from (attached, each
  removable), and Update when that changed (Retry after a failure, with a short note why).
  Attaching prepares each thing at once: a photo is shrunk and kept, a barcode is looked up on Open
  Food Facts (a popup when it can't be, and nothing is attached).
- **Menu:** the Gemini key, model, answer language (a code, `ru` by default), thinking and
  temperature; Download logs, Clear logs, Clear all lab data; the build.

## Requests

Update sends one request with the meal's whole context: prompt v3 with the meal so far (its
items, as adjusted) and the history matches filled in, then every attached thing as a part of
its own, in the order attached: a text, a photo, a scanned product as JSON. The answer replaces
the items, but only if it fits the schema (strict: any problem and the meal stays as it was).

A scanned product is what Open Food Facts says about it, nothing of my foods: the shared
`ScannedProductData` (`src/data/openFoodFacts.ts`, also what fills the app's product form). It
keeps what helps tell the product apart (names in the product's language and the answer language,
description, brands, categories, ingredients, pack and serving sizes) and the label values we
track per 100 g or ml (kcal, protein, fat, carbs). A busy or unreachable Open Food Facts is tried
again after 1 s and 3 s, each try given 8 s.

Requests are built provider-neutral (`src/lab/ai/model.ts`); `ai/gemini.ts` turns them into
Gemini's and reads Gemini's reply back. A busy Gemini (429, 500, 503, 504) is tried again after
5 s and 15 s.

## Logs

One entry per update that sent something (none for "no API key" or offline); the download is the
entries as a JSON array, oldest first. No key, no image data, no meals.

```jsonc
{
  "time": "2026-11-22T13:48:05.120Z", // when the request was sent
  "build": "da4cdb7", // the commit that sent it
  "meal": "m3k…",
  "request": {
    "model": "gemini-2.5-flash", // as asked: an id or an alias
    "instructions": "", // the system instruction; none for now
    "content": [
      // in order
      { "text": "<prompt v3, filled in>" },
      { "image": "<lab file id>" },
      { "text": "chicken meatballs" },
      { "text": "{\"code\":\"…\",\"language\":\"de\",\"names\":{\"de\":\"…\"},…}" },
    ],
    "config": { "schema": {}, "temperature": 0.2, "thinking": "default" },
  },
  "response": {
    "model": "gemini-2.5-flash", // as answered (an alias resolved)
    "stop": "end", // end | max_tokens | safety | other: <reason>
    "tokens": { "input": 2100, "output": 900, "thinking": 640 },
    "ms": 8123, // the last try
    "retried": ["Gemini 503: …"], // busy tries before it, if any
    "answer": {}, // when the answer is JSON (fitting the schema or not)
    "undecoded": ["…"], // the answer's text parts as received, when not JSON
    "error": "…", // why there's no usable answer, when there isn't
  },
}
```

`model`, `stop` and `tokens` are there whenever the provider replied.

## Next steps

- **The model perceives, the code decides: prompt v5** (`src/lab/meal/`): the model returns
  dishes and products with whole alternatives; the code adds up, turns alternatives into
  questions and asks only those that matter. In code with a local tool (`scripts/meal.ts`) and
  the bench on it (`scripts/meal-bench.ts`), not yet run on the bench. The format and why:
  [lab-meal-format.md](lab-meal-format.md); the settings, the prompt's rules and why, the tool
  and the bench: [lab-meal-prompt.md](lab-meal-prompt.md). Next: bench runs; then the meal
  screen on the new format (dishes, asked questions as chips, values updated on a tap), with
  `src/lab/meal/settings.ts` instead of the menu's model, thinking and temperature, and the old
  `parameters` (types.ts, answer.ts, recompute.ts, prompt-v3.txt) removed.
- **Choices and a new request**: with no meal sent back, a tap may become a small text in the
  context (see lab-meal-format.md, Open questions).
- **History in the prompt**: prompt v3 sent "history matches"; prompt v5 sends none yet. Dish
  names are meant for matching against it.
- **The day chart** on the meal screen, as in the app's: today's meals and this one against the
  goals (read-only from the app's data).
- **Requests in the background.** Model requests and Open Food Facts lookups (with their retries)
  should run in the background while the UI stays responsive: attaching more, editing items,
  leaving the meal and coming back, with the meal showing what's pending and the result applied
  when it arrives. Now the meal screen waits (busy) while one runs.
- **Retire the `proto/meal-composer` branch** once the lab works on the phone.
