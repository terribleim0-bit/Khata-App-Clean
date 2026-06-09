/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./www/index.html",
    "./www/pages/*.html",
    "./www/assets/js/*.js"
  ],
  darkMode: 'class',
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
        muted: 'var(--text-muted)',
        brand: 'var(--brand-blue)',
        'status-green': 'var(--status-green)',
        'status-red': 'var(--status-red)',
        line: 'var(--border-line)',
        input: 'var(--border-input)',
        avatar: 'var(--bg-avatar)',
        fab: 'var(--bg-fab)',
        'fab-active': 'var(--bg-fab-active)',
        'strip-header': 'var(--bg-strip-header)'
      }
    }
  },
  plugins: [],
}
