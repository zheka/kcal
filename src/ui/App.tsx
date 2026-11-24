import type { JSX } from 'preact';
import type { Ingredient } from '../core/types';
import type { Store } from '../state/store';
import { LibraryScreen } from './LibraryScreen';
import { MenuScreen } from './MenuScreen';
import { ProductForm } from './ProductForm';
import { RecipeForm } from './RecipeForm';
import { isValidDate } from '../core/time';
import { DayNav, DayScreen } from './DayScreen';
import { GoalsScreen } from './GoalsScreen';
import { SettingsScreen } from './SettingsScreen';
import { MealComposer } from './MealComposer';
import { dropDraft, productRequest } from './drafts';
import { CloseIcon, MenuIcon } from './icons';
import { goBack, navigate, route, today } from './router';

interface Screen {
  title: string;
  body: JSX.Element;
  /** Replaces the back button and title (the day screens). */
  header?: JSX.Element;
}

function dayScreen(store: Store, date: string): Screen {
  return {
    title: date,
    header: <DayNav date={date} />,
    body: <DayScreen store={store} date={date} />,
  };
}

/** A new meal's first ingredient, from a quick button: `food`, `amount` and `unit`. */
function startOf(params: URLSearchParams): Ingredient | undefined {
  const food = params.get('food');
  const unit = params.get('unit');
  const amount = Number(params.get('amount'));
  return food && unit && amount > 0 ? { amount, food, unit } : undefined;
}

function screenFor(store: Store, path: string, params: URLSearchParams): Screen {
  if (path === '/') return dayScreen(store, today.value);
  const day = /^\/day\/(.+)$/.exec(path);
  if (day && isValidDate(day[1]!)) return dayScreen(store, day[1]!);
  const draftKey = `${path}?${params.toString()}`;
  if (path === '/meal/new') {
    return {
      title: params.has('from') ? 'Eat again' : 'New meal',
      body: (
        <MealComposer
          store={store}
          id={null}
          draftKey={draftKey}
          {...(params.get('date') ? { date: params.get('date')! } : {})}
          {...(params.get('from') ? { copyOf: params.get('from')! } : {})}
          {...(startOf(params) ? { start: startOf(params)! } : {})}
        />
      ),
    };
  }
  const meal = /^\/meal\/(.+)$/.exec(path);
  if (meal) {
    return {
      title: 'Meal',
      body: <MealComposer store={store} id={meal[1]!} draftKey={draftKey} />,
    };
  }
  if (path === '/goals') return { title: 'Goals', body: <GoalsScreen store={store} /> };
  if (path === '/settings') return { title: 'Settings', body: <SettingsScreen /> };
  if (path === '/menu') return { title: 'Menu', body: <MenuScreen store={store} /> };
  if (path === '/library') return { title: 'Library', body: <LibraryScreen store={store} /> };
  if (path === '/product/new') {
    return {
      title: 'New product',
      body: (
        <ProductForm
          store={store}
          id={null}
          initialName={params.get('name') ?? ''}
          initialBarcode={params.get('barcode') ?? undefined}
          forDraft={params.has('add') ? (productRequest() ?? undefined) : undefined}
        />
      ),
    };
  }
  const product = /^\/product\/(.+)$/.exec(path);
  if (product) {
    return { title: 'Product', body: <ProductForm store={store} id={product[1]!} /> };
  }
  if (path === '/recipe/new') {
    return {
      title: 'New recipe',
      body: <RecipeForm store={store} id={null} draftKey={draftKey} />,
    };
  }
  const recipe = /^\/recipe\/(.+)$/.exec(path);
  if (recipe) {
    return {
      title: 'Recipe',
      body: <RecipeForm store={store} id={recipe[1]!} draftKey={draftKey} />,
    };
  }
  return { title: 'Not found', body: <p class="empty">Nothing here.</p> };
}

export function App({ store }: { store: Store }) {
  const { path, params } = route.value;
  const { title, body, header } = screenFor(store, path, params);
  return (
    <div class="app">
      <header class="topbar">
        {header ? (
          <>
            {header}
            <button
              type="button"
              class="icon-button push-right"
              aria-label="Menu"
              onClick={() => navigate('/menu')}
            >
              <MenuIcon />
            </button>
          </>
        ) : (
          <>
            <h1>{title}</h1>
            <button
              type="button"
              class="icon-button push-right"
              aria-label="Close"
              onClick={() => {
                // Closing discards the screen's unsaved form, as Cancel did.
                dropDraft(`${path}?${params.toString()}`);
                goBack('/');
              }}
            >
              <CloseIcon />
            </button>
          </>
        )}
      </header>
      {/* A new route is a new screen: forms start from their own state. */}
      <main key={path}>{body}</main>
    </div>
  );
}
