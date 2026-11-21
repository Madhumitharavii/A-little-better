import type { Config } from 'tailwindcss';

// Colour names come from the original prototype; the actual colours
// are CSS variables in src/index.css (light + dark), brightened in
// Nov 2026 at the owner's request.
/** A palette colour backed by a CSS variable, keeping Tailwind's /opacity modifiers working. */
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every custom colour is a CSS variable (defined in src/index.css),
      // so dark mode can swap the whole palette in one place. The light
      // values are unchanged from the prototype.
      colors: {
        sand: {
          50: v('sand-50'),
          100: v('sand-100'),
          200: v('sand-200'),
          300: v('sand-300'),
          800: v('sand-800'),
          900: v('sand-900'),
        },
        sage: {
          100: v('sage-100'),
          300: v('sage-300'),
          500: v('sage-500'),
          700: v('sage-700'),
        },
        terracotta: {
          100: v('terracotta-100'),
          400: v('terracotta-400'),
          600: v('terracotta-600'),
        },
        slate: {
          100: v('slate-100'),
          500: v('slate-500'),
          800: v('slate-800'),
          900: v('slate-900'),
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
