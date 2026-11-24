import { useEffect, useState } from 'preact/hooks';
import { newId } from '../../core/foods';
import { formName, lookUpBarcode } from '../../data/openFoodFacts';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { CloseIcon } from '../../ui/icons';
import { shrinkPhoto } from '../../ai/image';
import { SETTINGS } from '../meal/settings';
import type { Lab } from '../storage/lab';
import { type Axis, choose, itemKey, type ProcessedItem, type Question } from '../meal/process';
import { shown, withContext } from './compose';
import { type ComposerData, one, round } from './data';
import { InputBar } from './InputBar';
import type { Attached, ComposedMeal } from './types';

/**
 * One meal, as the app's meal screen will be: its dishes and products with their values, the
 * questions worth asking as chips (an answer updates the values here, with no request), what
 * it's composed from (attached, removable), Update when that changed. No debugging: requests
 * and answers are in the lab's log.
 */

/** A question's chips, by what an answer changes (see process.ts). */
const AXES: Record<Axis, string> = {
  kind: 'what',
  size: 'size',
  count: 'how many',
};

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
  const view = shown(meal, language);
  const sum = view?.total;
  /** The user's answer to one of a product's questions: kept, and shown at once. */
  const answer = (key: string, item: ProcessedItem, q: Question, id: string) =>
    change((m) => ({
      ...m,
      answers: { ...m.answers, [key]: choose(m.answers[key], item, q, id) },
    }));
  const attach = (a: Attached) => change((m) => withContext(m, [...m.context, a]));

  async function attachPhoto(photo: Blob) {
    try {
      setBusy('Preparing the photo');
      const shrunk = await shrinkPhoto(photo, SETTINGS.photo);
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
        {sum && (
          <p class="composed-total">
            This meal: {round(sum.kcal)} kcal · {round(sum.protein)} g protein · {round(sum.fat)} g
            fat · {round(sum.carbs)} g carbs
            {sum.water > 0 && ` · ${round(sum.water)} ml water`}
          </p>
        )}
        {view?.dishes.map((dish, d) => (
          <section class="composed-dish" key={d} aria-label={dish.name}>
            <h2 class="composed-dish-name">
              <span class="grow">{dish.name}</span>
              <span class="muted">{round(dish.values.kcal)} kcal</span>
            </h2>
            <ul class="composed-items">
              {dish.items.map((item, i) => (
                <ItemRow
                  key={i}
                  item={item}
                  answer={(q, id) => answer(itemKey(d, i), item, q, id)}
                />
              ))}
            </ul>
          </section>
        ))}
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

/** A product: its amount and values, and its questions worth asking, as chips. */
function ItemRow({
  item,
  answer,
}: {
  item: ProcessedItem;
  answer: (q: Question, id: string) => void;
}) {
  const v = item.values;
  return (
    <li class="composed-item">
      <span class="composed-name">{item.name}</span>
      <p class="composed-values">
        {item.amount} · {round(v.kcal)} kcal · {one(v.protein)} g protein
        {v.water > 0 && ` · ${round(v.water)} ml water`}
      </p>
      {item.questions
        .filter((q) => q.asked)
        .map((q) => (
          <Choices
            key={q.axis}
            label={AXES[q.axis]}
            options={q.options.map((o) => ({ id: o.id, label: o.label }))}
            chosen={q.options.find((o) => o.chosen)?.id ?? ''}
            pick={(id) => answer(q, id)}
          />
        ))}
    </li>
  );
}

function Choices({
  label,
  options,
  chosen,
  pick,
}: {
  label: string;
  options: { id: string; label: string }[];
  chosen: string;
  pick: (id: string) => void;
}) {
  return (
    <div class="choices" role="group" aria-label={label}>
      <span class="choices-label">{label}:</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          class="choice"
          aria-pressed={o.id === chosen}
          onClick={() => pick(o.id)}
        >
          {o.label}
        </button>
      ))}
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
