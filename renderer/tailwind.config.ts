import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./renderer/app/**/*.{ts,tsx}",
    "./renderer/components/**/*.{ts,tsx}",
    "./renderer/hooks/**/*.{ts,tsx}",
    "./renderer/store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--text-high)",
        line: "var(--border-default)",
        paper: "var(--bg-solid)",
        mint: "var(--bg-card)",
        teal: "var(--bg-teal)",
        accent: "var(--accent-primary)",
        danger: "var(--color-danger)",
        clay: "var(--text-primary)",
        saffron: "var(--text-message)"
      }
    }
  },
  plugins: []
};

export default config;
