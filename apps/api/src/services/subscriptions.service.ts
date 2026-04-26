// ARCHIVE-3-TIERS-V1
// Service des abonnements utilisateur.
// Source de vérité : `user_subscriptions` en DB (un abonnement actif par user).

import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { plans, userSubscriptions } from "../db/schema.js";
import type { Subscription, SubscriptionStatus } from "@astro-platform/types";
import { TRIAL_CONFIG } from "../config/plans.config.js";
import { invalidateUserTiersCache } from "../lib/redis-entitlements.js";

// ----------------------------------------------------------
// Normalisation
// ----------------------------------------------------------
type SubRow  = typeof userSubscriptions.$inferSelect;
type PlanRow = typeof plans.$inferSelect;

function toPublic(sub: SubRow, plan: PlanRow): Subscription {
  return {
    id:                   sub.id,
    userId:               sub.userId,
    planId:               sub.planId,
    planCode:             plan.code,
    status:               sub.status as SubscriptionStatus,
    startedAt:            sub.startedAt.toISOString(),
    currentPeriodEnd:     sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    stripeCustomerId:     sub.stripeCustomerId,
  };
}

// ----------------------------------------------------------
// Lookup plan par code
// ----------------------------------------------------------
async function getPlanByCode(code: string): Promise<PlanRow> {
  const [row] = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
  if (!row) throw new Error(`Plan introuvable: ${code}. Le seeder a-t-il tourné ?`);
  return row;
}

// ----------------------------------------------------------
// getActive — retourne l'abonnement actif du user.
// Effectue lazy-expire : si en trialing et expiré, bascule sur free avant de retourner.
// ----------------------------------------------------------
export async function getActive(userId: string): Promise<Subscription | null> {
  const [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!sub) return null;

  // Lazy expire : trial terminé → bascule free.
  const expired =
    sub.status === "trialing" &&
    sub.currentPeriodEnd !== null &&
    sub.currentPeriodEnd.getTime() <= Date.now();

  if (expired) {
    const defaultPlan = await getPlanByCode(TRIAL_CONFIG.DEFAULT_PLAN_CODE);
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        planId:           defaultPlan.id,
        status:           "active",
        currentPeriodEnd: null,
        updatedAt:        new Date(),
      })
      .where(eq(userSubscriptions.id, sub.id))
      .returning();
    await invalidateUserTiersCache(userId);
    if (updated) return toPublic(updated, defaultPlan);
  }

  // Cas normal
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, sub.planId))
    .limit(1);
  if (!plan) throw new Error(`Plan introuvable: ${sub.planId}`);

  return toPublic(sub, plan);
}

// ----------------------------------------------------------
// createForNewUser — trial 7j essential par défaut.
// Idempotent : si une subscription existe déjà, la renvoie inchangée.
// ----------------------------------------------------------
export async function createForNewUser(
  userId: string,
  options: { withTrial?: boolean } = {}
): Promise<Subscription> {
  const withTrial = options.withTrial ?? true;

  // Déjà créée ?
  const existing = await getActive(userId);
  if (existing) return existing;

  const planCode = withTrial ? TRIAL_CONFIG.TRIAL_PLAN_CODE : TRIAL_CONFIG.DEFAULT_PLAN_CODE;
  const plan     = await getPlanByCode(planCode);
  const now      = new Date();

  const trialEnd = withTrial
    ? new Date(now.getTime() + TRIAL_CONFIG.TRIAL_DAYS * 24 * 60 * 60 * 1000)
    : null;

  const [row] = await db
    .insert(userSubscriptions)
    .values({
      userId,
      planId:           plan.id,
      status:           withTrial ? "trialing" : "active",
      startedAt:        now,
      currentPeriodEnd: trialEnd,
    })
    .returning();

  if (!row) throw new Error("Failed to create subscription");

  await invalidateUserTiersCache(userId);
  return toPublic(row, plan);
}

// ----------------------------------------------------------
// createForExistingUser — utilisé par le seeder pour les users pré-archive 3.
// Pas de trial rétroactif : free direct.
// ----------------------------------------------------------
export async function createForExistingUser(userId: string): Promise<Subscription> {
  return createForNewUser(userId, { withTrial: false });
}

// ----------------------------------------------------------
// setPlan — change le plan d'un user (admin, Stripe webhook plus tard)
// ----------------------------------------------------------
export async function setPlan(
  userId: string,
  planCode: string,
  options: {
    status?:                SubscriptionStatus;
    currentPeriodEnd?:      Date | null;
    stripeSubscriptionId?:  string;
    stripeCustomerId?:      string;
  } = {}
): Promise<Subscription> {
  const plan = await getPlanByCode(planCode);
  const sub  = await getActive(userId);

  if (!sub) {
    // Pas de subscription : on en crée une
    return createForNewUser(userId, { withTrial: false }).then(() =>
      setPlan(userId, planCode, options)
    );
  }

  const [updated] = await db
    .update(userSubscriptions)
    .set({
      planId:               plan.id,
      status:               options.status ?? "active",
      currentPeriodEnd:     options.currentPeriodEnd !== undefined ? options.currentPeriodEnd : null,
      stripeSubscriptionId: options.stripeSubscriptionId ?? sub.stripeSubscriptionId,
      stripeCustomerId:     options.stripeCustomerId     ?? sub.stripeCustomerId,
      updatedAt:            new Date(),
    })
    .where(eq(userSubscriptions.userId, userId))
    .returning();

  if (!updated) throw new Error("Failed to update subscription");

  await invalidateUserTiersCache(userId);
  return toPublic(updated, plan);
}

// ----------------------------------------------------------
// expireTrialsDue — appelé par un cron quotidien (plus tard, archive 5).
// Bascule tous les trials expirés vers free. Retourne le nombre de users impactés.
// ----------------------------------------------------------
export async function expireTrialsDue(now: Date = new Date()): Promise<number> {
  const defaultPlan = await getPlanByCode(TRIAL_CONFIG.DEFAULT_PLAN_CODE);

  const due = await db
    .select({ userId: userSubscriptions.userId })
    .from(userSubscriptions)
    .where(
      and(
        eq(userSubscriptions.status, "trialing"),
        lt(userSubscriptions.currentPeriodEnd, now)
      )
    );

  if (due.length === 0) return 0;

  await db
    .update(userSubscriptions)
    .set({
      planId:           defaultPlan.id,
      status:           "active",
      currentPeriodEnd: null,
      updatedAt:        now,
    })
    .where(
      and(
        eq(userSubscriptions.status, "trialing"),
        lt(userSubscriptions.currentPeriodEnd, now)
      )
    );

  // Invalide le cache de chaque user concerné.
  for (const row of due) {
    await invalidateUserTiersCache(row.userId);
  }

  return due.length;
}

// ----------------------------------------------------------
// listAllPlans — catalogue public (pour page pricing)
// ----------------------------------------------------------
export async function listAllPlans(): Promise<PlanRow[]> {
  return db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.sortOrder);
}

export const subscriptionsService = {
  getActive,
  createForNewUser,
  createForExistingUser,
  setPlan,
  expireTrialsDue,
  listAllPlans,
};
