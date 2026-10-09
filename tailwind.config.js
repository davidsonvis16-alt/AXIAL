/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        sunken: v('sunken'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        navy: '#081426',
        deep: '#102746',
        cyan: { DEFAULT: '#36D6F5', ink: v('cyan-ink') },
        snow: '#F7F9FC',
        slate: '#8C9AAF',
        good: '#39C99A',
        warn: '#F3B74F',
        bad: '#F16F78',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
    },
  },
  plugins: [],
}
