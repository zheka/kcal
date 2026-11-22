import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test } from './fixtures';

/**
 * The meal composer experiment in the lab (/kcal/lab/), with Gemini replaced by recorded answers:
 * attach a photo and text, update, adjust locally, attach more and update with it all, keep the
 * meal; the logs hold every request and answer. Never writes the app's data.
 */

const FOOD7 = JSON.parse(
  readFileSync('src/lab/composer/fixtures/food7-v2-hist-gemini.json', 'utf8'),
) as { items: { name: string; count: number }[] };
// An 8×8 PNG: something to "photograph".
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4UaGBFTEMLQkAUtVaAV8W4QQAAAAASUVORK5CYII=',
  'base64',
);

interface Sent {
  parts: { text?: string; inline_data?: { mime_type: string; data: string } }[];
}

/** Gemini, answering with `answer(n)` for the n-th request (from 1); its requests, as sent. */
async function fakeGemini(
  page: Page,
  answer: (n: number) => { status: number; json: object },
): Promise<Sent[]> {
  const sent: Sent[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (route.request().url().includes('/models?')) {
      await route.fulfill({
        json: {
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          ],
        },
      });
      return;
    }
    const body = route.request().postDataJSON() as { contents: Sent[] };
    sent.push(body.contents[0]!);
    const { status, json } = answer(sent.length);
    await route.fulfill({ status, json });
  });
  return sent;
}

const reply = (answer: object) => ({
  status: 200,
  json: {
    candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 900 },
    modelVersion: 'gemini-2.5-flash',
  },
});

async function saveKey(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByLabel('Gemini key').fill('test-key');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('#composer-model')).toHaveValue('gemini-2.5-flash');
  await page.getByRole('button', { name: 'Close' }).click();
}

/** A log entry, as far as these tests look into it. */
type Entry = Record<string, unknown> & { response: { error?: string } };

