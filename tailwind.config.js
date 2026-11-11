/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        arcade: ['Fredoka', 'sans-serif']
      },
      colors: {
        night: {
          950: '#0b1220',
          900: '#101a2c',
          800: '#17243b',
          700: '#22324f',
          600: '#304464'
        },
        cream: '#f7f1e5',
        coral: {
          400: '#ff8a6b',
          500: '#f26b4a',
          600: '#d95536'
        },
        mint: {
          300: '#8ee3c8',
          400: '#5fd0b0',
          500: '#2fb390'
        },
        sun: {
          200: '#ffe3a3',
          300: '#ffd166',
          400: '#f6c453',
          500: '#d9a52f'
        },
        sky: {
          300: '#8bd3ff',
          400: '#5bb8ee',
          500: '#2f95cf'
        },
        kahoot: {
          red: '#E21B3C',
          blue: '#1368CE',
          yellow: '#D89E00',
          green: '#26890C',
          purple: '#46178F',
          dark: '#190933'
        }
      },
      boxShadow: {
        panel: '0 18px 45px rgba(2, 6, 23, 0.32)',
        lift: '0 6px 0 rgba(2, 6, 23, 0.45)'
      }
    }
  },
  plugins: []
};
