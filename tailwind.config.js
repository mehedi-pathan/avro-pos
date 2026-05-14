/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./renderer/app/**/*.{ts,tsx}",
    "./renderer/components/**/*.{ts,tsx}",
    "./renderer/hooks/**/*.{ts,tsx}",
    "./renderer/store/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        line: "#d9e2dc",
        paper: "#fbfcfa",
        mint: "#d8f1df",
        teal: "#247b7b",
        clay: "#b66b4d",
        saffron: "#e5a936"
      }
    }
  },
  plugins: []
};
