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
  HOROSCOPE_DAILY_FULL:     "horoscope.daily.full",   // version complète (6 thèmes)
  HOROSCOPE_DAILY_MONTHLY:  "horoscope.daily.monthly", // PAYWALL-V3 : quota mensuel d'horoscopes du jour Kairos
  HOROSCOPE_WEEKLY:         "horoscope.weekly",
  HOROSCOPE_MONTHLY:        "horoscope.monthly",
  HOROSCOPE_YEARLY:         "horoscope.yearly",
  HOROSCOPE_YEARLY_DETAIL:  "horoscope.yearly.detail",   // V2 : annuel détaillé (résumé pour Découverte)

  // Transits
  TRANSITS_CURRENT:         "transits.current",
  TRANSITS_FORECAST_DAYS:   "transits.forecast_days",
  TRANSITS_BIWHEEL:         "transits.biwheel",
  TRANSITS_DETAIL:          "transits.detail",   // V2 : interprétation détaillée des transits

  // IA — quota mensuel + pool de crédits cumulables (pack acheté)
  // V2 : passage de daily à monthly pour ai.chat (cohérent avec billing)
  AI_CHAT_MONTHLY:          "ai.chat.monthly",
  AI_CHAT_CREDITS:          "ai.chat.credits",
  // PAYWALL-V3 : ai.natal_reading.monthly retiré — la feature "Profil
  // psychologique Kairos" est devenue gratuite pour tous (cache backend
  // assure que le coût xAI reste borné). Le quota mensuel s'est déplacé
  // sur l'horoscope du jour (HOROSCOPE_DAILY_MONTHLY).

  // Tarot
  // V2 : passage de daily à monthly pour le quota principal
  TAROT_MONTHLY:            "tarot.monthly",
  TAROT_CREDITS:            "tarot.credits",
  TAROT_SPREADS_ALL:        "tarot.spreads_all",
  TAROT_DETAIL:             "tarot.detail",   // V2 : interprétation détaillée

  // Synastrie
  SYNASTRY_MONTHLY:         "synastry.monthly",
  SYNASTRY_CREDITS:         "synastry.credits",
  SYNASTRY_DETAIL:          "synastry.detail",   // V2 : interprétation détaillée

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

  // Lectures & historique (V2)
  READING_REGENERATE:       "reading.regenerate",       // V2 : Pro only
  HISTORY_RETENTION_DAYS:   "history.retention_days",   // V2 : durée de conservation

  // Chat — sauvegarde de conversations (CHAT-PERSISTENCE-V1)
  CHAT_SAVE_COUNT:          "chat_save_count",          // limite de conversations sauvegardables
  CHAT_SAVE_TTL_DAYS:       "chat_save_ttl_days",       // jours avant purge auto (-1 = pas de purge)

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
  // V2 — FREE = "Découverte"
  // Gratuit, pour explorer les bases du produit.
  // --------------------------------------------------------
  {
    code:          "free",
    name:          "Découverte",
    description:   "Pose les bases. Gratuit, pour explorer ton ciel.",
    priceCents:    0,
    currency:      "EUR",
    billingPeriod: "month",
    sortOrder:     1,
    entitlements: {
      // Profils natals — 1 seul en Découverte
      [FEATURE_KEYS.NATAL_PROFILES_MAX]:       1,
      [FEATURE_KEYS.NATAL_CHART]:              true,
      [FEATURE_KEYS.NATAL_WHEEL]:              true,
      [FEATURE_KEYS.NATAL_ASPECTS_ADVANCED]:   false,

      // Horoscope : tous accessibles, mais résumé sur daily.full + yearly.detail
      // PAYWALL-V3 : quota mensuel de 5 horoscopes du jour Kairos sur free.
      // La notification push quotidienne reste gratuite illimitée.
      [FEATURE_KEYS.HOROSCOPE_DAILY]:          true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_FULL]:     false,
      [FEATURE_KEYS.HOROSCOPE_DAILY_MONTHLY]:  { per: "month", max: 5 },
      [FEATURE_KEYS.HOROSCOPE_WEEKLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_MONTHLY]:        true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY_DETAIL]:  false,

      // Transits — forecast 7 jours, pas de biwheel ni détail
      [FEATURE_KEYS.TRANSITS_CURRENT]:         true,
      [FEATURE_KEYS.TRANSITS_FORECAST_DAYS]:   7,
      [FEATURE_KEYS.TRANSITS_BIWHEEL]:         false,
      [FEATURE_KEYS.TRANSITS_DETAIL]:          false,

      // Kairos — 30 messages/mois (cap mensuel)
      [FEATURE_KEYS.AI_CHAT_MONTHLY]:          { per: "month", max: 30 },

      // Sauvegarde chat — 1 conversation, purgée après 30 jours
      [FEATURE_KEYS.CHAT_SAVE_COUNT]:          1,
      [FEATURE_KEYS.CHAT_SAVE_TTL_DAYS]:       30,

      // Tarot — 5 tirages/mois, résumés
      [FEATURE_KEYS.TAROT_MONTHLY]:            { per: "month", max: 5 },
      [FEATURE_KEYS.TAROT_DETAIL]:             false,
      [FEATURE_KEYS.TAROT_SPREADS_ALL]:        false,

      // Synastrie — 1/mois, résumée
      [FEATURE_KEYS.SYNASTRY_MONTHLY]:         { per: "month", max: 1 },
      [FEATURE_KEYS.SYNASTRY_DETAIL]:          false,

      // Rapports — aucun
      [FEATURE_KEYS.REPORTS_MONTHLY_CREDITS]:  { per: "month", max: 0 },
      [FEATURE_KEYS.REPORTS_EXPORT_PDF]:       false,

      // Lectures & historique
      [FEATURE_KEYS.READING_REGENERATE]:       false,
      [FEATURE_KEYS.HISTORY_RETENTION_DAYS]:   30,

      // Notifs — toutes accessibles (rétention)
      [FEATURE_KEYS.NOTIFICATIONS_IN_APP]:           true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MAJOR]:   true,
      [FEATURE_KEYS.NOTIFICATIONS_TRANSITS_MINOR]:   false,
      [FEATURE_KEYS.NOTIFICATIONS_EMAIL]:            true,
      [FEATURE_KEYS.NOTIFICATIONS_PUSH]:             true,

      // Divers
      [FEATURE_KEYS.EXPLORE_LEARN]:            true,
      [FEATURE_KEYS.SUPPORT_PRIORITY]:         false,
      [FEATURE_KEYS.DATA_EXPORT]:              true,
    },
  },

  // --------------------------------------------------------
  // V2 — ESSENTIAL (code DB conservé) = "Essentiel" (rebrand)
  // 9,90€/mois — pour aller plus loin sur thème et lectures.
  // --------------------------------------------------------
  {
    code:          "essential",
    name:          "Essentiel",
    description:   "Pour aller plus loin sur ton thème et tes lectures.",
    priceCents:    990,
    currency:      "EUR",
    billingPeriod: "month",
    sortOrder:     2,
    entitlements: {
      [FEATURE_KEYS.NATAL_PROFILES_MAX]:       3,
      [FEATURE_KEYS.NATAL_CHART]:              true,
      [FEATURE_KEYS.NATAL_WHEEL]:              true,
      [FEATURE_KEYS.NATAL_ASPECTS_ADVANCED]:   true,

      [FEATURE_KEYS.HOROSCOPE_DAILY]:          true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_FULL]:     true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_MONTHLY]:  { per: "month", max: -1 },
      [FEATURE_KEYS.HOROSCOPE_WEEKLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_MONTHLY]:        true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY_DETAIL]:  true,

      [FEATURE_KEYS.TRANSITS_CURRENT]:         true,
      [FEATURE_KEYS.TRANSITS_FORECAST_DAYS]:   30,
      [FEATURE_KEYS.TRANSITS_BIWHEEL]:         true,
      [FEATURE_KEYS.TRANSITS_DETAIL]:          true,

      [FEATURE_KEYS.AI_CHAT_MONTHLY]:          { per: "month", max: 250 },

      // Sauvegarde chat — 10 conversations, conservation illimitée
      [FEATURE_KEYS.CHAT_SAVE_COUNT]:          10,
      [FEATURE_KEYS.CHAT_SAVE_TTL_DAYS]:       -1,

      [FEATURE_KEYS.TAROT_MONTHLY]:            { per: "month", max: 25 },
      [FEATURE_KEYS.TAROT_DETAIL]:             true,
      [FEATURE_KEYS.TAROT_SPREADS_ALL]:        true,

      [FEATURE_KEYS.SYNASTRY_MONTHLY]:         { per: "month", max: 8 },
      [FEATURE_KEYS.SYNASTRY_DETAIL]:          true,

      [FEATURE_KEYS.REPORTS_MONTHLY_CREDITS]:  { per: "month", max: 2 },
      [FEATURE_KEYS.REPORTS_EXPORT_PDF]:       true,

      [FEATURE_KEYS.READING_REGENERATE]:       false,
      [FEATURE_KEYS.HISTORY_RETENTION_DAYS]:   -1,

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
  // V2 — PREMIUM (code DB conservé) = "Pro" (soft-launch)
  // Tarif "Sur mesure" — features illimitées + régénération.
  // priceCents = 0 → la page pricing affichera "Sur mesure" (géré côté front).
  // --------------------------------------------------------
  {
    code:          "premium",
    name:          "Pro",
    description:   "Pour les passionnés. Sans limite, avec régénération.",
    priceCents:    0,
    currency:      "EUR",
    billingPeriod: "month",
    sortOrder:     3,
    entitlements: {
      [FEATURE_KEYS.NATAL_PROFILES_MAX]:       -1,
      [FEATURE_KEYS.NATAL_CHART]:              true,
      [FEATURE_KEYS.NATAL_WHEEL]:              true,
      [FEATURE_KEYS.NATAL_ASPECTS_ADVANCED]:   true,

      [FEATURE_KEYS.HOROSCOPE_DAILY]:          true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_FULL]:     true,
      [FEATURE_KEYS.HOROSCOPE_DAILY_MONTHLY]:  { per: "month", max: -1 },
      [FEATURE_KEYS.HOROSCOPE_WEEKLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_MONTHLY]:        true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY]:         true,
      [FEATURE_KEYS.HOROSCOPE_YEARLY_DETAIL]:  true,

      [FEATURE_KEYS.TRANSITS_CURRENT]:         true,
      [FEATURE_KEYS.TRANSITS_FORECAST_DAYS]:   365,
      [FEATURE_KEYS.TRANSITS_BIWHEEL]:         true,
      [FEATURE_KEYS.TRANSITS_DETAIL]:          true,

      [FEATURE_KEYS.AI_CHAT_MONTHLY]:          { per: "month", max: -1 },

      // Sauvegarde chat — 100 conversations, conservation illimitée
      [FEATURE_KEYS.CHAT_SAVE_COUNT]:          100,
      [FEATURE_KEYS.CHAT_SAVE_TTL_DAYS]:       -1,

      [FEATURE_KEYS.TAROT_MONTHLY]:            { per: "month", max: -1 },
      [FEATURE_KEYS.TAROT_DETAIL]:             true,
      [FEATURE_KEYS.TAROT_SPREADS_ALL]:        true,

      [FEATURE_KEYS.SYNASTRY_MONTHLY]:         { per: "month", max: -1 },
      [FEATURE_KEYS.SYNASTRY_DETAIL]:          true,

      [FEATURE_KEYS.REPORTS_MONTHLY_CREDITS]:  { per: "month", max: -1 },
      [FEATURE_KEYS.REPORTS_EXPORT_PDF]:       true,

      [FEATURE_KEYS.READING_REGENERATE]:       true,
      [FEATURE_KEYS.HISTORY_RETENTION_DAYS]:   -1,

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

// ARCHIVE-TIERS-V2-CONFIG applied

// CHAT-PERSISTENCE-V1-DATA-FIX-V1 applied
