import { useEffect, useState } from 'preact/hooks';
import { newId } from '../../core/foods';
import { formName, lookUpBarcode } from '../../data/openFoodFacts';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { CloseIcon } from '../../ui/icons';
import { shrinkPhoto } from '../ai/image';
import type { Lab } from '../storage/lab';
import { withContext } from './compose';
import { type ComposerData, one, round } from './data';
import { InputBar } from './InputBar';
import { amounts, choose, setCount, total } from './recompute';
import type { Attached, ComposedMeal, Item } from './types';

/**
 * One meal, as the app's meal screen will be: its items (adjusted here), what it's composed
 * from (attached, removable), Update when that changed. No debugging: requests and answers are
 * in the lab's log.
 */

type Files = Lab<ComposerData>['files'];

interface Props {
  lab: Lab<ComposerData>;
  meal: ComposedMeal;
  /** The language to answer in: scanned products' names are asked for in it too. */
  language: string;
  /** Changes the meal as it is by then (and saves it). */
  change: (update: (meal: ComposedMeal) => ComposedMeal) => void;
  /** Sends the meal's context; `onBusy` says what's happening (a busy model: trying again). */
  update: (meal: ComposedMeal, onBusy: (what: string) => void) => Promise<void>;
  close: () => void;
  remove: () => void;
}

