import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import type { Page } from '@playwright/test';
import { expect, expectNoHorizontalScroll, test } from './fixtures';

/**
 * The meal composer experiment in the lab (/kcal/lab/), with Gemini replaced by a made-up answer
 * (src/lab/meal/testAnswer.json: vareniki, a filling and a count in doubt; sour cream; tea):
 * attach a photo and text, update, answer its questions locally, keep the meal, attach more and
 * update with it all; the logs hold every request and answer. Never writes the app's data.
 */

const ANSWER = JSON.parse(readFileSync('src/lab/meal/testAnswer.json', 'utf8')) as object;
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
    modelVersion: 'gemini-3.5-flash-lite',
  },
});

async function saveKey(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('textbox', { name: 'Key', exact: true }).fill('test-key');
  await page.getByRole('button', { name: 'Save key', exact: true }).click();
  await expect(page.getByText('Key saved on this device (…-key)')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
}

/** A log entry, as far as these tests look into it. */
type Entry = Record<string, unknown> & { response: { error?: string } };

/** Download data: the log, and the files by name. */
async function downloadData(
  page: Page,
): Promise<{ text: string; logs: Entry[]; files: Record<string, Uint8Array>; name: string }> {
  await page.getByRole('button', { name: 'Menu' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download data' }).click();
  const zip = await download;
  const files = unzipSync(readFileSync(await zip.path()));
  const text = strFromU8(files['log.json']!);
  await page.getByRole('button', { name: 'Close' }).click();
  return { text, logs: JSON.parse(text) as Entry[], files, name: zip.suggestedFilename() };
}

test('composes a meal from its attached context, answers it locally, updates it with more', async ({
  seeded: page,
}) => {
  const sent = await fakeGemini(page, () => reply(ANSWER));
  await page.goto('lab/');
  const appData = await page.evaluate(() => localStorage.getItem('kcal'));
  await saveKey(page);

  await page.getByRole('button', { name: 'New meal' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: PHOTO });
  await page.getByLabel('What you eat').fill('вареники');
  await page.getByRole('button', { name: 'Add' }).click();
  const attached = page.getByRole('region', { name: 'Attached' }).locator('.attached');
  await expect(attached).toHaveCount(2);
  await expect(attached.locator('img')).toHaveCount(1);
  expect(sent).toHaveLength(0);

  await page.getByRole('button', { name: 'Update' }).click();
  const items = page.locator('.composed-item');
  await expect(page.locator('.composed-dish')).toHaveCount(2);
  await expect(items).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Update' })).toHaveCount(0);
  // the tool's request: the context, the input as attached, the checklist
  expect(sent[0]!.parts).toHaveLength(4);
  expect(sent[0]!.parts[0]!.text).toContain('answer language: ru');
  expect(sent[0]!.parts[1]!.inline_data!.mime_type).toBe('image/jpeg');
  expect(sent[0]!.parts[2]).toEqual({ text: 'вареники' });
  expect(sent[0]!.parts[3]!.text).toContain('Before answering, check');
  // at the model's guesses: 675 + 62 + 3; the tea's water
  const total = page.locator('.composed-total');
  await expect(total).toContainText('This meal: 739 kcal');
  await expect(total).toContainText('250 ml water');
  // amounts with no piece names: the count × a piece; one piece without "1 ×"
  await expect(items.first()).toContainText('10 × 45г · 675 kcal');
  await expect(items.last()).toContainText('250мл · ');

  // the questions as chips; an answer updates the values here (no request)
  await page.getByRole('group', { name: 'how many' }).getByRole('button', { name: '14' }).click();
  await expect(items.first()).toContainText('14 × 45г · 945 kcal');
  await page
    .getByRole('group', { name: 'what' })
    .getByRole('button', { name: 'с творогом' })
    .click();
  await expect(items.first()).toContainText('Вареники с творогом');
  await expect(items.first()).toContainText('1260 kcal'); // 14 × 45 g × 200 / 100
  await expect(total).toContainText('This meal: 1324 kcal');
  await expect(page.getByRole('button', { name: 'с творогом' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Update' })).toHaveCount(0);
  expect(sent).toHaveLength(1);
  await expectNoHorizontalScroll(page);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

  // kept: back to the list, reopen after a reload, answers and all
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.composed-row').first()).toContainText('1324 kcal');
  await page.reload();
  await page.locator('.composed-row').first().click();
  await expect(total).toContainText('This meal: 1324 kcal');
  await expect(attached).toHaveCount(2);

  // more context: the update sends it all; the new answer comes without the user's answers
  await page.getByLabel('What you eat').fill('и чай');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(total).toContainText('This meal: 739 kcal');
  expect(sent[1]!.parts.slice(2, 4)).toEqual([{ text: 'вареники' }, { text: 'и чай' }]);

  // removing context needs an update too
  await page.getByRole('button', { name: 'Remove “и чай”' }).click();
  await expect(attached).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Update' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // the logs: every request and its answer, photos by id, never the key
  const { text, logs } = await downloadData(page);
  expect(text).not.toContain('test-key');
  expect(text).not.toContain(sent[0]!.parts[1]!.inline_data!.data);
  expect(logs).toHaveLength(2);
  expect(logs[0]).toMatchObject({
    time: expect.any(String),
    build: expect.any(String),
    meal: expect.any(String),
    request: {
      model: 'gemini-3.5-flash-lite',
      instructions: expect.stringContaining('You recognize what was eaten'),
      content: [
        { text: expect.stringContaining('answer language: ru') },
        { file: expect.any(String) },
        { text: 'вареники' },
        { text: expect.stringContaining('Before answering, check') },
      ],
      config: { thinking: 'low' },
    },
    response: {
      model: 'gemini-3.5-flash-lite',
      stop: 'end',
      tokens: { input: 2100, output: 900 },
      ms: expect.any(Number),
      answer: { dishes: expect.any(Array) },
    },
  });
  expect(await page.evaluate(() => localStorage.getItem('kcal'))).toBe(appData);
});

test('a failed update keeps the meal, says why, and can be retried; logs both', async ({
  seeded: page,
}) => {
  const sent = await fakeGemini(page, (n) =>
    n === 1 ? { status: 400, json: { error: { message: 'Something went wrong' } } } : reply(ANSWER),
  );
  await page.goto('lab/');
  await page.getByRole('button', { name: 'New meal' }).click();
  await page.getByLabel('What you eat').fill('вареники');
  await page.getByRole('button', { name: 'Add' }).click();

  // no key: nothing is sent, nothing logged
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByText('Couldn’t update: no Gemini key: set Key in the menu')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await saveKey(page);
  await page.locator('.composed-row').first().click();

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('Couldn’t update: Gemini 400: Something went wrong')).toBeVisible();
  await expect(page.locator('.composed-item')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('.composed-item')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  expect(sent).toHaveLength(2);
  await page.getByRole('button', { name: 'Close' }).click();

  const { logs } = await downloadData(page);
  expect(logs.map((l) => l.response.error ?? 'answer')).toEqual([
    'Gemini 400: Something went wrong',
    'answer',
  ]);
});

test('downloads the data: the log, and the photos as sent, kept when their meal is deleted', async ({
  seeded: page,
}) => {
  const sent = await fakeGemini(page, () => reply(ANSWER));
  await page.goto('lab/');
  await saveKey(page);
  await page.getByRole('button', { name: 'New meal' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'meal.png', mimeType: 'image/png', buffer: PHOTO });
  await page.getByLabel('What you eat').fill('вареники');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: 'Update' }).click();
  await expect(page.locator('.composed-item')).toHaveCount(3);
  await page.getByRole('button', { name: 'Delete this meal' }).click();
  await page.getByRole('button', { name: /Tap again/ }).click();
  await expect(page.locator('.composed-row')).toHaveCount(0);

  const { logs, files, name } = await downloadData(page);
  expect(name).toMatch(/^kcal-lab-composer-\d{4}-\d{2}-\d{2}\.zip$/);
  const content = (logs[0]!.request as { content: { file?: string }[] }).content;
  const photo = files[`files/${content[1]!.file}.jpg`]!;
  // the photo as the model was sent it
  expect(Buffer.from(photo).toString('base64')).toBe(sent[0]!.parts[1]!.inline_data!.data);
  expect(Object.keys(files).sort()).toEqual([`files/${content[1]!.file}.jpg`, 'log.json']);
});
