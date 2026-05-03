// ============================================================
// DESIGN-SYSTEM-CLEANUP-V1 — apps/web/tailwind.config.ts
// ------------------------------------------------------------
// Config minimale, alignée sur la réalité du DS de globals.css.
//
// Principes :
//  - Ne déclare via Tailwind QUE les couleurs utilisées en classes
//    type bg-gold/border-gold/text-gold (et qui ne sont pas déjà
//    fournies comme utility par globals.css @layer utilities).
//  - Les autres tokens (--star, --muted, --muted-2, --bg, etc.)
//    sont accessibles uniquement en var(--xxx) inline ou via les
//    utilities .text-star/.text-muted/.text-muted-2/.text-gold/
//    .font-display définies dans globals.css:1516+.
//  - Pas de polices web : globals.css force du système
//    (Trebuchet MS body, Georgia display).
//
// Supprimé par cette config :
//  - Couleurs basées sur des vars inexistantes (void, surface,
//    primary, secondary, muted, gold-l → 0 usages)
//  - Couleurs OK mais inutilisées (raised, harmony, tension
//    → 0 usages en classes ; gardées au minimum pour usage futur
//    cohérent avec les pill-h/pill-t)
//  - 3 polices web (Cormorant Garamond, DM Sans, JetBrains Mono)
//    shadowed par globals.css de toute façon
//  - 5 animations (fade-up, fade-in, shimmer, drift, spin-slow)
//    shadowed (animate-fade-*) ou cassées (drift/shimmer/spin-slow
//    sans @keyframes définis)
//  - Breakpoint xs:375px → 0 usages
//  - Le scan packages/ui qui n'a pas de src/
// ============================================================

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold:    "var(--gold)",
        harmony: "var(--harmony)",
        tension: "var(--tension)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
    },
  },
  plugins: [],
};

export default config;

// DESIGN-SYSTEM-CLEANUP-V1 applied
