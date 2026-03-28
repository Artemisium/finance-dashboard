/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a12',
          secondary: '#10101c',
          card: '#16162a',
          hover: '#1e1e38',
        },
        border: {
          DEFAULT: '#2a2a45',
          light: '#3a3a5c',
        },
        accent: {
          teal: '#4ecca3',
          purple: '#7c6af7',
          amber: '#f5a623',
          red: '#ef4444',
          green: '#22c55e',
        },
        text: {
          primary: '#e8e8f5',
          secondary: '#8888aa',
          muted: '#55556a',
        },
        mountain: {
          fill: '#12122a',
          stroke: '#2a2a50',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
