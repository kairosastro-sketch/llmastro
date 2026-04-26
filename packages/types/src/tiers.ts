// ARCHIVE-3-TIERS-V1
// Types partagés pour le système de tiers, entitlements et grants.
// Source de vérité = apps/api/src/config/plans.config.ts côté backend.

// ----------------------------------------------------------
// Plan
// ----------------------------------------------------------
export type PlanCode = "free" | "essential" | "premium";

export interface Plan {
  id:            string;
  code:          PlanCode | string;   // string pour anticiper de nouveaux plans
  name:          string;
  description:   string;
  priceCents:    number;
  currency:      string;
  billingPeriod: "month" | "year" | "one_time";
  isActive:      boolean;
  sortOrder:     number;
}

// ----------------------------------------------------------
// Entitlement
// ----------------------------------------------------------
export type EntitlementValueType = "boolean" | "limit" | "credit" | "json";

export type EntitlementValue =
  | boolean
  | number
  | { per: "day" | "month"; max: number }
  | Record<string, unknown>;

export interface Entitlement {
  featureKey: string;
  valueType:  EntitlementValueType;
  value:      EntitlementValue;
}

// Résultat d'une résolution d'entitlement pour un user donné.
export interface ResolvedEntitlement {
  featureKey: string;
  valueType:  EntitlementValueType;
  value:      EntitlementValue;
  source:     "plan" | "override" | "grant";
  // Pour les limits/credits : état consommé du jour/mois en cours
  remaining?: number | null;
  limit?:     number | null;
  resetAt?:   string | null;    // ISO, prochaine remise à zéro (UTC)
}

// Map complète renvoyée par l'API (ex. /auth/me).
export type EntitlementsMap = Record<string, ResolvedEntitlement>;

// ----------------------------------------------------------
// Subscription
// ----------------------------------------------------------
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "incomplete";

export interface Subscription {
  id:                    string;
  userId:                string;
  planId:                string;
  planCode:              string;
  status:                SubscriptionStatus;
  startedAt:             string;           // ISO
  currentPeriodEnd:      string | null;    // ISO
  stripeSubscriptionId:  string | null;
  stripeCustomerId:      string | null;
}

// ----------------------------------------------------------
// Grant (add-ons one-shot, crédits, accès temporaires)
// ----------------------------------------------------------
export type GrantType   = "access" | "credit";
export type GrantSource = "purchase" | "promo" | "admin" | "gift";

export interface Grant {
  id:                     string;
  userId:                 string;
  featureKey:             string;
  grantType:              GrantType;
  quantity:               number;         // pour credit : total attribué ; pour access : 1
  consumed:               number;         // pour credit : déjà utilisé
  expiresAt:              string | null;  // ISO, null = illimité
  source:                 GrantSource;
  stripePaymentIntentId:  string | null;
  metadata:               Record<string, unknown> | null;
  createdAt:              string;
}

// ----------------------------------------------------------
// Public user shape (étend celui d'auth avec plan + entitlements)
// ----------------------------------------------------------
export interface PublicUserTiersInfo {
  plan: {
    code:             string;
    name:             string;
    status:           SubscriptionStatus;
    currentPeriodEnd: string | null;
    isTrial:          boolean;
  };
  entitlements: EntitlementsMap;
}
