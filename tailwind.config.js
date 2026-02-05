/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          'SF Mono',
          'SFMono-Regular',
          'JetBrains Mono',
          'Fira Code',
          'Monaco',
          'Consolas',
          'monospace'
        ],
      },
      fontSize: {
        '2xs': '0.6875rem',  // 11px
      },
      colors: {
        // macOS-inspired professional palette
        surface: {
          DEFAULT: '#1e1e1e',
          secondary: '#252526',
          tertiary: '#2d2d30',
          hover: '#3e3e42',
          active: '#094771',
        },
        text: {
          DEFAULT: '#cccccc',
          secondary: '#9cdcfe',
          muted: '#858585',
          disabled: '#6e6e6e',
        },
        border: {
          DEFAULT: '#3e3e42',
          subtle: '#2d2d30',
          active: '#007acc',
        },
        accent: {
          DEFAULT: '#007acc',
          hover: '#1177bb',
          subtle: '#094771',
        },
        // Semantic colors
        error: '#f14c4c',
        warning: '#cca700',
        success: '#89d185',
        info: '#3794ff',
      },
    },
  },
  plugins: [],
}
