import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#002060",
          deep: "#00143d",
          soft: "#e7eef8",
        },
        ink: "#1c2430",
        muted: "#5e6874",
        line: "#e4ddd2",
        paper: "#f3efe7",
        card: "#fffcf8",
      },
      fontFamily: {
        sans: ["Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Palatino Linotype", "Palatino", "Georgia", "serif"],
      },
      boxShadow: {
        sheet: "0 16px 40px rgba(28, 36, 48, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
