// ARCHIVE-3-TIERS-V1
// Seeder idempotent : synchronise les tables `plans` + `plan_entitlements`
// depuis `plans.config.ts`. Backfill aussi les users existants sans subscription.
// Appelé au boot via apps/api/src/boot/seed-plans.ts.

import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  plans, planEntitlements, users, userSubscriptions,
} from "../db/schema.js";
import { PLANS, TRIAL_CONFIG, getValueType } from "../config/plans.config.js";

export async function seedPlans(): Promise<{
  plansUpserted: number;
  entitlementsUpserted: number;
  entitlementsPruned: number;
  usersBackfilled: number;
}> {
  let plansUpserted        = 0;
  let entitlementsUpserted = 0;
  let entitlementsPruned   = 0;

  // --------------------------------------------------------
  // 1) Upsert des plans
  // --------------------------------------------------------
  // STRIPE-MVP-V1 : mapping plan.code → env var qui contient le Stripe Price ID.
  // Si l'env est vide, on stocke NULL — le service Stripe refusera alors le
  // checkout pour ce plan (mode "Stripe non configuré").
  const stripePriceEnvByCode: Record<string, string | undefined> = {
    essential: process.env["STRIPE_PRICE_ESSENTIAL_MONTHLY"]?.trim() || undefined,
  };
  // PRICING-ANNUAL-V1 : Price ID Stripe de l'offre annuelle, par code de plan.
  // Vide → stripe_price_id_year reste NULL → l'annuel s'affiche non-achetable.
  const stripePriceYearEnvByCode: Record<string, string | undefined> = {
    essential: process.env["STRIPE_PRICE_ESSENTIAL_YEARLY"]?.trim() || undefined,
  };
  const planIdByCode = new Map<string, string>();

  for (const plan of PLANS) {
    const stripePriceId     = stripePriceEnvByCode[plan.code] ?? null;
    const stripePriceIdYear = stripePriceYearEnvByCode[plan.code] ?? null;
    const priceCentsYear    = plan.priceCentsYear ?? null;
    const existing = await db
      .select()
      .from(plans)
      .where(eq(plans.code, plan.code))
      .limit(1);

    if (existing.length === 0) {
      const [created] = await db
        .insert(plans)
        .values({
          code:          plan.code,
          name:          plan.name,
          description:   plan.description,
          priceCents:    plan.priceCents,
          priceCentsYear,
          currency:      plan.currency,
          billingPeriod: plan.billingPeriod,
          stripePriceId,
          stripePriceIdYear,
          sortOrder:     plan.sortOrder,
          isActive:      true,
        })
        .returning();
      if (created) {
        planIdByCode.set(plan.code, created.id);
        plansUpserted++;
      }
    } else {
      const [updated] = await db
        .update(plans)
        .set({
          name:          plan.name,
          description:   plan.description,
          priceCents:    plan.priceCents,
          priceCentsYear,
          currency:      plan.currency,
          billingPeriod: plan.billingPeriod,
          stripePriceId,
          stripePriceIdYear,
          sortOrder:     plan.sortOrder,
          isActive:      true,
          updatedAt:     new Date(),
        })
        .where(eq(plans.code, plan.code))
        .returning();
      if (updated) {
        planIdByCode.set(plan.code, updated.id);
        plansUpserted++;
      }
    }
  }

  // --------------------------------------------------------
  // 2) Upsert des entitlements de chaque plan
  // --------------------------------------------------------
  for (const plan of PLANS) {
    const planId = planIdByCode.get(plan.code);
    if (!planId) continue;

    const keysInConfig: string[] = [];

    for (const [featureKey, value] of Object.entries(plan.entitlements)) {
      keysInConfig.push(featureKey);
      const valueType = getValueType(value);

      await db
        .insert(planEntitlements)
        .values({
          planId,
          featureKey,
          valueType,
          value: value as unknown,
        })
        .onConflictDoUpdate({
          target: [planEntitlements.planId, planEntitlements.featureKey],
          set: {
            valueType,
            value:     value as unknown,
            updatedAt: new Date(),
          },
        });
      entitlementsUpserted++;
    }

    // Prune : supprime les entitlements en DB qui ne sont plus dans la config
    // (évite d'avoir des clés orphelines quand on renomme/supprime une feature)
    if (keysInConfig.length > 0) {
      const deleted = await db
        .delete(planEntitlements)
        .where(
          and(
            eq(planEntitlements.planId, planId),
            notInArray(planEntitlements.featureKey, keysInConfig)
          )
        )
        .returning({ id: planEntitlements.id });
      entitlementsPruned += deleted.length;
    }
  }

  // --------------------------------------------------------
  // 3) Backfill users existants sans subscription → free active (pas de trial)
  // --------------------------------------------------------
  const defaultPlanId = planIdByCode.get(TRIAL_CONFIG.DEFAULT_PLAN_CODE);
  let usersBackfilled = 0;

  if (defaultPlanId) {
    const result = await db.execute(sql`
      INSERT INTO user_subscriptions (user_id, plan_id, status, started_at)
      SELECT u.id, ${defaultPlanId}::uuid, 'active', now()
      FROM users u
      LEFT JOIN user_subscriptions s ON s.user_id = u.id
      WHERE s.id IS NULL
      ON CONFLICT (user_id) DO NOTHING
      RETURNING id
    `);
    // drizzle-orm `execute` renvoie { rows } ou un array selon le driver.
    const rows = (result as unknown as { rows?: unknown[] }).rows
      ?? (result as unknown as unknown[]);
    usersBackfilled = Array.isArray(rows) ? rows.length : 0;
  }

  // eslint-disable-next-line no-console
  console.info(
    `[seedPlans] plans=${plansUpserted} entitlements=${entitlementsUpserted} ` +
    `pruned=${entitlementsPruned} users_backfilled=${usersBackfilled}`
  );

  return { plansUpserted, entitlementsUpserted, entitlementsPruned, usersBackfilled };
}

// Sanity-check : vérifie que la table `users` a bien la colonne timezone.
// Si non, lève une erreur explicite — signal que la migration SQL n'a pas été appliquée.
export async function assertMigrationApplied(): Promise<void> {
  try {
    await db.select({ timezone: users.timezone }).from(users).limit(1);
  } catch (err) {
    throw new Error(
      "[seedPlans] La migration 0003_tiers_and_grants.sql ne semble pas appliquée. " +
      "Applique-la avant de démarrer l'API. Détail : " + String(err)
    );
  }

  // Vérifie aussi la présence des tables plans/plan_entitlements/etc.
  try {
    await db.select({ id: plans.id }).from(plans).limit(1);
    await db.select({ id: planEntitlements.id }).from(planEntitlements).limit(1);
    await db.select({ id: userSubscriptions.id }).from(userSubscriptions).limit(1);
  } catch (err) {
    throw new Error(
      "[seedPlans] Tables de tiers manquantes. Applique la migration 0003. Détail : " + String(err)
    );
  }
}
