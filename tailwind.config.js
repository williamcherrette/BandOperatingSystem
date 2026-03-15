/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0c0c0b',
        base: '#111110',
        surface: '#161614',
        raised: '#1e1e1c',
        border: '#2e2e2c',
        'text-primary': '#e8e4dc',
        'text-secondary': '#a0a09a',
        'text-muted': '#4a4a48',
        accent: '#2563eb',
        danger: '#e05555',
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}