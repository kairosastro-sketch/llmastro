// ARCHIVE-3-TIERS-V1
// Source de vérité des plans et de leurs entitlements.
// Le seeder upsert ces données en DB au boot de l'API.
// Modifier ce fichier + redeployer = DB mise à jour automatiquement.

import type { PlanCode } from "@astro-platform/types";

// ----------------------------------------------------------
// Feature keys — contrat stable
// ----------------------------------------------------------
// Toute clé utilisée par le code métier doit figurer ici.
// Convention : <module>.<feature>.<aspect>
export const FEATURE_KEYS = {
  // Profils natals
  NATAL_PROFILES_MAX:       "natal.profiles.max",
  NATAL_CHART:              "natal.chart",
  NATAL_WHEEL:              "natal.wheel",
  NATAL_ASPECTS_ADVANCED:   "natal.aspects_advanced",

  // Horoscope
  HOROSCOPE_DAILY:          "horoscope.daily",
  HOROSCOPE_DAILY_FULL:     "horoscope.daily.full",   // PATCH-PLANS-REBRAND-V1 : variant complet (6 thèmes)
  HOROSCOPE_WEEKLY:         "horoscope.weekly",
  HOROSCOPE_MONTHLY:        "horoscope.monthly",
  HOROSCOPE_YEARLY:         "horoscope.yearly",

  // Transits
  TRANSITS_CURRENT:         "transits.current",
  TRANSITS_FORECAST_DAYS:   "transits.forecast_days",
  TRANSITS_BIWHEEL:         "transits.biwheel",

  // IA — quota journalier + pool de crédits cumulables (pack acheté)
  AI_CHAT_DAILY:            "ai.chat.daily",
  AI_CHAT_CREDITS:          "ai.chat.credits",
  AI_NATAL_READING_MONTHLY: "ai.natal_reading.monthly",

  // Tarot
  TAROT_DAILY:              "tarot.daily",
  TAROT_CREDITS:            "tarot.credits",
  TAROT_SPREADS_ALL:        "tarot.spreads_all",

  // Synastrie
  SYNASTRY_MONTHLY:         "synastry.monthly",
  SYNASTRY_CREDITS:         "synastry.credits",

  // Rapports
  REPORTS_MONTHLY_CREDITS:  "reports.monthly_credits",
  REPORTS_CREDITS:          "reports.credits",
  REPORTS_EXPORT_PDF:       "reports.export_pdf",

  // Notifications (utilisés par archive 5, déclarés ici pour cohérence)
  NOTIFICATIONS_IN_APP:           "notifications.in_app",
  NOTIFICATIONS_TRANSITS_MAJOR:   "notifications.transits_major",
  NOTIFICATIONS_TRANSITS_MINOR:   "notifications.transits_minor",
  NOTIFICATIONS_EMAIL:            "notifications.email",
  NOTIFICATIONS_PUSH:             "notifications.push",

  // Divers
  EXPLORE_LEARN:            "explore.learn",
  SUPPORT_PRIORITY:         "support.priority",
  DATA_EXPORT:              "data.export",
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];

// ----------------------------------------------------------
// Plans — catalogue commercial
// ----------------------------------------------------------
export interface PlanConfig {
  code:          PlanCode;
  name:          string;
  description:   string;
  priceCents:    number;
  currency:      string;
  billingPeriod: "month" | "year" | "one_time";
  sortOrder:     number;
  // Entitlements par défaut de ce plan
  entitlements:  Record<string, unknown>;
}

