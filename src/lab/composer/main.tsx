/**
 * The meal composer experiment (lab/index.html): compose a meal from photos, text and barcodes,
 * update it from the whole context (prompt v5, the request of the command-line tool:
 * src/lab/meal), answer its questions on the phone. Never touches the app's data; asks Gemini with
 * the app's Key (src/ai/keys.ts, edited in the menu as in the app's Settings) and keeps its
 * meals, photos and logs in the lab (kcal-lab-composer). The meal screen is meant to become the
 * app's; the menu holds the lab's settings and logs.
 */
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@fontsource-variable/roboto/wght.css';
import '../../style.css';
import './composer.css';
import { newId } from '../../core/foods';
import { gemini } from '../../ai/browser';
import { geminiKeys } from '../../ai/keys';
import { MenuIcon } from '../../ui/icons';
import { run } from '../../ai/model';
import type { Progress } from '../../ai/provider';
import { SETTINGS } from '../meal/settings';
import { clearLab } from '../storage/clear';
import { openLab, type Lab } from '../storage/lab';
import { applyUpdate, checkAnswer, shown, updateRequest } from './compose';
import { type ComposerData, EMPTY, fromStored, round, time, withMeal } from './data';
import { MealScreen } from './MealScreen';
import { Menu } from './Menu';
import type { ComposedMeal } from './types';

/** The key the lab kept before it used the app's: forgotten on start. */
const OLD_KEY = 'gemini';

/** What the update is doing, for the meal screen. */
function progressText({ why, waitMs }: Progress): string {
  const s = Math.ceil(waitMs / 1000);
  if (why === 'busy') return `The model is busy: trying again in ${s} s`;
  if (why === 'quota') return `Keeping to the quota: sending in ${s} s`;
  if (why === 'slow') return 'The model is slow: asking Key 2 too';
  return 'Updating';
}

interface Props {
  lab: Lab<ComposerData>;
  initial: ComposerData;
}

function Composer({ lab, initial }: Props) {
  const [data, setData] = useState(initial);
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

  /** Changes a meal as it is by then. */
  const change = (id: string, update: (meal: ComposedMeal) => ComposedMeal) =>
    setData((d) => {
      const meal = d.meals.find((m) => m.id === id);
      return meal ? { ...d, meals: withMeal(d.meals, update(meal)) } : d;
    });

  /** Sends the meal's whole context; logs the request and its outcome when it was sent. */
  async function update(meal: ComposedMeal, onBusy: (what: string) => void) {
    const time = new Date();
    const request = updateRequest(meal, time, data.language);
    // photos kept as shrunk (JPEG)
    const files = async (id: string) => (await lab.files.get(id)) ?? null;
    let response = null;
    let notSent: string | undefined;
    // The keys as they are now: set or forgotten meanwhile, in the menu or the app.
    const keys = await geminiKeys();
    if (!keys.key && !keys.key2) {
      change(meal.id, (m) =>
        applyUpdate(m, meal.context, null, 'no Gemini key: set Key in the menu'),
      );
      return;
    }
    try {
      response = await run(request, {
        provider: gemini,
        urgency: SETTINGS.urgency,
        files,
        check: checkAnswer,
        onProgress: (p) => onBusy(progressText(p)),
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
                  {time(m.at)}
                  {m.meal && ` · ${round(shown(m, data.language)!.total.kcal)} kcal`}
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
              answers: {},
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
    void lab.setSecret(OLD_KEY, '').catch(() => {});
    const stored = await lab.data.get();
    render(<Composer lab={lab} initial={stored ? fromStored(stored) : EMPTY} />, root);
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
