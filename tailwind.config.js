/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      colors: {
        navy: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          500: "#1a3a6e",
          600: "#122d5c",
          700: "#0d2248",
          800: "#091a38",
          900: "#050f22",
        },
        ocean: { 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7" },
        sand: { 100: "#fef9f0", 200: "#fdf0d5", 300: "#f5d99a" },
      },
    },
  },
  plugins: [],
};