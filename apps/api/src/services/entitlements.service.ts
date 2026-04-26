// ARCHIVE-3-TIERS-V1
// Service central des entitlements.
//
// Responsabilités :
// 1. Résoudre les droits effectifs d'un user = plan + overrides + (accès via grants)
// 2. Attacher les données d'usage (quota consommé, restant, prochain reset)
// 3. Fournir check() / getLimit() / consume() aux middlewares et au code métier
// 4. Gérer le pattern "quota + credits" (ex: ai.chat.daily + ai.chat.credits)

import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  plans, planEntitlements, userEntitlementOverrides, users, usageCounters,
} from "../db/schema.js";
import type {
  EntitlementValue,
  EntitlementValueType,
  EntitlementsMap,
  ResolvedEntitlement,
} from "@astro-platform/types";
import {
  getCachedEntitlements,
  setCachedEntitlements,
  invalidateUserTiersCache,
} from "../lib/redis-entitlements.js";
import { resolvePeriodKey, nextResetAt } from "../lib/period-key.js";
import { grantsService } from "./grants.service.js";
import { subscriptionsService } from "./subscriptions.service.js";
import { isEnforcementActive } from "../config/plans.config.js";
import { shouldAlertForQuota } from "../config/notifications.config.js";

// ----------------------------------------------------------
// Bundles quota + credits
// ----------------------------------------------------------
// Chaque "bundle" exprime qu'une action métier peut puiser d'abord dans un quota
// périodique (reset), puis dans des crédits cumulables achetés en add-on.
export interface FeatureBundle {
  quotaKey:   string;
  creditsKey: string | null;
}

export const FEATURE_BUNDLES: Record<string, FeatureBundle> = {
  "ai.chat":           { quotaKey: "ai.chat.daily",            creditsKey: "ai.chat.credits"      },
  "tarot":             { quotaKey: "tarot.daily",              creditsKey: "tarot.credits"        },
  "synastry":          { quotaKey: "synastry.monthly",         creditsKey: "synastry.credits"     },
  "reports":           { quotaKey: "reports.monthly_credits",  creditsKey: "reports.credits"      },
  "ai.natal_reading":  { quotaKey: "ai.natal_reading.monthly", creditsKey: null                   },
};

// ----------------------------------------------------------
// Helpers de valeurs
// ----------------------------------------------------------
function isLimitObject(v: unknown): v is { per: "day" | "month"; max: number } {
  return !!v && typeof v === "object" && "per" in v && "max" in v;
}

function isUnlimited(v: EntitlementValue): boolean {
  if (typeof v === "number") return v === -1;
  if (isLimitObject(v)) return v.max === -1;
  return false;
}

function getMax(v: EntitlementValue): number | null {
  if (typeof v === "number") return v;
  if (isLimitObject(v)) return v.max;
  return null;
}

function getPeriod(v: EntitlementValue): "day" | "month" | null {
  if (isLimitObject(v)) return v.per;
  return null;
}

// ----------------------------------------------------------
// Résolution du plan → map featureKey => raw entitlement
// ----------------------------------------------------------
async function loadPlanEntitlements(
  planId: string
): Promise<Map<string, { valueType: EntitlementValueType; value: EntitlementValue }>> {
  const rows = await db
    .select()
    .from(planEntitlements)
    .where(eq(planEntitlements.planId, planId));

  const map = new Map<string, { valueType: EntitlementValueType; value: EntitlementValue }>();
  for (const r of rows) {
    map.set(r.featureKey, {
      valueType: r.valueType as EntitlementValueType,
      value:     r.value as EntitlementValue,
    });
  }
  return map;
}

async function loadOverrides(
  userId: string
): Promise<Map<string, { valueType: EntitlementValueType; value: EntitlementValue }>> {
  const now = new Date();
  const rows = await db
    .select()
    .from(userEntitlementOverrides)
    .where(eq(userEntitlementOverrides.userId, userId));

  const map = new Map<string, { valueType: EntitlementValueType; value: EntitlementValue }>();
  for (const r of rows) {
    // Skip si expiré
    if (r.expiresAt && r.expiresAt.getTime() <= now.getTime()) continue;
    map.set(r.featureKey, {
      valueType: r.valueType as EntitlementValueType,
      value:     r.value as EntitlementValue,
    });
  }
  return map;
}

