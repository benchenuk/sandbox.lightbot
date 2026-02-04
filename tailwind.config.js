/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'SF Mono',
          'Monaco',
          'Cascadia Code',
          'Roboto Mono',
          'Consolas',
          'monospace'
        ],
      },
      colors: {
        // TUI-inspired color palette
        terminal: {
          bg: '#0d0d0d',
          fg: '#e0e0e0',
          dim: '#6c6c6c',
          accent: '#00d4aa',
          secondary: '#5c7aea',
          error: '#ff5f56',
          warning: '#ffbd2e',
          success: '#27c93f',
          border: '#2a2a2a',
        },
      },
    },
  },
  plugins: [],
}
