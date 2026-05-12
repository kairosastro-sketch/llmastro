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
  "reports.export_pdf":         "L'export PDF",
  "reports.monthly_credits":    "Les rapports détaillés",
  "reports":                    "Les rapports détaillés",
  "tarot.spreads_all":          "Les tirages de tarot avancés",
  "tarot.detail":               "Le détail des tirages",
  "tarot.monthly":              "Plus de tirages de tarot",
  "tarot":                      "Les tirages de tarot",
  "ai.chat":                    "Les conversations illimitées avec Kairos",
  "ai.chat.monthly":            "Plus de conversations avec Kairos",
  "ai.natal_reading":           "La lecture complète de thème natal",
  "ai.natal_reading.monthly":   "Plus de lectures complètes",
  "chat.save_count":            "Plus de conversations sauvegardées",
};

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