// ----------------------------------------------------------
// Résolution principale (sans cache)
// ----------------------------------------------------------
async function resolveFresh(userId: string): Promise<EntitlementsMap> {
  const subscription = await subscriptionsService.getActive(userId);
  if (!subscription) {
    // Sans subscription, l'user n'a aucun droit. Le seeder devrait prévenir ce cas.
    return {};
  }

  // Load plan + overrides en parallèle
  const [planMap, overrideMap, userRow, grants] = await Promise.all([
    loadPlanEntitlements(subscription.planId),
    loadOverrides(userId),
    db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1),
    grantsService.listActive(userId),
  ]);

  const tz = userRow[0]?.timezone ?? "UTC";
  const map: EntitlementsMap = {};

  // 1) Base = plan
  for (const [key, val] of planMap.entries()) {
    map[key] = {
      featureKey: key,
      valueType:  val.valueType,
      value:      val.value,
      source:     "plan",
    };
  }

  // 2) Overrides écrasent le plan
  for (const [key, val] of overrideMap.entries()) {
    map[key] = {
      featureKey: key,
      valueType:  val.valueType,
      value:      val.value,
      source:     "override",
    };
  }

  // 3) Grants de type "access" = débloque une feature booléenne
  //    (si la valeur actuelle est false, on passe true pour la durée du grant)
  for (const g of grants) {
    if (g.grantType !== "access") continue;
    map[g.featureKey] = {
      featureKey: g.featureKey,
      valueType:  "boolean",
      value:      true,
      source:     "grant",
    };
  }

  // 4) Attache les données d'usage pour les limits
  for (const key of Object.keys(map)) {
    const ent = map[key]!;
    const period = getPeriod(ent.value);
    const max    = getMax(ent.value);

    if (period && max !== null) {
      const periodKey = resolvePeriodKey(period, tz);
      const consumed = await getUsageCount(userId, key, periodKey);

      ent.limit     = max === -1 ? null : max;
      ent.remaining = max === -1 ? null : Math.max(0, max - consumed);
      ent.resetAt   = nextResetAt(period, tz);
    } else if (typeof ent.value === "number") {
      // limit simple (pas de reset, ex: natal.profiles.max)
      ent.limit     = ent.value === -1 ? null : ent.value;
      ent.remaining = null; // géré par le code métier (ex: count natal profiles)
      ent.resetAt   = null;
    }
  }

  return map;
}

async function getUsageCount(
  userId: string,
  featureKey: string,
  periodKey: string
): Promise<number> {
  const [row] = await db
    .select({ count: usageCounters.count })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.featureKey, featureKey),
        eq(usageCounters.periodKey, periodKey)
      )
    )
    .limit(1);
  return row?.count ?? 0;
}

// ----------------------------------------------------------
// Résolution avec cache
// ----------------------------------------------------------
export async function resolveEntitlements(userId: string): Promise<EntitlementsMap> {
  const cached = await getCachedEntitlements(userId);
  if (cached) return cached;

  const fresh = await resolveFresh(userId);
  await setCachedEntitlements(userId, fresh);
  return fresh;
}

// ----------------------------------------------------------
// API publique
// ----------------------------------------------------------
export async function getEntitlement(
  userId: string,
  featureKey: string
): Promise<ResolvedEntitlement | null> {
  const all = await resolveEntitlements(userId);
  return all[featureKey] ?? null;
}

/**
 * Check si une feature booléenne est activée (ou si grant d'accès actif).
 * Pour les features non-définies, renvoie false.
 */
export async function check(userId: string, featureKey: string): Promise<boolean> {
  const ent = await getEntitlement(userId, featureKey);
  if (!ent) return false;

  if (ent.valueType === "boolean") return ent.value === true;
  if (typeof ent.value === "number") return ent.value !== 0;
  if (isLimitObject(ent.value)) return ent.value.max !== 0;

  return false;
}

/**
 * Renvoie les infos de quota d'une feature : max, restant, prochain reset.
 * Pour une feature non-quota, renvoie null.
 */
export async function getLimit(
  userId: string,
  featureKey: string
): Promise<{ limit: number | null; remaining: number | null; resetAt: string | null } | null> {
  const ent = await getEntitlement(userId, featureKey);
  if (!ent) return null;
  if (ent.limit === undefined) return null;
  return {
    limit:     ent.limit ?? null,
    remaining: ent.remaining ?? null,
    resetAt:   ent.resetAt ?? null,
  };
}