export function MealScreen({ lab, meal, language, change, update, close, remove }: Props) {
  // What it's doing now, and since when: shown with the seconds, so a slow step is visible.
  const [busy, setBusyState] = useState<{ what: string; since: number } | null>(null);
  const setBusy = (what: string) =>
    setBusyState((b) => (what ? { what, since: b?.since ?? Date.now() } : null));
  const sum = total(meal.items);
  const setItems = (items: Item[]) => change((m) => ({ ...m, items }));
  const attach = (a: Attached) => change((m) => withContext(m, [...m.context, a]));

  async function attachPhoto(photo: Blob) {
    try {
      setBusy('Preparing the photo');
      const shrunk = await shrinkPhoto(photo);
      const file = await lab.files.put(shrunk.blob);
      attach({ id: newId(), kind: 'photo', file });
    } catch (err) {
      alert(`Couldn’t attach the photo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy('');
    }
  }

  /** Open Food Facts' data for the code, attached as it is; a popup when there is none. */
  async function scanned(code: string) {
    setBusy(`Looking up ${code}`);
    const result = await lookUpBarcode(code, {
      language,
      onRetry: (attempt, of) => setBusy(`Looking up ${code} (try ${attempt} of ${of})`),
    });
    setBusy('');
    if (result.kind === 'found') {
      attach({ id: newId(), kind: 'product', product: result.data });
    } else if (result.kind === 'offline') {
      alert(`Couldn’t look up ${code}: offline.`);
    } else if (result.kind === 'not-found') {
      alert(`${code}: not in Open Food Facts. Describe it in text instead.`);
    } else {
      alert(`Couldn’t look up ${code}: Open Food Facts didn’t answer. Try again later.`);
    }
  }

  async function send() {
    setBusy('Updating');
    try {
      await update(meal, setBusy);
    } finally {
      setBusy('');
    }
  }

  return (
    <div class="app lab-composer meal-open">
      <header class="topbar">
        <h1 class="grow">{meal.title || 'New meal'}</h1>
        <button type="button" class="icon-button push-right" aria-label="Close" onClick={close}>
          <CloseIcon />
        </button>
      </header>
      <main class="form">
        {meal.items.length > 0 && (
          <p class="composed-total">
            This meal: {round(sum.kcal)} kcal · {round(sum.protein)} g protein · {round(sum.fat)} g
            fat · {round(sum.carbs)} g carbs
            {sum.water_ml > 0 && ` · ${round(sum.water_ml)} ml water`}
          </p>
        )}
        <ul class="composed-items">
          {meal.items.map((item, i) => (
            <ItemRow
              key={`${i}-${item.name}`}
              item={item}
              change={(next) => setItems(meal.items.map((x, j) => (j === i ? next : x)))}
              remove={() => setItems(meal.items.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
        <Context
          context={meal.context}
          files={lab.files}
          language={language}
          remove={(id) =>
            change((m) =>
              withContext(
                m,
                m.context.filter((a) => a.id !== id),
              ),
            )
          }
        />
        {meal.context.length === 0 && !busy && (
          <p class="empty">Take a photo, scan a barcode or describe what you eat.</p>
        )}
        {busy && <Busy what={busy.what} since={busy.since} />}
        {!busy && meal.failed && <p class="error">Couldn’t update: {meal.failed}</p>}
        {!busy && meal.changed && (
          <div class="actions">
            <button type="button" class="button primary" onClick={() => void send()}>
              {meal.failed ? 'Retry' : 'Update'}
            </button>
          </div>
        )}
        <div class="actions">
          <ConfirmButton
            label="Delete this meal"
            confirmLabel="Tap again to delete"
            onConfirm={remove}
          />
        </div>
      </main>
      <InputBar
        disabled={!!busy}
        attachText={(text) => attach({ id: newId(), kind: 'text', text })}
        attachPhoto={(photo) => void attachPhoto(photo)}
        scanned={(code) => void scanned(code)}
      />
    </div>
  );
}

function ItemRow({
  item,
  change,
  remove,
}: {
  item: Item;
  change: (item: Item) => void;
  remove: () => void;
}) {
  const [all, setAll] = useState(false);
  const [text, setText] = useState(one(item.count));
  useEffect(() => setText(one(item.count)), [item.count]);
  const a = amounts(item);
  // Only real choices: a parameter with one variant, or one likely amount, offers nothing to pick.
  const choices = item.parameters.filter((p) => p.variants.length > 1);
  const shown = choices.filter((p) => all || p.surfaced);
  return (
    <li class="composed-item">
      <div class="composed-item-main">
        <button
          type="button"
          class="composed-name"
          aria-expanded={all}
          onClick={() => setAll(!all)}
          title="Alternatives"
        >
          {item.name}
          {item.amount_flag && (
            <span class="flag" aria-label="unsure amount">
              {' '}
              ⚑
            </span>
          )}
        </button>
        <input
          class="input number composed-count"
          inputMode="decimal"
          aria-label={`Amount of ${item.name}`}
          value={text}
          onInput={(e) => {
            setText(e.currentTarget.value);
            const n = Number(e.currentTarget.value.replace(',', '.'));
            if (n > 0 && Number.isFinite(n)) change(setCount(item, n));
          }}
        />
        <span class="composed-unit">{item.unit}</span>
        <button
          type="button"
          class="icon-button"
          aria-label={`Remove ${item.name}`}
          onClick={remove}
        >
          <CloseIcon />
        </button>
      </div>
      <p class="composed-values">
        {round(a.kcal)} kcal · {one(a.protein)} g protein · {round(a.grams)} g
      </p>
      {item.amount_flag && item.likely_counts.length > 1 && (
        <Choices
          label="likely"
          options={item.likely_counts.map((c) => ({ label: `${one(c)} ${item.unit}`, value: c }))}
          chosen={item.count}
          pick={(c) => change(setCount(item, c))}
        />
      )}
      {shown.map((p) => (
        <Choices
          key={p.name}
          label={p.name}
          options={p.variants.map((v) => ({ label: v.label, value: v.label }))}
          chosen={p.default}
          pick={(v) => change(choose(item, p.name, v))}
          why={all ? p.why : ''}
        />
      ))}
      {all && choices.length === 0 && <p class="hint">No alternatives.</p>}
    </li>
  );
}

function Choices<T extends string | number>({
  label,
  options,
  chosen,
  pick,
  why = '',
}: {
  label: string;
  options: { label: string; value: T }[];
  chosen: T;
  pick: (value: T) => void;
  why?: string;
}) {
  return (
    <div class="choices" role="group" aria-label={label}>
      <span class="choices-label">{label}:</span>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          class="choice"
          aria-pressed={o.value === chosen}
          onClick={() => pick(o.value)}
        >
          {o.label}
        </button>
      ))}
      {why && <span class="hint choices-why">{why}</span>}
    </div>
  );
}

/** What the meal is composed from, as attached; each can be removed. */
function Context({
  context,
  files,
  language,
  remove,
}: {
  context: Attached[];
  files: Files;
  language: string;
  remove: (id: string) => void;
}) {
  if (context.length === 0) return null;
  return (
    <section class="composed-context" aria-label="Attached">
      {context.map((a) => (
        <div class="attached" key={a.id}>
          {a.kind === 'photo' ? (
            <Photo file={a.file} files={files} />
          ) : a.kind === 'text' ? (
            <q class="attached-text">{a.text}</q>
          ) : (
            <span class="attached-text">
              {formName(a.product, language) || 'A product'}{' '}
              <span class="muted">{a.product.code}</span>
            </span>
          )}
          <button
            type="button"
            class="icon-button"
            aria-label={`Remove ${a.kind === 'text' ? `“${a.text}”` : a.kind === 'photo' ? 'the photo' : a.product.code}`}
            onClick={() => remove(a.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </section>
  );
}

/** An attached photo, from the lab's files. */
function Photo({ file, files }: { file: string; files: Files }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let made = '';
    void files
      .get(file)
      .catch(() => undefined)
      .then((blob) => {
        if (blob) setUrl((made = URL.createObjectURL(blob)));
      });
    return () => URL.revokeObjectURL(made);
  }, [file, files]);
  return url ? <img class="attached-photo" src={url} alt="A photo attached" /> : null;
}

/** A step in progress, with the seconds it has taken so far. */
function Busy({ what, since }: { what: string; since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p class="notice" aria-live="polite">
      {what}… {Math.round((now - since) / 1000)} s
    </p>
  );
}
