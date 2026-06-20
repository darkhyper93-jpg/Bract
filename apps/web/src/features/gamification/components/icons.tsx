import type { SVGProps } from 'react';

// Iconos de juego como SVG inline (regla skill no-emoji-icons). Heredan color con `currentColor` y
// tamaño con la clase (w/h). Trazo simple, coherente con el dark de Bract.

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function LevelIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.07 1.1-6.47-4.7-4.58 6.5-.95L12 2.5z" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3c.5 3-2.5 4.5-2.5 7.5A2.5 2.5 0 0012 13a2 2 0 002-2c1.5 1 2.5 2.6 2.5 4.5A4.5 4.5 0 0112 20a5 5 0 01-5-5c0-4 3.5-5.5 5-12z" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 3v5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" />
    </svg>
  );
}

export function BossIcon(props: IconProps) {
  // Espada (dominio): se vence al jefe con interacciones de dominio.
  return (
    <svg {...base} {...props}>
      <path d="M14.5 4H20v5.5L9 20.5l-2.5.5.5-2.5L18 7.5" />
      <path d="M6.5 18.5L3 15M14 9.5L9.5 5 4 4l1 5.5L9.5 14" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}