async function downloadLogs(page: Page): Promise<{ text: string; logs: Entry[] }> {
  await page.getByRole('button', { name: 'Menu' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download logs' }).click();
  const text = readFileSync(await (await download).path(), 'utf8');
  await page.getByRole('button', { name: 'Close' }).click();
  return { text, logs: JSON.parse(text) as Entry[] };
}

test('composes a meal from its attached context, adjusts it, updates it with more', async ({
  seeded: page,
}) => {
  const sent = await fakeGemini(page, (n) => {
    // the second update ("potatoes 100 g") returns the potatoes at 100 g
    const answer = structuredClone(FOOD7);
    if (n > 1) answer.items[1]!.count = 100;
    return reply(answer);
  });
  await page.goto('lab/');
  const appData = await page.evaluate(() => localStorage.getItem('kcal'));
  await saveKey(page);

  await page.getByRole('button', { name: 'New meal' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'food7.png', mimeType: 'image/png', buffer: PHOTO });
  await page.getByLabel('What you eat').fill('chicken meatballs');
  await page.getByRole('button', { name: 'Add' }).click();
  const attached = page.getByRole('region', { name: 'Attached' }).locator('.attached');
  await expect(attached).toHaveCount(2);
  await expect(attached.locator('img')).toHaveCount(1);
  expect(sent).toHaveLength(0);

  await page.getByRole('button', { name: 'Update' }).click();
  const items = page.locator('.composed-item');
  await expect(items).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Update' })).toHaveCount(0);
  // the prompt, then the context as attached
  expect(sent[0]!.parts).toHaveLength(3);
  expect(sent[0]!.parts[0]!.text).toContain('meal so far: empty');
  expect(sent[0]!.parts[0]!.text).toContain('"oats with honey" (my recipe)');
  expect(sent[0]!.parts[1]!.inline_data!.mime_type).toBe('image/jpeg');
  expect(sent[0]!.parts[2]).toEqual({ text: 'chicken meatballs' });
  // at defaults: 320 + 262 + 114 + 111 + 93
  await expect(page.locator('.composed-total')).toContainText('This meal: 900 kcal');

  // local: pick a variant, edit an amount (no request)
  await page.getByRole('button', { name: 'Смешанный фарш (свинина/говядина)' }).click();
  await expect(items.first()).toContainText('602 kcal');
  await page.getByLabel('Amount of Куриные тефтели').fill('6');
  await expect(items.first()).toContainText('452 kcal');
  await expect(page.getByRole('button', { name: 'Update' })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

  // more context: the update sends it all, with the meal so far and its answers
  await page.getByLabel('What you eat').fill('potatoes 100 g');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByLabel('Amount of Отварной картофель')).toHaveValue('100');
  expect(sent[1]!.parts.slice(2)).toEqual([
    { text: 'chicken meatballs' },
    { text: 'potatoes 100 g' },
  ]);
  expect(sent[1]!.parts[0]!.text).toContain('meal so far: [{"name":"Куриные тефтели","count":6');
  expect(sent[1]!.parts[0]!.text).toContain('"default":"Смешанный фарш (свинина/говядина)"');

  // removing context needs an update too
  await page.getByRole('button', { name: 'Remove “potatoes 100 g”' }).click();
  await expect(attached).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Update' })).toBeVisible();

  // kept: back to the list, reopen after a reload
  await page.getByRole('button', { name: 'Close' }).click();
  await page.reload();
  await page.locator('.composed-row').first().click();
  await expect(items).toHaveCount(5);
  await expect(attached).toHaveCount(2);
  await page.getByRole('button', { name: 'Close' }).click();

  // the logs: every request and its answer, photos by id, never the key
  const { text, logs } = await downloadLogs(page);
  expect(text).not.toContain('test-key');
  expect(text).not.toContain(sent[0]!.parts[1]!.inline_data!.data);
  expect(logs).toHaveLength(2);
  expect(logs[0]).toMatchObject({
    time: expect.any(String),
    build: expect.any(String),
    meal: expect.any(String),
    request: {
      model: 'gemini-2.5-flash',
      instructions: '',
      content: [
        { text: expect.stringContaining('You are the food-recognition step') },
        { image: expect.any(String) },
        { text: 'chicken meatballs' },
      ],
      config: { temperature: 0.2, thinking: 'default' },
    },
    response: {
      model: 'gemini-2.5-flash',
      stop: 'end',
      tokens: { input: 2100, output: 900 },
      ms: expect.any(Number),
      answer: { items: expect.any(Array) },
    },
  });
  expect(await page.evaluate(() => localStorage.getItem('kcal'))).toBe(appData);
});

test('a failed update keeps the meal, says why, and can be retried; logs both', async ({
  seeded: page,
}) => {
  const sent = await fakeGemini(page, (n) =>
    n === 1 ? { status: 400, json: { error: { message: 'Something went wrong' } } } : reply(FOOD7),
  );
  await page.goto('lab/');
  await page.getByRole('button', { name: 'New meal' }).click();
  await page.getByLabel('What you eat').fill('chicken meatballs');
  await page.getByRole('button', { name: 'Add' }).click();

  // no key: nothing is sent, nothing logged
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByText('Couldn’t update: no API key')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await saveKey(page);
  await page.locator('.composed-row').first().click();

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Couldn’t update: Gemini 400: Something went wrong')).toBeVisible();
  await expect(page.locator('.composed-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.composed-item')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  expect(sent).toHaveLength(2);
  await page.getByRole('button', { name: 'Close' }).click();

  const { logs } = await downloadLogs(page);
  expect(logs.map((l) => l.response.error ?? 'answer')).toEqual([
    'Gemini 400: Something went wrong',
    'answer',
  ]);

  // the logs can be cleared on their own
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Clear logs' }).click();
  await page.getByRole('button', { name: 'Tap again to clear the logs' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  expect((await downloadLogs(page)).logs).toEqual([]);
  await expect(page.locator('.composed-row')).toHaveCount(1);
});
