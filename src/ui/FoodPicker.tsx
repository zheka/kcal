import { useState } from 'preact/hooks';
import { matchFoods } from '../core/foods';
import type { FoodEntry } from '../core/nutrition';
import { cleanText } from '../core/text';

interface Props {
  /** Foods that can be picked, in chip order. */
  foods: FoodEntry[];
  onPick: (food: FoodEntry) => void;
  /** Starts creating a product with the typed name. */
  onCreate: (name: string) => void;
  /** Whether a food (any, also one not offered here) already has this name. */
  nameTaken: (name: string) => boolean;
}

const MAX_CHIPS = 12;

/** A text field with a row of food chips; typing filters them. */
export function FoodPicker({ foods, onPick, onCreate, nameTaken }: Props) {
  const [text, setText] = useState('');
  const typed = cleanText(text);
  const chips = matchFoods(foods, text).slice(0, MAX_CHIPS);
  const canCreate = typed !== '' && !nameTaken(typed);

  return (
    <div class="picker">
      <input
        class="input"
        type="search"
        aria-label="Find food"
        placeholder="Add food…"
        enterKeyHint="done"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
      />
      <div class="chips" aria-label="Foods">
        {chips.map((food) => (
          <button
            type="button"
            class={`chip ${food.kind}`}
            key={food.id}
            onClick={() => {
              onPick(food);
              setText('');
            }}
          >
            {food.name}
          </button>
        ))}
        {canCreate && (
          <button type="button" class="chip create" onClick={() => onCreate(typed)}>
            ＋ create “{typed}”
          </button>
        )}
        {chips.length === 0 && !canCreate && (
          <span class="chips-empty">{foods.length === 0 ? 'No foods yet' : 'No match'}</span>
        )}
      </div>
    </div>
  );
}
