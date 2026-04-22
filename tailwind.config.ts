import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // A quiet warm library palette — paper, ink, oak, lamp glow.
        paper:       { 50: "#fbf6ec", 100: "#f6eeda", 200: "#eadec1", 300: "#dcc9a1", 400: "#c9ad7e", 500: "#b08e5c" },
        ink:         { 100: "#5a4a3a", 200: "#473830", 300: "#342a22", 400: "#231a14", 500: "#14100b" },
        oak:         { 100: "#8a6f4f", 200: "#6b5138", 300: "#4f3a27", 400: "#3a2a1c", 500: "#2a1e14" },
        lamp:        "#f6b660",
        sepia:       { bg: "#f6ecd5", ink: "#3d2f1f", rule: "#caa172" },
        night:       { bg: "#15110c", ink: "#e4d6b8", rule: "#3a2f23" },
      },
      fontFamily: {
        // Typography matters a lot for a library-feel reader.
        serif: ["'Cormorant Garamond'", "'Iowan Old Style'", "'Palatino'", "Georgia", "serif"],
        sans:  ["'Inter'", "system-ui", "sans-serif"],
        display: ["'Playfair Display'", "'Cormorant Garamond'", "Georgia", "serif"],
      },
      boxShadow: {
        "book": "0 30px 60px -30px rgba(42,30,20,0.5), 0 12px 20px -12px rgba(42,30,20,0.3)",
        "card": "0 8px 20px -10px rgba(42,30,20,0.25)",
        "spine": "inset 6px 0 10px -6px rgba(0,0,0,0.25)",
      },
      backgroundImage: {
        "library-wall":  "radial-gradient(ellipse at 50% -10%, #f0e5cf 0%, #e2d2b2 40%, #cbb48c 100%)",
        "reading-desk":  "radial-gradient(ellipse at 50% 30%, #f1e4c7 0%, #d4b889 60%, #8c6b41 100%)",
        "night-hall":    "radial-gradient(ellipse at 50% 30%, #2a1f14 0%, #1a130c 60%, #0a0705 100%)",
        "paper-grain":   "repeating-linear-gradient(0deg, rgba(255,220,170,0.05) 0 1px, transparent 1px 4px)",
      },
      maxWidth: {
        "reader": "38rem",   // ~608px — comfortable long-form column
        "shelf":  "80rem",
      },
      fontSize: {
        "reader": ["1.125rem", { lineHeight: "1.85" }],
      },
    },
  },
  plugins: [],
};
export default config;
