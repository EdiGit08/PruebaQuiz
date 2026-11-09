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
        kahoot: {
          red: '#E21B3C',
          blue: '#1368CE',
          yellow: '#D89E00',
          green: '#26890C',
          purple: '#46178F',
          dark: '#190933'
        }
      }
    }
  },
  plugins: []
};
