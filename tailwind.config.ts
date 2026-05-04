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
        white: "#FAF9F6",
        charcoal: {
          DEFAULT: "#2A2A28",
          light: "#4A4A47",
          muted: "#8A8A85",
        },
        olive: {
          DEFAULT: "#6B7845",
          light: "#8A9A5A",
          dim: "#E8EBD8",
        },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        sans: ["Jost", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.65rem", { letterSpacing: "0.2em" }],
        xs: ["0.72rem", { letterSpacing: "0.14em" }],
      },
      transitionTimingFunction: {
        refined: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      },
      transitionDuration: {
        DEFAULT: "400ms",
      },
      borderColor: {
        DEFAULT: "rgba(42,42,40,0.12)",
        strong: "rgba(42,42,40,0.22)",
      },
      backdropBlur: {
        nav: "12px",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease forwards",
        "hero-reveal": "heroReveal 1.2s 0.4s both",
        "scroll-bob": "scrollBob 2s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        heroReveal: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scrollBob: {
          "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
          "50%": { transform: "translateX(-50%) translateY(6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      columns: {
        "2": "2",
        "3": "3",
        "4": "4",
      },
    },
  },
  plugins: [],
};

export default config;