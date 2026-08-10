/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-main)",
        panel: "var(--bg-panel)",
        primary: "var(--text-primary)",
      },
    },
  },
  plugins: [],
};
