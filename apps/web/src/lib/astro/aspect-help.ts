// ============================================================
// apps/web/src/lib/astro/aspect-help.ts
// AUDIT-UX-TOOLTIPS-V1
// Textes pédagogiques (tooltips) pour le jargon astrologique.
// Clés alignées sur packages/ephemeris ASPECT_TYPES + ASPECTS-MINEURS-V1.
// ============================================================

const ASPECT_HELP: Record<string, { fr: string; en: string }> = {
  conjunction: {
    fr: "Conjonction (0°) : les deux énergies fusionnent et se renforcent.",
    en: "Conjunction (0°): the two energies merge and amplify each other.",
  },
  sextile: {
    fr: "Sextile (60°) : harmonie, opportunités à saisir.",
    en: "Sextile (60°): harmony, opportunities to seize.",
  },
  square: {
    fr: "Carré (90°) : tension dynamique, friction qui pousse à agir.",
    en: "Square (90°): dynamic tension, friction that pushes you to act.",
  },
  trine: {
    fr: "Trigone (120°) : fluidité, talents naturels.",
    en: "Trine (120°): flow, natural talents.",
  },
  opposition: {
    fr: "Opposition (180°) : polarité, équilibre à trouver entre deux pôles.",
    en: "Opposition (180°): polarity, a balance to find between two poles.",
  },
  quincunx: {
    fr: "Quinconce (150°) : ajustement entre deux énergies étrangères l'une à l'autre.",
    en: "Quincunx (150°): adjustment between two energies foreign to each other.",
  },
  semisextile: {
    fr: "Semi-sextile (30°) : affinité légère, soutien discret.",
    en: "Semi-sextile (30°): light affinity, subtle support.",
  },
  semisquare: {
    fr: "Semi-carré (45°) : irritation mineure, tension de fond.",
    en: "Semi-square (45°): minor irritation, background friction.",
  },
  sesquiquadrate: {
    fr: "Sesqui-carré (135°) : tension secondaire qui ressurgit par à-coups.",
    en: "Sesquiquadrate (135°): secondary tension that resurfaces in bursts.",
  },
  quintile: {
    fr: "Quintile (72°) : créativité, talent singulier.",
    en: "Quintile (72°): creativity, a singular talent.",
  },
};

/** Tooltip pédagogique pour un type d'aspect ("conjunction", "sextile"…). */
export function aspectHelp(type: string, locale: string): string | undefined {
  const entry = ASPECT_HELP[type];
  if (!entry) return undefined;
  return locale === "en" ? entry.en : entry.fr;
}

/** Tooltip pédagogique pour la notion d'orbe. */
export function orbHelp(locale: string): string {
  return locale === "en"
    ? "The orb measures the distance from the aspect's exact angle: the smaller it is, the stronger the aspect."
    : "L'orbe mesure l'écart avec l'angle exact de l'aspect : plus il est petit, plus l'aspect est puissant.";
}

/** Tooltip pédagogique pour le badge rétrograde. */
export function retrogradeHelp(locale: string): string {
  return locale === "en"
    ? "Retrograde — the planet appears to move backward as seen from Earth. A time to review rather than launch, in this planet's domain."
    : "Rétrograde — vue de la Terre, la planète semble reculer. Période de révision plutôt que d'action nouvelle, dans le domaine de cette planète.";
}
