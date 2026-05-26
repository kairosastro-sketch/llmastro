// GROWTH-V1-DB
// Source de vérité des tiers d'affiliation et de leurs commissions par défaut.
// La résolution effective combine `tier` + override(s) sur la ligne affiliates ;
// l'attribution gravée (affiliate_attributions.commission_pct / commission_months)
// est ensuite immuable (snapshot strict, cf. GROWTH_PLAN.md A-05).
//
// Modifier ce fichier change les conditions pour les FUTURES attributions
// uniquement. Les attributions existantes conservent leur snapshot.

import type { AffiliateRow } from "../db/schema.js";

// ----------------------------------------------------------
// Tiers — grille standardisée
// ----------------------------------------------------------
export const AFFILIATE_TIERS = {
  standard: { pct: 20, months: 12 },
  vip:      { pct: 25, months: 12 },
  top:      { pct: 30, months: 18 },
  partner:  { pct: 35, months: 24 },
} as const;

export type AffiliateTier = keyof typeof AFFILIATE_TIERS;

// ----------------------------------------------------------
// Bornes de validation (anti-typo admin, cf. spec A-12)
// ----------------------------------------------------------
export const AFFILIATE_PCT_MIN    = 5;
export const AFFILIATE_PCT_MAX    = 50;
export const AFFILIATE_MONTHS_MIN = 1;
export const AFFILIATE_MONTHS_MAX = 36;

// Au-delà de ce delta absolu sur le pct, l'admin UI doit demander
// confirmation explicite avant de persister.
export const AFFILIATE_PCT_DELTA_WARN = 10;

// ----------------------------------------------------------
// Résolution des conditions effectives
// ----------------------------------------------------------
// override > tier > 0 fallback (impossible si la ligne respecte le CHECK).
// À appeler UNIQUEMENT au moment de créer une affiliate_attributions ;
// la valeur résolue est ensuite snapshotée et ne bouge plus.
export interface ResolvedTerms {
  pct:    number;
  months: number;
  source: "override" | "tier";
}

export function resolveTerms(a: Pick<AffiliateRow, "tier" | "commissionPctOverride" | "commissionMonthsOverride">): ResolvedTerms {
  const tierKey = a.tier as AffiliateTier;
  const tier = AFFILIATE_TIERS[tierKey] ?? AFFILIATE_TIERS.standard;
  const pct    = a.commissionPctOverride    ?? tier.pct;
  const months = a.commissionMonthsOverride ?? tier.months;
  const source: ResolvedTerms["source"] =
    (a.commissionPctOverride != null || a.commissionMonthsOverride != null)
      ? "override"
      : "tier";
  return { pct, months, source };
}

// ----------------------------------------------------------
// Plafonds opérationnels (cf. spec A-10, A-11)
// ----------------------------------------------------------
export const AFFILIATE_PAYOUT_THRESHOLD_CENTS = 5000;   // 50 € (cf. O-02)
export const AFFILIATE_MONTHLY_CAP_CENTS      = 50000;  // 500 € (cf. O-03)

// GROWTH-V1-DB applied
