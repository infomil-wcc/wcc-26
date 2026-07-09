/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          primary: 'var(--theme-primary)',
          secondary: 'var(--theme-secondary)',
          accent: 'var(--theme-accent)',
          danger: 'var(--theme-danger)',
          surface: 'var(--theme-surface)',
          text: 'var(--theme-text)',
          sidebar: 'var(--theme-bg-sidebar)',
          main: 'var(--theme-bg-main)',
        },
        fifa: {
          'dark-red': '#6D0014',
          'indigo': '#4C00D9',
          'navy': '#1A276C',
          'forest': '#005035',
          'red': '#E3000F',
          'lilac': '#AC81F2',
          'blue': '#2552FA',
          'green': '#00B140',
          'orange': '#FF4A00',
          'mauve': '#C66DC9',
          'sky': '#2AA1F8',
          'lime': '#B8ED00',
          'peach': '#FF9E80',
          'magenta': '#E6176D',
          'aqua': '#4EF5D6',
          'yellow': '#EAFF00',
        }
      }
    },
  },
  plugins: [],
}
