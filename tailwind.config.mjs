/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Source Serif 4"', 'Palatino', '"Book Antiqua"', 'Georgia', 'serif'],
        sans: ['"Inter"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      maxWidth: {
        prose: '48rem',
      },
      fontSize: {
        base: ['1.125rem', { lineHeight: '1.75' }],
      },
    },
  },
  plugins: [],
};
