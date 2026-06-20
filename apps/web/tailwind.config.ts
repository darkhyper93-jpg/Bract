import type { Config } from 'tailwindcss';

// DECISIÓN: colores definidos como hex para que los modificadores de opacidad de Tailwind
// funcionen correctamente (e.g. bg-bg-base/80). Las CSS custom properties en globals.css
// son la fuente canónica para CSS puro; estos valores deben mantenerse sincronizados.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0a0a0a',
          surface: '#111111',
          elevated: '#1a1a1a',
          overlay: '#222222',
        },
        text: {
          primary: 'rgba(255,255,255,0.95)',
          secondary: 'rgba(255,255,255,0.60)',
          tertiary: 'rgba(255,255,255,0.35)',
          disabled: 'rgba(255,255,255,0.20)',
        },
        brand: {
          primary: '#6366f1',
          hover: '#818cf8',
          muted: 'rgba(99,102,241,0.15)',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.20)',
        },
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        // Acentos de juego (Agente J, §9.2) — sincronizados con globals.css.
        game: {
          xp: '#fbbf24',
          flame: '#fb923c',
          boss: '#f43f5e',
          glow: '#a78bfa',
        },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
      },
      zIndex: {
        modal: '1000',
        dropdown: '500',
        tooltip: '400',
        sidebar: '300',
      },
      transitionDuration: {
        modal: '200ms',
        dropdown: '150ms',
        interaction: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
