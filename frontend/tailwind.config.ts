import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette
        brand: {
          gold: "#D1AE62",
          black: "#000000",
          brown: "#342C19",
          silver: "#D9D9D9",
        },
        primary: {
          gold: "#D1AE62",
          dark: "#342C19",
          light: "#F3E7C9",
          DEFAULT: "#D1AE62",
          500: "#D1AE62",
          600: "#D1AE62",
          700: "#342C19",
        },
        // Semantic colors (kept for status; not part of core brand duo)
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#342C19",
        // Sidebar (black + gold + silver text)
        sidebar: {
          bg: "#000000",
          text: "#D9D9D9",
          muted: "#9CA3AF",
          active: "#D1AE62",
          hover: "#342C19",
        },
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #000000 0%, #342C19 32%, #D9D9D9 52%, #342C19 72%, #D1AE62 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, #FFFFFF 0%, #D9D9D9 45%, #F5F0E6 100%)",
        "brand-bar":
          "linear-gradient(90deg, #000000 0%, #342C19 35%, #D1AE62 100%)",
      },
      fontSize: {
        // Increased for readability (not dense admin UI)
        base: ["0.9375rem", { lineHeight: "1.625" }], // 15px
        sm: ["0.8125rem", { lineHeight: "1.5" }], // 13px
        xs: ["0.75rem", { lineHeight: "1.5" }], // 12px
        meta: ["0.6875rem", { lineHeight: "1.5" }], // 11px
      },
    },
  },
  plugins: [],
};
export default config;

