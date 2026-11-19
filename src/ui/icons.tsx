/** Line icons drawn on a 24 × 24 grid, in the current text colour. */

const props = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 2.5,
  'stroke-linecap': 'round',
  'aria-hidden': true,
} as const;

export function CloseIcon() {
  return (
    <svg {...props}>
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg {...props}>
      <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg {...props}>
      <path d="M15 5 L8 12 L15 19" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg {...props}>
      <path d="M9 5 L16 12 L9 19" />
    </svg>
  );
}
