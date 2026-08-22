/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sci: {
          base: '#050505',
          panel: '#0a0f14',
          obsidian: '#11161d',
          cyan: '#00f3ff',
          violet: '#bc13fe',
          green: '#0aff00',
          red: '#ff2a00',
          text: '#e0f7fa',
          dim: '#566e7a',
        }
      },
      fontFamily: {
        sci: ['Rajdhani', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(0, 243, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 243, 255, 0.04) 1px, transparent 1px)",
      },
      boxShadow: {
        'neon-cyan': '0 0 5px rgba(0,243,255,0.6), 0 0 16px rgba(0,243,255,0.3)',
        'neon-cyan-sm': '0 0 4px rgba(0,243,255,0.5)',
        'neon-violet': '0 0 5px rgba(188,19,254,0.6), 0 0 16px rgba(188,19,254,0.3)',
        'neon-green': '0 0 5px rgba(10,255,0,0.55)',
        'neon-red': '0 0 5px rgba(255,42,0,0.55)',
      },
      animation: {
        'reverse-spin': 'reverse-spin 10s linear infinite',
        'scanline': 'scanline 8s linear infinite',
        'glitch': 'glitch 1s linear infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'hologram': 'hologram 4s infinite',
        'decode': 'decode 0.5s steps(10, end)',
        'flicker': 'flicker 4s linear infinite',
      },
      keyframes: {
        'reverse-spin': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'glitch': {
          '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
          '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
          '62%': { transform: 'translate(0,0) skew(5deg)' },
        },
        'hologram': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 },
          '52%': { opacity: 0.5 },
          '54%': { opacity: 0.8 },
          '56%': { opacity: 1 },
        },
        'flicker': {
          '0%, 18%, 22%, 25%, 53%, 57%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.35' },
        }
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["night"],
    darkTheme: "night",
  },
}
