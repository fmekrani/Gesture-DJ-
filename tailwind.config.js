/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: '#0b0f14',
        panel: 'rgba(255,255,255,0.04)',
        neon: {
          100: '#e1d7ff',
          300: '#c084fc',
          500: '#a855f7',
          700: '#7c3aed'
        }
      },
      boxShadow: {
        neon: '0 10px 40px rgba(168,85,247,0.2)',
        glass: '0 8px 24px rgba(0,0,0,0.45)'
      }
    }
  },
  plugins: []
};
