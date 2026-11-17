import type { JSX } from 'preact';
import type { Store } from '../state/store';
import { LibraryScreen } from './LibraryScreen';
import { MenuScreen } from './MenuScreen';
import { ProductForm } from './ProductForm';
import { RecipeForm } from './RecipeForm';
import { goBack, navigate, route } from './router';

interface Screen {
  title: string;
  body: JSX.Element;
}

function screenFor(store: Store, path: string, params: URLSearchParams): Screen {
  if (path === '/') return { title: 'Kcal', body: <Home /> };
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
          addToPicker={params.has('add')}
        />
      ),
    };
  }
  const product = /^\/product\/(.+)$/.exec(path);
  if (product) {
    return { title: 'Product', body: <ProductForm store={store} id={product[1]!} /> };
  }
  if (path === '/recipe/new') {
    return { title: 'New recipe', body: <RecipeForm store={store} id={null} draftKey={path} /> };
  }
  const recipe = /^\/recipe\/(.+)$/.exec(path);
  if (recipe) {
    return { title: 'Recipe', body: <RecipeForm store={store} id={recipe[1]!} draftKey={path} /> };
  }
  return { title: 'Not found', body: <p class="empty">Nothing here.</p> };
}

export function App({ store }: { store: Store }) {
  const { path, params } = route.value;
  const { title, body } = screenFor(store, path, params);
  return (
    <div class="app">
      <header class="bar">
        {path !== '/' && (
          <button type="button" class="icon-button" aria-label="Back" onClick={() => goBack('/')}>
            ‹
          </button>
        )}
        <h1>{title}</h1>
        {path !== '/menu' && (
          <button
            type="button"
            class="icon-button push-right"
            aria-label="Menu"
            onClick={() => navigate('/menu')}
          >
            ☰
          </button>
        )}
      </header>
      {/* A new route is a new screen: forms start from their own state. */}
      <main key={path}>{body}</main>
    </div>
  );
}

/** Placeholder until the day screen (next step). */
function Home() {
  return (
    <div class="home">
      <p class="empty">The day screen and the meal composer come next.</p>
      <button type="button" class="button primary" onClick={() => navigate('/library')}>
        Library
      </button>
    </div>
  );
}
