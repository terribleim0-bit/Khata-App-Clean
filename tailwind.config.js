/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./www/**/*.html",
    "./www/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
         sans: ['Inter', 'sans-serif'], 
      },
      colors: {
          master: 'var(--bg-master)',
          card: 'var(--bg-card)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          brand: 'var(--brand-blue)',
          green: 'var(--status-green)',
          red: 'var(--status-red)',
          line: 'var(--border-line)',
          avatar: 'var(--bg-avatar)'
      }
    }
  },
  plugins: [],
}
