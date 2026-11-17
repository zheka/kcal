import { useState } from 'preact/hooks';
import { matchFoods } from '../core/foods';
import { formatAmount } from '../core/format';
import type { FoodEntry } from '../core/nutrition';
import type { Store } from '../state/store';
import { navigate } from './router';

/** All products and recipes, by name; tap one to edit it. */
export function LibraryScreen({ store }: { store: Store }) {
  const [text, setText] = useState('');
  const all = [...store.foods.value.values()].sort((a, b) => a.name.localeCompare(b.name));
  const shown = matchFoods(all, text);

  return (
    <div class="library">
      <div class="actions">
        <button type="button" class="button primary" onClick={() => navigate('/product/new')}>
          ＋ Product
        </button>
        <button type="button" class="button primary" onClick={() => navigate('/recipe/new')}>
          ＋ Recipe
        </button>
      </div>
      {all.length > 0 && (
        <input
          class="input"
          type="search"
          aria-label="Search foods"
          placeholder="Search…"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      )}
      {all.length === 0 && (
        <p class="empty">No foods yet. Add products from their labels, then recipes from them.</p>
      )}
      <ul class="food-list">
        {shown.map((food) => (
          <li key={food.id}>
            <button
              type="button"
              class="food-row"
              onClick={() => navigate(`/${food.kind}/${food.id}`)}
            >
              <span class="food-name">
                {food.name}
                {food.kind === 'recipe' && <span class="tag">recipe</span>}
              </span>
              <span class="food-per100">{per100g(food)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `143 kcal · 12.6 g protein / 100 g`; unknown protein shows as `?`. */
function per100g(food: FoodEntry): string {
  const kcal = formatAmount(scaled(food, 'kcal'), 'kcal');
  const protein =
    food.kind === 'product' && food.perGram.protein.missing > 0
      ? '?'
      : formatAmount(scaled(food, 'protein'), 'protein');
  return `${kcal} kcal · ${protein} g protein / 100 g`;
}

function scaled(food: FoodEntry, n: 'kcal' | 'protein') {
  return { value: food.perGram[n].value * 100, missing: food.perGram[n].missing };
}
