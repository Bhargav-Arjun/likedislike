/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          blue: '#378ADD',
          teal: '#1D9E75',
          coral: '#D85A30',
          pink: '#D4537E',
          amber: '#BA7517',
          purple: '#7F77DD',
        },
      },
    },
  },
  plugins: [],
};
