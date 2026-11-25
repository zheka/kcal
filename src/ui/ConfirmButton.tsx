import { useEffect, useState } from 'preact/hooks';

interface Props {
  label: string;
  /** Shown after the first tap: "Tap again to delete". */
  confirmLabel: string;
  onConfirm: () => void;
  class?: string;
  /** Names the button before its first tap, when `label` alone is too short ("Forget key"). */
  ariaLabel?: string;
}

/** A destructive action confirmed by a second tap on the same button; no dialogs. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  class: cls = '',
  ariaLabel,
}: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      class={`button danger ${armed ? 'armed' : ''} ${cls}`}
      aria-label={armed ? undefined : ariaLabel}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
