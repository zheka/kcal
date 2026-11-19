import { useState } from 'preact/hooks';
import { matchFoods } from '../core/foods';
import { GRAMS } from '../config';
import { formatNutrient } from '../core/format';
import type { FoodEntry } from '../core/nutrition';
import type { Store } from '../state/store';
import { navigate } from './router';

/** All products and recipes, by name; tap one to edit it. */
export function LibraryScreen({ store }: { store: Store }) {
  const [text, setText] = useState('');
  // Built-in foods are listed too, marked: they can be used but not edited.
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
      <input
        class="input"
        type="search"
        aria-label="Search foods"
        placeholder="Search…"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      {all.every((f) => f.kind === 'builtin') && (
        <p class="empty">
          No foods of your own yet. Add products from their labels, then recipes from them.
        </p>
      )}
      <ul class="food-list">
        {shown.map((food) =>
          food.kind === 'builtin' ? (
            <li key={food.id}>
              <div class="food-row builtin" aria-label={`${food.name}, built in, not editable`}>
                <span class="food-name">
                  {food.name}
                  <span class="tag builtin">built-in</span>
                </span>
                <span class="food-per100">{summary(food)}</span>
              </div>
            </li>
          ) : (
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
                <span class="food-per100">{summary(food)}</span>
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/**
 * What a food gives: per 100 g for products and built-in foods (`143 kcal · 13 g protein /
 * 100 g`), per its first unit for recipes (`410 kcal · 15 g protein / bowl`).
 */
function summary(food: FoodEntry): string {
  const unit = food.kind === 'recipe' ? food.units[0] : { id: GRAMS, name: '100 g' };
  const portion = unit && food.portion(unit.id, food.kind === 'recipe' ? 1 : 100);
  if (!portion) return '';
  const n = portion.nutrients;
  const parts = [formatNutrient(n.kcal, 'kcal'), formatNutrient(n.protein, 'protein')];
  if (n.water > 0) parts.push(formatNutrient(n.water, 'water'));
  return `${parts.join(' · ')} / ${unit.name}`;
}
