// ARCHIVE-3-TIERS-V1
// Service des grants (add-ons ponctuels : crédits et accès temporaires).
// Un grant permet de "patcher" les droits d'un user au-dessus de son plan :
// - grant_type=credit : N utilisations cumulables (pack de 10 msg, pack de 3 rapports)
// - grant_type=access : débloque une feature pour une durée (ex. synastrie 30j)

import { and, eq, gt, or, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { userGrants } from "../db/schema.js";
import type { Grant, GrantSource, GrantType } from "@astro-platform/types";
import { invalidateUserTiersCache } from "../lib/redis-entitlements.js";

// ----------------------------------------------------------
// Types d'input
// ----------------------------------------------------------
interface CreateCreditParams {
  userId:                string;
  featureKey:            string;
  quantity:              number;
  source?:               GrantSource;
  stripePaymentIntentId?: string;
  metadata?:             Record<string, unknown>;
  expiresAt?:            Date | null;
}

interface CreateAccessParams {
  userId:                string;
  featureKey:            string;
  expiresAt:             Date;
  source?:               GrantSource;
  stripePaymentIntentId?: string;
  metadata?:             Record<string, unknown>;
}

// ----------------------------------------------------------
// Helpers de normalisation
// ----------------------------------------------------------
function toPublicGrant(row: typeof userGrants.$inferSelect): Grant {
  return {
    id:                    row.id,
    userId:                row.userId,
    featureKey:            row.featureKey,
    grantType:             row.grantType as GrantType,
    quantity:              row.quantity,
    consumed:              row.consumed,
    expiresAt:             row.expiresAt ? row.expiresAt.toISOString() : null,
    source:                row.source as GrantSource,
    stripePaymentIntentId: row.stripePaymentIntentId,
    metadata:              (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt:             row.createdAt.toISOString(),
  };
}

// ----------------------------------------------------------
// listActive — grants non-expirés ET (pour credits) non-épuisés
// ----------------------------------------------------------
export async function listActive(userId: string): Promise<Grant[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(userGrants)
    .where(
      and(
        eq(userGrants.userId, userId),
        or(isNull(userGrants.expiresAt), gt(userGrants.expiresAt, now)),
        // Credits : quantity > consumed. Access : toujours actif tant que pas expiré.
        or(
          eq(userGrants.grantType, "access"),
          gt(userGrants.quantity, userGrants.consumed)
        )
      )
    );

  return rows.map(toPublicGrant);
}

// ----------------------------------------------------------
// Liste les grants actifs pour une feature précise
// ----------------------------------------------------------
export async function listActiveForFeature(
  userId: string,
  featureKey: string
): Promise<Grant[]> {
  const all = await listActive(userId);
  return all.filter((g) => g.featureKey === featureKey);
}

// ----------------------------------------------------------
// Credit cumulable
// ----------------------------------------------------------
export async function createCredit(params: CreateCreditParams): Promise<Grant> {
  const [row] = await db
    .insert(userGrants)
    .values({
      userId:                params.userId,
      featureKey:            params.featureKey,
      grantType:             "credit",
      quantity:              params.quantity,
      consumed:              0,
      expiresAt:             params.expiresAt ?? null,
      source:                params.source ?? "purchase",
      stripePaymentIntentId: params.stripePaymentIntentId ?? null,
      metadata:              params.metadata ?? null,
    })
    .returning();

  if (!row) throw new Error("Failed to create credit grant");

  await invalidateUserTiersCache(params.userId);
  return toPublicGrant(row);
}

// ----------------------------------------------------------
// Accès temporaire
// ----------------------------------------------------------
export async function createAccess(params: CreateAccessParams): Promise<Grant> {
  const [row] = await db
    .insert(userGrants)
    .values({
      userId:                params.userId,
      featureKey:            params.featureKey,
      grantType:             "access",
      quantity:              1,
      consumed:              0,
      expiresAt:             params.expiresAt,
      source:                params.source ?? "purchase",
      stripePaymentIntentId: params.stripePaymentIntentId ?? null,
      metadata:              params.metadata ?? null,
    })
    .returning();

  if (!row) throw new Error("Failed to create access grant");

  await invalidateUserTiersCache(params.userId);
  return toPublicGrant(row);
}

// ----------------------------------------------------------
// Consommation atomique d'un crédit (FIFO : plus vieux d'abord)
//
// Retourne le nombre réellement consommé (<= amount).
// ----------------------------------------------------------
export async function consumeCredit(
  userId: string,
  featureKey: string,
  amount = 1
): Promise<{ consumed: number; remaining: number }> {
  if (amount <= 0) return { consumed: 0, remaining: await remainingCredits(userId, featureKey) };

  // Charge les credits actifs triés par ancienneté (FIFO).
  const now = new Date();
  const rows = await db
    .select()
    .from(userGrants)
    .where(
      and(
        eq(userGrants.userId, userId),
        eq(userGrants.featureKey, featureKey),
        eq(userGrants.grantType, "credit"),
        or(isNull(userGrants.expiresAt), gt(userGrants.expiresAt, now)),
        gt(userGrants.quantity, userGrants.consumed)
      )
    )
    .orderBy(userGrants.createdAt);

  let toConsume = amount;
  let totalConsumed = 0;

  for (const row of rows) {
    if (toConsume <= 0) break;
    const available = row.quantity - row.consumed;
    const take      = Math.min(available, toConsume);

    await db
      .update(userGrants)
      .set({ consumed: row.consumed + take })
      .where(eq(userGrants.id, row.id));

    toConsume     -= take;
    totalConsumed += take;
  }

  if (totalConsumed > 0) {
    await invalidateUserTiersCache(userId);
  }

  const remaining = await remainingCredits(userId, featureKey);
  return { consumed: totalConsumed, remaining };
}

// ----------------------------------------------------------
// Total des crédits restants sur une feature
// ----------------------------------------------------------
export async function remainingCredits(
  userId: string,
  featureKey: string
): Promise<number> {
  const now = new Date();
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userGrants.quantity} - ${userGrants.consumed}), 0)`,
    })
    .from(userGrants)
    .where(
      and(
        eq(userGrants.userId, userId),
        eq(userGrants.featureKey, featureKey),
        eq(userGrants.grantType, "credit"),
        or(isNull(userGrants.expiresAt), gt(userGrants.expiresAt, now))
      )
    );

  return Number(result[0]?.total ?? 0);
}

// ----------------------------------------------------------
// Vérifie si un access-grant actif existe pour une feature
// ----------------------------------------------------------
export async function hasActiveAccess(
  userId: string,
  featureKey: string
): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .select({ id: userGrants.id })
    .from(userGrants)
    .where(
      and(
        eq(userGrants.userId, userId),
        eq(userGrants.featureKey, featureKey),
        eq(userGrants.grantType, "access"),
        or(isNull(userGrants.expiresAt), gt(userGrants.expiresAt, now))
      )
    )
    .limit(1);

  return rows.length > 0;
}

export const grantsService = {
  listActive,
  listActiveForFeature,
  createCredit,
  createAccess,
  consumeCredit,
  remainingCredits,
  hasActiveAccess,
};
