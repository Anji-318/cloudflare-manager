/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cf: {
          orange: '#F48120',
          blue: '#0055FF',
          dark: '#0F172A',
          card: '#1E293B',
          'card-light': '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Microsoft YaHei', 'sans-serif'],
      }
    }
  },
  plugins: [],
}