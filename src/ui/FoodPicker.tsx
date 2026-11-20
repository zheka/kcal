import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { matchFoods } from '../core/foods';
import type { FoodEntry } from '../core/nutrition';
import { cleanText } from '../core/text';
import { ScanButton } from './ScanButton';

interface Props {
  /** Foods that can be picked, in chip order. */
  foods: FoodEntry[];
  onPick: (food: FoodEntry) => void;
  /** Starts creating a product with the typed name. */
  onCreate: (name: string) => void;
  /** Whether a food (any, also one not offered here) already has this name. */
  nameTaken: (name: string) => boolean;
  /** A barcode was scanned: find its food, or start a new one. */
  onScan: (code: string) => void;
}

const MAX_CHIPS = 12;

/** A text field with a row of food chips; typing filters them. */
export function FoodPicker({ foods, onPick, onCreate, nameTaken, onScan }: Props) {
  const [text, setText] = useState('');
  const typed = cleanText(text);
  const chips = matchFoods(foods, text).slice(0, MAX_CHIPS);
  const canCreate = typed !== '' && !nameTaken(typed);

  // Edge fades where there are more chips to swipe to. A new filter scrolls back to the start,
  // so the best matches are in view.
  const row = useRef<HTMLDivElement>(null);
  const [fades, setFades] = useState({ left: false, right: false });
  const chipsKey = chips.map((c) => c.id).join(' ') + (canCreate ? ' +' : '');
  useLayoutEffect(() => {
    const el = row.current!;
    scrollToStart(el);
    setFades(scrollFades(el));
    // The phone turned, or the window was resized: the row's width changed.
    const update = () => setFades(scrollFades(el));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [chipsKey]);

  return (
    <div class="picker">
      <div class="input-with-action">
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
        <ScanButton onCode={onScan} />
      </div>
      <div
        ref={row}
        class={`chips${fades.left ? ' fade-left' : ''}${fades.right ? ' fade-right' : ''}`}
        aria-label="Foods"
        onScroll={(e) => setFades(scrollFades(e.currentTarget))}
      >
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

function scrollToStart(el: HTMLElement): void {
  el.scrollLeft = 0;
}

/** Whether a row scrolled sideways has more to see on its left and on its right. */
function scrollFades(el: HTMLElement): { left: boolean; right: boolean } {
  return {
    left: el.scrollLeft > 1,
    right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
  };
}
