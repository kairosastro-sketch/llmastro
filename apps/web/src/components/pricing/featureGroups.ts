// ARCHIVE-PRICING-PAGE-V2
// Catalogue central des features avec leur catégorisation.
// Source unique de vérité pour la page /pricing.

export interface FeatureSpec {
  key: string;
  label: string;
  // PRICING-SYNASTRY-DEFINE-V1 : définition courte pour le jargon
  // (tooltip natif au survol du label). Pour les visiteurs non initiés
  // qui comparent les plans sans connaître les termes.
  hint?: string;
}

export interface FeatureGroupSpec {
  id: string;
  glyph: string;
  title: string;
  features: FeatureSpec[];
}

/**
 * 5 groupes thématiques pour structurer les features visibles.
 * Chaque groupe a son glyphe ésotérique et ses features.
 *
 * Ordre interne pensé pour mettre en avant les features clés de chaque tier
 * (ex: ai.chat.monthly avant ai.natal_reading dans Kairos & IA).
 */
export const FEATURE_GROUPS: FeatureGroupSpec[] = [
  {
    id: "fundamentals",
    glyph: "✦",
    title: "Fondamentaux",
    features: [
      { key: "natal.profiles.max",      label: "Profils natals" },
      { key: "horoscope.daily",         label: "Horoscope du jour" },
      { key: "horoscope.weekly",        label: "Horoscope de la semaine" },
      { key: "horoscope.monthly",       label: "Horoscope du mois" },
      { key: "horoscope.yearly",        label: "Horoscope de l'année" },
      { key: "horoscope.yearly.detail", label: "Annuel détaillé" },
      { key: "natal.aspects_advanced",  label: "Aspects avancés" },
    ],
  },
  {
    id: "kairos",
    glyph: "☉",
    title: "Kairos & IA",
    features: [
      { key: "ai.chat.monthly",          label: "Messages Kairos / mois" },
      { key: "horoscope.daily.monthly", label: "Horoscopes du jour Kairos / mois" },
    ],
  },
  {
    id: "tarot",
    glyph: "◐",
    title: "Tarot & Synastrie",
    features: [
      { key: "tarot.monthly",     label: "Tirages de tarot / mois" },
      { key: "tarot.detail",      label: "Tarot détaillé" },
      { key: "tarot.spreads_all", label: "Tirages avancés" },
      {
        key: "synastry.monthly",
        label: "Synastries / mois",
        hint: "La synastrie superpose deux thèmes natals et lit ce qui se joue entre les deux personnes — couple, amitié ou travail.",
      },
      {
        key: "synastry.detail",
        label: "Synastrie détaillée",
        hint: "Version approfondie : chaque aspect entre tes planètes et celles de l'autre, expliqué un par un.",
      },
      { key: "tarot_save_count",  label: "Tirages sauvegardés" },
    ],
  },
  {
    id: "transits",
    glyph: "⚹",
    title: "Transits & Rapports",
    features: [
      { key: "transits.forecast_days",  label: "Prévisions (jours)" },
      {
        key: "transits.biwheel",
        label: "Bi-wheel (thème + transits)",
        hint: "Deux roues superposées : ton thème natal à l'intérieur, le ciel du moment autour.",
      },
      { key: "transits.detail",         label: "Transits détaillés" },
      { key: "reports.monthly_credits", label: "Rapports détaillés / mois" },
      { key: "reports.export_pdf",      label: "Export PDF" },
    ],
  },
  {
    id: "account",
    glyph: "⚙",
    title: "Compte",
    features: [
      { key: "reading.regenerate",     label: "Régénérer une lecture" },
      { key: "history.retention_days", label: "Historique (jours)" },
      { key: "chat_save_count",        label: "Conversations sauvegardées" },
      { key: "data.export",            label: "Export de tes données" },
      { key: "support.priority",       label: "Support prioritaire" },
    ],
  },
];

/** Liste plate de toutes les features (utile pour le tableau comparatif). */
export const ALL_FEATURES: FeatureSpec[] = FEATURE_GROUPS.flatMap((g) => g.features);

// PRICING-SYNASTRY-DEFINE-V1 applied (hints jargon : synastrie, bi-wheel)
