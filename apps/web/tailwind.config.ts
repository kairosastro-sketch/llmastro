import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["Cormorant Garamond", "Palatino Linotype", "Georgia", "serif"],
        body:    ["DM Sans", "Helvetica Neue", "sans-serif"],
        mono:    ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        void:    "var(--bg-void)",
        surface: "var(--bg-surface)",
        raised:  "var(--bg-raised)",
        gold:    "var(--gold)",
        "gold-l":"var(--gold-light)",
        primary: "var(--text-primary)",
        secondary:"var(--text-secondary)",
        muted:   "var(--text-muted)",
        harmony: "var(--harmony)",
        tension: "var(--tension)",
      },
      screens: {
        xs: "375px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
      },
      borderRadius: {
        sm:   "var(--r-sm)",
        md:   "var(--r-md)",
        lg:   "var(--r-lg)",
        xl:   "var(--r-xl)",
      },
      animation: {
        "fade-up":  "fadeUp .5s cubic-bezier(.16,1,.3,1) both",
        "fade-in":  "fadeIn .35s cubic-bezier(.16,1,.3,1) both",
        "shimmer":  "shimmer 1.6s ease-in-out infinite",
        "drift":    "driftOrb 25s ease-in-out infinite alternate",
        "spin-slow":"spin 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
