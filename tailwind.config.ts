import type { Config } from 'tailwindcss';

// Palette and type scale carried over exactly from the Gemini Canvas
// prototype. Do not "improve" these — the warm, restrained look is a
// deliberate part of the product, not a placeholder.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#FAF8F5',
          100: '#F5F0EB',
          200: '#E8DFD5',
          300: '#D5C7B7',
          800: '#4A4238',
          900: '#2C2620',
        },
        sage: {
          100: '#EBF2EE',
          300: '#B8D4C5',
          500: '#6C9A8B',
          700: '#43685C',
        },
        terracotta: {
          100: '#F9ECE8',
          400: '#E07A5F',
          600: '#C0563C',
        },
        slate: {
          100: '#F0F2F5',
          500: '#626B7D',
          800: '#3D405B',
          900: '#2B2D42',
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
