import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: { brand: '#FFC400', ink: '#14161A', canvas: '#F6F7F9' },
    },
  },
  plugins: [],
} satisfies Config;