// ----------------------------------------------------------
// Définition des 3 plans
// ----------------------------------------------------------
export const PLANS: PlanConfig[] = [
  // --------------------------------------------------------
  // PATCH-PLANS-REBRAND-V1
  // FREE — "Essentiel" (anciennement "Découverte")
  // --------------------------------------------------------
  {
    code:          "free",
    name:          "Essentiel",
    description:   "Pour découvrir ton ciel et y revenir chaque jour.",
    priceCents:    0,
    currency:      "EUR",
    billingPeriod: "month",
    sortOrder:     1,
    entitlements: {
      // Profils natals — 1 seul en free
      [FEATURE_KEYS.NATAL_PROFILES_MAX]:       1,
      [FEATURE_KEYS.NATAL_CHART]:              true,
      [FEATURE_KEYS.NATAL_WHEEL]:              true,
      [FEATURE_KEYS.NATAL_ASPECTS_ADVANCED]:   false,

      // Horoscope : jour (version simple) + semaine + mois. Année verrouillée.
      [FEATURE_KEYS.HOROSCOPE_DAILY]:          true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_FULL]:     false,   // version courte économique
      [FEATURE_KEYS.HOROSCOPE_WEEKLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_MONTHLY]:        true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY]:         false,

      // Transits — forecast 7 jours, pas de biwheel
      [FEATURE_KEYS.TRANSITS_CURRENT]:         true,
      [FEATURE_KEYS.TRANSITS_FORECAST_DAYS]:   7,
      [FEATURE_KEYS.TRANSITS_BIWHEEL]:         false,

      // Kairos — 4 msg/jour (court mais suffisant pour sentir le produit)
      [FEATURE_KEYS.AI_CHAT_DAILY]:            { per: "day",   max: 4 },
      [FEATURE_KEYS.AI_NATAL_READING_MONTHLY]: { per: "month", max: 0 },

      // Tarot — 1 tirage/jour
      [FEATURE_KEYS.TAROT_DAILY]:              { per: "day",   max: 1 },
      [FEATURE_KEYS.TAROT_SPREADS_ALL]:        false,

      // Synastrie — aucune en free
      [FEATURE_KEYS.SYNASTRY_MONTHLY]:         { per: "month", max: 0 },

      // Rapports — aucun
      [FEATURE_KEYS.REPORTS_MONTHLY_CREDITS]:  { per: "month", max: 0 },
      [FEATURE_KEYS.REPORTS_EXPORT_PDF]:       false,

      // Notifs — toutes accessibles (décision produit : notifs = levier de rétention,
      // pas à paywaller)
      [FEATURE_KEYS.NOTIFICATIONS_IN_APP]:           true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MAJOR]:   true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MINOR]:   false,
      [FEATURE_KEYS.NOTIFICATIONS_EMAIL]:            true,
      [FEATURE_KEYS.NOTIFICATIONS_PUSH]:             true,

      // Divers
      [FEATURE_KEYS.EXPLORE_LEARN]:            true,
      [FEATURE_KEYS.SUPPORT_PRIORITY]:         false,
      [FEATURE_KEYS.DATA_EXPORT]:              false,
    },
  },

  // --------------------------------------------------------
  // ESSENTIAL (code DB conservé) — "Passionné" (anciennement "Essentiel")
  // Ta matrice : 12,90€, profils illimités, Kairos 50/j, tarot illimité,
  // synastries illimitées, horoscope yearly, aspects avancés, lectures IA 2/mois.
  // --------------------------------------------------------
  {
    code:          "essential",
    name:          "Passionné",
    description:   "Pour suivre ton thème en profondeur et sans limite.",
    priceCents:    1290,
    currency:      "EUR",
    billingPeriod: "month",
    sortOrder:     2,
    entitlements: {
      [FEATURE_KEYS.NATAL_PROFILES_MAX]:       -1,   // illimité
      [FEATURE_KEYS.NATAL_CHART]:              true,
      [FEATURE_KEYS.NATAL_WHEEL]:              true,
      [FEATURE_KEYS.NATAL_ASPECTS_ADVANCED]:   true,

      [FEATURE_KEYS.HOROSCOPE_DAILY]:          true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_FULL]:     true,    // version complète avec 6 thèmes
      [FEATURE_KEYS.HOROSCOPE_WEEKLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_MONTHLY]:        true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY]:         true,

      [FEATURE_KEYS.TRANSITS_CURRENT]:         true,
      [FEATURE_KEYS.TRANSITS_FORECAST_DAYS]:   90,
      [FEATURE_KEYS.TRANSITS_BIWHEEL]:         true,

      [FEATURE_KEYS.AI_CHAT_DAILY]:            { per: "day",   max: 50 },
      [FEATURE_KEYS.AI_NATAL_READING_MONTHLY]: { per: "month", max: 2 },

      [FEATURE_KEYS.TAROT_DAILY]:              { per: "day",   max: -1 },   // illimité
      [FEATURE_KEYS.TAROT_SPREADS_ALL]:        true,

      [FEATURE_KEYS.SYNASTRY_MONTHLY]:         { per: "month", max: -1 },   // illimité

      [FEATURE_KEYS.REPORTS_MONTHLY_CREDITS]:  { per: "month", max: 2 },
      [FEATURE_KEYS.REPORTS_EXPORT_PDF]:       true,

      [FEATURE_KEYS.NOTIFICATIONS_IN_APP]:           true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MAJOR]:   true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MINOR]:   true,
      [FEATURE_KEYS.NOTIFICATIONS_EMAIL]:            true,
      [FEATURE_KEYS.NOTIFICATIONS_PUSH]:             true,

      [FEATURE_KEYS.EXPLORE_LEARN]:            true,
      [FEATURE_KEYS.SUPPORT_PRIORITY]:         false,
      [FEATURE_KEYS.DATA_EXPORT]:              true,
    },
  },

  // --------------------------------------------------------
  // PREMIUM (code DB conservé) — "Pro" (soft-launch)
  // Tarif "Sur mesure" — features à définir selon demandes.
  // priceCents = 0 → la page pricing affichera "Sur mesure" (géré côté front).
  // --------------------------------------------------------
  {
    code:          "premium",
    name:          "Pro",
    description:   "Pour les praticiens — bientôt disponible.",
    priceCents:    0,
    currency:      "EUR",
    billingPeriod: "month",
    sortOrder:     3,
    entitlements: {
      // Valeurs provisoires : cohérentes avec Passionné en attendant la définition
      // fine des features Pro. Aucun user ne peut souscrire pour le moment
      // (checkout désactivé côté front).
      [FEATURE_KEYS.NATAL_PROFILES_MAX]:       -1,
      [FEATURE_KEYS.NATAL_CHART]:              true,
      [FEATURE_KEYS.NATAL_WHEEL]:              true,
      [FEATURE_KEYS.NATAL_ASPECTS_ADVANCED]:   true,

      [FEATURE_KEYS.HOROSCOPE_DAILY]:          true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_FULL]:     true,
      [FEATURE_KEYS.HOROSCOPE_WEEKLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_MONTHLY]:        true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY]:         true,

      [FEATURE_KEYS.TRANSITS_CURRENT]:         true,
      [FEATURE_KEYS.TRANSITS_FORECAST_DAYS]:   365,
      [FEATURE_KEYS.TRANSITS_BIWHEEL]:         true,

      [FEATURE_KEYS.AI_CHAT_DAILY]:            { per: "day",   max: 200 },   // cap généreux
      [FEATURE_KEYS.AI_NATAL_READING_MONTHLY]: { per: "month", max: 10 },

      [FEATURE_KEYS.TAROT_DAILY]:              { per: "day",   max: -1 },
      [FEATURE_KEYS.TAROT_SPREADS_ALL]:        true,

      [FEATURE_KEYS.SYNASTRY_MONTHLY]:         { per: "month", max: -1 },

      [FEATURE_KEYS.REPORTS_MONTHLY_CREDITS]:  { per: "month", max: 10 },
      [FEATURE_KEYS.REPORTS_EXPORT_PDF]:       true,

      [FEATURE_KEYS.NOTIFICATIONS_IN_APP]:           true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MAJOR]:   true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MINOR]:   true,
      [FEATURE_KEYS.NOTIFICATIONS_EMAIL]:            true,
      [FEATURE_KEYS.NOTIFICATIONS_PUSH]:             true,

      [FEATURE_KEYS.EXPLORE_LEARN]:            true,
      [FEATURE_KEYS.SUPPORT_PRIORITY]:         true,
      [FEATURE_KEYS.DATA_EXPORT]:              true,
    },
  },
];


// ----------------------------------------------------------
// Trial config
// ----------------------------------------------------------
export const TRIAL_CONFIG = {
  // Plan donné pendant le trial à chaque nouvel inscrit
  TRIAL_PLAN_CODE: "essential" as PlanCode,
  TRIAL_DAYS:      7,
  // Plan de fallback après expiration du trial
  DEFAULT_PLAN_CODE: "free" as PlanCode,
};

// ----------------------------------------------------------
// Enforcement flag
// ----------------------------------------------------------
// Lu à chaque requête. Si false, les middlewares loguent mais n'interdisent rien.
// À passer à true seulement après déploiement de l'archive 4 (UI).
export function isEnforcementActive(): boolean {
  return process.env["ENTITLEMENTS_ENFORCED"] === "true";
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
export function getValueType(value: unknown): "boolean" | "limit" | "credit" | "json" {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "limit";
  if (value && typeof value === "object" && "per" in value && "max" in value) {
    return "limit";
  }
  return "json";
}

export function getPlanByCode(code: string): PlanConfig | undefined {
  return PLANS.find((p) => p.code === code);
}
