/**
 * The meal composer experiment (lab/index.html): compose a meal from photos, text and barcodes
 * into parametric items, adjust them locally, update it from the whole context (prompt-v3.txt).
 * Reads the app's data (as history), never writes it; keeps its meals, photos, key and logs in
 * the lab (kcal-lab-composer). The meal screen is meant to become the app's; the menu holds the
 * lab's settings and logs.
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@fontsource-variable/roboto/wght.css';
import '../../style.css';
import './composer.css';
import { newId } from '../../core/foods';
import type { AppData } from '../../core/types';
import { peekSaved } from '../../data/storage';
import { MenuIcon } from '../../ui/icons';
import { gemini } from '../ai/gemini';
import { toBase64 } from '../ai/image';
import { run } from '../ai/model';
import { clearLab } from '../storage/clear';
import { openLab, type Lab } from '../storage/lab';
import { applyUpdate, checkAnswer, updateRequest } from './compose';
import { type ComposerData, EMPTY, fromStored, round, time, withMeal } from './data';
import { MealScreen } from './MealScreen';
import { Menu } from './Menu';
import { total } from './recompute';
import type { ComposedMeal } from './types';

/** The Gemini key's name among the lab's secrets. */
const KEY = 'gemini';

interface Props {
  lab: Lab<ComposerData>;
  initial: ComposerData;
  initialKey: string;
  /** The app's data, read once (null when there is none). */
  app: AppData | null;
}

function Composer({ lab, initial, initialKey, app }: Props) {
  const [data, setData] = useState(initial);
  const [key, setKeyState] = useState(initialKey);
  const [storeError, setStoreError] = useState('');
  const [screen, setScreen] = useState<{ meal: string } | 'menu' | 'list'>('list');
  const [cleared, setCleared] = useState(false);
  const fail = (what: string) => (err: unknown) =>
    setStoreError(`Couldn’t ${what}: ${String(err)}`);

  // Every change is saved, whole, in the order made (not what was just loaded).
  useEffect(() => {
    if (data === initial) return;
    lab.data.set(data).catch(fail('save'));
  }, [lab, data, initial]);

  const setKey = (next: string) => {
    setKeyState(next);
    lab.setSecret(KEY, next).catch(fail('keep the key'));
  };
  /** Changes a meal as it is by then. */
  const change = (id: string, update: (meal: ComposedMeal) => ComposedMeal) =>
    setData((d) => {
      const meal = d.meals.find((m) => m.id === id);
      return meal ? { ...d, meals: withMeal(d.meals, update(meal)) } : d;
    });

  /** Sends the meal's whole context; logs the request and its outcome when it was sent. */
  async function update(meal: ComposedMeal, onBusy: (what: string) => void) {
    const time = new Date();
    const request = updateRequest(
      meal,
      app,
      data.meals,
      time,
      data.model,
      data.options,
      data.language,
    );
    const photo = async (id: string) => {
      const blob = await lab.files.get(id);
      return blob ? { type: blob.type || 'image/jpeg', base64: await toBase64(blob) } : null;
    };
    let response = null;
    let notSent: string | undefined;
    try {
      response = await run(request, {
        send: gemini(key, photo),
        check: checkAnswer,
        onRetry: (attempt, of, delay) =>
          onBusy(`The model is busy: trying again in ${delay / 1000} s (${attempt} of ${of})`),
        notSent: (why) => (notSent = why),
      });
    } catch (err) {
      notSent = err instanceof Error ? err.message : String(err);
    }
    if (response) void lab.log({ time: time.toISOString(), meal: meal.id, request, response });
    change(meal.id, (m) => applyUpdate(m, meal.context, response, notSent));
  }

  if (cleared) {
    return (
      <main class="app lab-composer lab-cleared">
        <h1>Lab data cleared</h1>
        <p>Nothing of the lab is left in this browser. Reload the page to start again.</p>
      </main>
    );
  }

  if (screen === 'menu') {
    return (
      <Menu
        keyValue={key}
        setKey={setKey}
        model={data.model}
        setModel={(model) => setData((d) => ({ ...d, model }))}
        options={data.options}
        setOptions={(options) => setData((d) => ({ ...d, options }))}
        language={data.language}
        setLanguage={(language) => setData((d) => ({ ...d, language }))}
        downloadLogs={() => void lab.download().catch(fail('download the logs'))}
        clearLogs={() => void lab.clearLogs().catch(fail('clear the logs'))}
        clearAll={() =>
          void clearLab()
            .then(() => setCleared(true))
            .catch(fail('clear'))
        }
        close={() => setScreen('list')}
      />
    );
  }

  const open = typeof screen === 'object' && data.meals.find((m) => m.id === screen.meal);
  if (open) {
    return (
      <MealScreen
        lab={lab}
        meal={open}
        language={data.language}
        change={(update) => change(open.id, update)}
        update={update}
        close={() => setScreen('list')}
        remove={() => {
          setData((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== open.id) }));
          for (const a of open.context) if (a.kind === 'photo') void lab.files.delete(a.file);
          setScreen('list');
        }}
      />
    );
  }

  return (
    <div class="app lab-composer">
      <header class="topbar">
        <h1 class="grow">Meals</h1>
        <button
          type="button"
          class="icon-button push-right"
          aria-label="Menu"
          onClick={() => setScreen('menu')}
        >
          <MenuIcon />
        </button>
      </header>
      <main class="form">
        {storeError && <p class="error">{storeError}</p>}
        <ul class="composed-list">
          {data.meals.map((m) => (
            <li key={m.id}>
              <button type="button" class="composed-row" onClick={() => setScreen({ meal: m.id })}>
                <span class="composed-title">{m.title || 'New meal'}</span>
                <span class="composed-sub">
                  {time(m.at)} · {round(total(m.items).kcal)} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
      <nav class="quick-buttons" aria-label="Quick buttons">
        <button
          type="button"
          class="quick-button round"
          aria-label="New meal"
          onClick={() => {
            const meal: ComposedMeal = {
              id: newId(),
              title: '',
              at: new Date().toISOString(),
              context: [],
              items: [],
              changed: false,
            };
            setData((d) => ({ ...d, meals: withMeal(d.meals, meal) }));
            setScreen({ meal: meal.id });
          }}
        >
          🍽️
        </button>
      </nav>
    </div>
  );
}

async function start(root: HTMLElement): Promise<void> {
  try {
    const lab = await openLab<ComposerData>('composer');
    const [stored, key] = await Promise.all([lab.data.get(), lab.secret(KEY)]);
    render(
      <Composer
        lab={lab}
        initial={stored ? fromStored(stored) : EMPTY}
        initialKey={key ?? ''}
        app={peekSaved()}
      />,
      root,
    );
  } catch (err) {
    render(
      <main class="app lab-composer">
        <h1>Meal composer</h1>
        <p class="error">Couldn’t open the lab’s storage: {String(err)}</p>
      </main>,
      root,
    );
  }
}

void start(document.getElementById('app')!);