// ----------------------------------------------------------
// Consommation d'un quota périodique (usage_counters)
// ----------------------------------------------------------
export interface ConsumeResult {
  allowed:    boolean;
  remaining:  number | null;
  reason?:    "quota_exceeded" | "feature_disabled" | "not_found";
  source?:    "quota" | "credit";
}

export async function consumeQuota(
  userId: string,
  quotaKey: string,
  amount = 1
): Promise<ConsumeResult> {
  const ent = await getEntitlement(userId, quotaKey);
  if (!ent) return { allowed: false, remaining: 0, reason: "not_found" };

  // Illimité
  if (isUnlimited(ent.value)) {
    return { allowed: true, remaining: null, source: "quota" };
  }

  const max    = getMax(ent.value) ?? 0;
  const period = getPeriod(ent.value);

  // Feature désactivée (max = 0 et pas de credits)
  if (max <= 0) return { allowed: false, remaining: 0, reason: "feature_disabled" };
  if (!period) return { allowed: false, remaining: 0, reason: "feature_disabled" };

  // Résout la période dans la tz du user
  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const tz = userRow?.timezone ?? "UTC";
  const periodKey = resolvePeriodKey(period, tz);

  // Incrément atomique via UPSERT + ON CONFLICT
  const [row] = await db
    .insert(usageCounters)
    .values({ userId, featureKey: quotaKey, periodKey, count: amount })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.featureKey, usageCounters.periodKey],
      set: {
        count:     sql`${usageCounters.count} + ${amount}`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: usageCounters.count });

  const newCount = row?.count ?? amount;

  if (newCount > max) {
    // Over-quota : on rollback le décompte (on soustrait ce qu'on vient d'ajouter)
    await db
      .update(usageCounters)
      .set({ count: sql`GREATEST(0, ${usageCounters.count} - ${amount})` })
      .where(
        and(
          eq(usageCounters.userId, userId),
          eq(usageCounters.featureKey, quotaKey),
          eq(usageCounters.periodKey, periodKey)
        )
      );
    return { allowed: false, remaining: Math.max(0, max - (newCount - amount)), reason: "quota_exceeded" };
  }

  const remaining = Math.max(0, max - newCount);
  await invalidateUserTiersCache(userId);

  // Alerte seuil atteint ?
  if (shouldAlertForQuota(quotaKey, remaining)) {
    // Hook vers notificationsService — géré par l'archive 5.
    // On log juste pour l'instant pour tracer que le trigger a bien lieu.
    // eslint-disable-next-line no-console
    console.info(
      `[entitlements] quota_low trigger userId=${userId} feature=${quotaKey} remaining=${remaining}`
    );
  }

  return { allowed: true, remaining, source: "quota" };
}

// ----------------------------------------------------------
// Consommation "bundled" : quota d'abord, crédits ensuite
// ----------------------------------------------------------
export async function consumeBundle(
  userId: string,
  bundleKey: string,
  amount = 1
): Promise<ConsumeResult> {
  const bundle = FEATURE_BUNDLES[bundleKey];
  if (!bundle) return { allowed: false, remaining: 0, reason: "not_found" };

  // 1) Tente d'abord le quota périodique
  const fromQuota = await consumeQuota(userId, bundle.quotaKey, amount);
  if (fromQuota.allowed) return fromQuota;

  // 2) Si quota dépassé et qu'il y a un pool de crédits, tente de consommer dessus
  if (fromQuota.reason === "quota_exceeded" && bundle.creditsKey) {
    const result = await grantsService.consumeCredit(userId, bundle.creditsKey, amount);
    if (result.consumed >= amount) {
      return { allowed: true, remaining: result.remaining, source: "credit" };
    }
  }

  return fromQuota;
}

// ----------------------------------------------------------
// Invalidation manuelle (appelée par les autres services)
// ----------------------------------------------------------
export async function invalidate(userId: string): Promise<void> {
  await invalidateUserTiersCache(userId);
}

// ----------------------------------------------------------
// Export
// ----------------------------------------------------------
export const entitlementsService = {
  resolveEntitlements,
  getEntitlement,
  check,
  getLimit,
  consumeQuota,
  consumeBundle,
  invalidate,
  isEnforcementActive,
};
