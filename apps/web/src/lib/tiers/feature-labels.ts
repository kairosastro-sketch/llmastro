// PAYWALL-FRONT-V1
// Dictionnaire centralisé feature-key → libellé humain + plan minimum
// requis. Utilisé par PaywallModal (modal d'upsell) et /pricing (banner
// quand on arrive avec ?feature=).
//
// Toutes les features bloquées sur "free" sont actuellement débloquées
// par "essential" (cf. apps/api/src/config/plans.config.ts). Si un jour
// une feature devient premium-only, on remappe ici.

export type PlanCode = "free" | "essential" | "premium";

export const HUMAN_FEATURE_LABELS: Record<string, string> = {
  "natal.profiles.max":         "Plusieurs profils natals",
  "natal.aspects_advanced":     "Les aspects avancés (harmoniques, mineurs)",
  "synastry.monthly":           "La synastrie",
  "synastry.detail":            "Le détail de synastrie",
  "transits.biwheel":           "Le bi-wheel des transits",
  "transits.detail":            "Le détail des transits",
  "transits.forecast_days":     "Les prévisions sur plus de 7 jours",
  "horoscope.weekly":           "L'horoscope de la semaine",
  "horoscope.monthly":          "L'horoscope du mois",
  "horoscope.yearly":           "L'horoscope de l'année",
  "horoscope.yearly_detail":    "L'horoscope annuel détaillé",
  "horoscope.daily_full":       "L'horoscope du jour complet",
  // PAYWALL-V3 : nouveau quota mensuel d'horoscopes du jour Kairos.
  "horoscope.day":              "L'horoscope du jour Kairos",
  "horoscope.daily.monthly":    "Davantage d'horoscopes du jour ce mois",
  "reports.export_pdf":         "L'export PDF",
  "reports.monthly_credits":    "Les rapports détaillés",
  "reports":                    "Les rapports détaillés",
  "tarot.spreads_all":          "Les tirages de tarot avancés",
  "tarot.detail":               "Le détail des tirages",
  "tarot.monthly":              "Davantage de tirages de tarot",
  "tarot":                      "Les tirages de tarot",
  "ai.chat":                    "Les conversations illimitées avec Kairos",
  "ai.chat.monthly":            "Davantage de conversations avec Kairos",
  // PAYWALL-V3 : ai.natal_reading retiré (feature gratuite pour tous).
  // Si une ancienne entrée est encore référencée par le PaywallModal après
  // un cache navigateur stale, on tombe sur le label par défaut.
  "chat.save_count":            "Davantage de conversations sauvegardées",
};
// COSMETIC-PASS-V1 : « Plus de X » → « Davantage de X » — dans le contexte
// paywall (« Débloque : plus de tirages »), « plus de » se lit aussi comme
// une négation (« plus aucun tirage »). « Davantage » est sans ambiguïté.

export function humanFeatureLabel(featureKey: string | null | undefined): string | null {
  if (!featureKey) return null;
  return HUMAN_FEATURE_LABELS[featureKey] ?? null;
}

// Pour l'instant toutes les features bloquées sur free sont débloquées
// par "essential". Future-proof : on garde la fonction pour pouvoir
// router certaines features vers "premium" plus tard.
export function recommendedPlanFor(_featureKey: string | null | undefined): Exclude<PlanCode, "free"> {
  return "essential";
}

// PAYWALL-FRONT-V1 applied
