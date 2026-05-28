// PROMO-CODES-V1
// Service des codes promo internes.
// Deux kinds : 'subscription_days' (étend/crée un trial sur un plan)
// et 'feature_credits' (créé un grant credit). Pas de coupons Stripe.

import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, pool } from "../db/index.js";
import {
  promoCodes,
  promoCodeRedemptions,
  type PromoCodeRow,
} from "../db/schema.js";
import { createCredit } from "./grants.service.js";
import { getActive, setPlan } from "./subscriptions.service.js";
import { FEATURE_KEYS, getPlanByCode } from "../config/plans.config.js";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------
export type PromoKind = "subscription_days" | "feature_credits";

export interface CreatePromoInput {
  code:                  string;
  description?:          string | null;
  kind:                  PromoKind;
  subscriptionPlanCode?: string | null;
  subscriptionDays?:     number | null;
  featureKey?:           string | null;
  creditQuantity?:       number | null;
  maxRedemptions?:       number | null;
  maxPerUser?:           number;
  validFrom?:            Date | null;
  expiresAt?:            Date | null;
  createdBy:             string;
}

export interface UpdatePromoInput {
  description?:    string | null;
  active?:         boolean;
  maxRedemptions?: number | null;
  expiresAt?:      Date | null;
}

export interface PromoCodePublic {
  id:                   string;
  code:                 string;
  description:          string | null;
  kind:                 PromoKind;
  subscriptionPlanCode: string | null;
  subscriptionDays:     number | null;
  featureKey:           string | null;
  creditQuantity:       number | null;
  maxRedemptions:       number | null;
  maxPerUser:           number;
  redemptionsCount:     number;
  validFrom:            string | null;
  expiresAt:            string | null;
  active:               boolean;
  createdAt:            string;
  updatedAt:            string;
}

export interface RedeemResult {
  kind: PromoKind;
  // Pour subscription_days
  planCode?:         string;
  newPeriodEnd?:     string;
  // Pour feature_credits
  featureKey?:       string;
  creditsGranted?:   number;
  // Métadonnées
  description:       string | null;
}

// ----------------------------------------------------------
// Erreurs métier (mappées sur des codes HTTP côté route)
// ----------------------------------------------------------
export class PromoCodeError extends Error {
  constructor(public code: string, message: string, public statusCode = 400) {
    super(message);
    this.name = "PromoCodeError";
  }
}

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------
function toPublic(row: PromoCodeRow): PromoCodePublic {
  return {
    id:                   row.id,
    code:                 row.code,
    description:          row.description,
    kind:                 row.kind as PromoKind,
    subscriptionPlanCode: row.subscriptionPlanCode,
    subscriptionDays:     row.subscriptionDays,
    featureKey:           row.featureKey,
    creditQuantity:       row.creditQuantity,
    maxRedemptions:       row.maxRedemptions,
    maxPerUser:           row.maxPerUser,
    redemptionsCount:     row.redemptionsCount,
    validFrom:            row.validFrom ? row.validFrom.toISOString() : null,
    expiresAt:            row.expiresAt ? row.expiresAt.toISOString() : null,
    active:               row.active,
    createdAt:            row.createdAt.toISOString(),
    updatedAt:            row.updatedAt.toISOString(),
  };
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function isFeatureKeyKnown(key: string): boolean {
  return Object.values(FEATURE_KEYS).includes(key as (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]);
}

// ----------------------------------------------------------
// Admin — création
// ----------------------------------------------------------
export async function createPromo(input: CreatePromoInput): Promise<PromoCodePublic> {
  const code = normalizeCode(input.code);
  if (code.length < 3 || code.length > 40) {
    throw new PromoCodeError("INVALID_CODE", "Code length must be 3..40 chars");
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw new PromoCodeError("INVALID_CODE", "Code may contain A-Z, 0-9, _ and - only");
  }

  if (input.kind === "subscription_days") {
    if (!input.subscriptionPlanCode || !input.subscriptionDays) {
      throw new PromoCodeError("INVALID_SHAPE", "subscriptionPlanCode and subscriptionDays required");
    }
    if (!getPlanByCode(input.subscriptionPlanCode)) {
      throw new PromoCodeError("PLAN_NOT_FOUND", `Unknown plan: ${input.subscriptionPlanCode}`);
    }
    if (input.subscriptionDays < 1 || input.subscriptionDays > 365) {
      throw new PromoCodeError("INVALID_DAYS", "subscriptionDays must be 1..365");
    }
  } else if (input.kind === "feature_credits") {
    if (!input.featureKey || !input.creditQuantity) {
      throw new PromoCodeError("INVALID_SHAPE", "featureKey and creditQuantity required");
    }
    if (!isFeatureKeyKnown(input.featureKey)) {
      throw new PromoCodeError("FEATURE_NOT_FOUND", `Unknown feature key: ${input.featureKey}`);
    }
    if (input.creditQuantity < 1 || input.creditQuantity > 10000) {
      throw new PromoCodeError("INVALID_QUANTITY", "creditQuantity must be 1..10000");
    }
  } else {
    throw new PromoCodeError("INVALID_KIND", `Unknown kind: ${input.kind as string}`);
  }

  if (
    input.maxRedemptions !== null &&
    input.maxRedemptions !== undefined &&
    input.maxRedemptions < 1
  ) {
    throw new PromoCodeError("INVALID_MAX_REDEMPTIONS", "maxRedemptions must be >= 1 or null");
  }

  // Conflit sur code (unique en DB mais on renvoie une erreur propre)
  const [existing] = await db
    .select({ id: promoCodes.id })
    .from(promoCodes)
    .where(eq(promoCodes.code, code))
    .limit(1);
  if (existing) {
    throw new PromoCodeError("CODE_TAKEN", `Code ${code} already exists`, 409);
  }

  const [row] = await db
    .insert(promoCodes)
    .values({
      code,
      description:          input.description ?? null,
      kind:                 input.kind,
      subscriptionPlanCode: input.kind === "subscription_days" ? input.subscriptionPlanCode! : null,
      subscriptionDays:     input.kind === "subscription_days" ? input.subscriptionDays!     : null,
      featureKey:           input.kind === "feature_credits"   ? input.featureKey!           : null,
      creditQuantity:       input.kind === "feature_credits"   ? input.creditQuantity!       : null,
      maxRedemptions:       input.maxRedemptions ?? null,
      maxPerUser:           input.maxPerUser ?? 1,
      validFrom:            input.validFrom ?? null,
      expiresAt:            input.expiresAt ?? null,
      createdBy:            input.createdBy,
    })
    .returning();

  if (!row) throw new Error("Failed to create promo code");
  return toPublic(row);
}

// ----------------------------------------------------------
// Admin — list
// ----------------------------------------------------------
export interface ListPromosOptions {
  q?:      string;
  active?: boolean;
  page?:   number;
  limit?:  number;
}

export interface ListPromosResult {
  codes: PromoCodePublic[];
  total: number;
  page:  number;
  limit: number;
}

export async function listPromos(opts: ListPromosOptions = {}): Promise<ListPromosResult> {
  const page  = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;

  // Construit la WHERE clause en raw pour avoir un placeholders count
  // cohérent avec les params variadiques (pattern aligné sur admin-panel.ts).
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.q && opts.q.trim().length > 0) {
    params.push(`%${normalizeCode(opts.q)}%`);
    conditions.push(`code ILIKE $${params.length}`);
  }
  if (opts.active !== undefined) {
    params.push(opts.active);
    conditions.push(`active = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const totalRes = await pool.query(
    `SELECT count(*)::int AS total FROM promo_codes ${where}`,
    params,
  );
  const total = totalRes.rows[0].total as number;

  const rows = await pool.query<PromoCodeRow & { created_at: Date; updated_at: Date }>(
    `SELECT * FROM promo_codes ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  // Coerce snake_case rows en notre format public
  const codes = rows.rows.map((r) => toPublic({
    id:                   (r as Record<string, unknown>)["id"] as string,
    code:                 (r as Record<string, unknown>)["code"] as string,
    description:          (r as Record<string, unknown>)["description"] as string | null,
    kind:                 (r as Record<string, unknown>)["kind"] as string,
    subscriptionPlanCode: (r as Record<string, unknown>)["subscription_plan_code"] as string | null,
    subscriptionDays:     (r as Record<string, unknown>)["subscription_days"] as number | null,
    featureKey:           (r as Record<string, unknown>)["feature_key"] as string | null,
    creditQuantity:       (r as Record<string, unknown>)["credit_quantity"] as number | null,
    maxRedemptions:       (r as Record<string, unknown>)["max_redemptions"] as number | null,
    maxPerUser:           (r as Record<string, unknown>)["max_per_user"] as number,
    redemptionsCount:     (r as Record<string, unknown>)["redemptions_count"] as number,
    validFrom:            (r as Record<string, unknown>)["valid_from"] as Date | null,
    expiresAt:            (r as Record<string, unknown>)["expires_at"] as Date | null,
    active:               (r as Record<string, unknown>)["active"] as boolean,
    createdBy:            (r as Record<string, unknown>)["created_by"] as string | null,
    createdAt:            (r as Record<string, unknown>)["created_at"] as Date,
    updatedAt:            (r as Record<string, unknown>)["updated_at"] as Date,
  }));

  return { codes, total, page, limit };
}

// ----------------------------------------------------------
// Admin — get + redemptions
// ----------------------------------------------------------
export async function getPromoById(id: string): Promise<PromoCodePublic | null> {
  const [row] = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
  return row ? toPublic(row) : null;
}

export interface RedemptionPublic {
  id:         string;
  userId:     string;
  userEmail:  string | null;
  redeemedAt: string;
}

export async function listRedemptions(promoCodeId: string, limit = 100): Promise<RedemptionPublic[]> {
  const r = await pool.query(
    `SELECT r.id, r.user_id, r.redeemed_at, u.email
     FROM promo_code_redemptions r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.promo_code_id = $1
     ORDER BY r.redeemed_at DESC
     LIMIT $2`,
    [promoCodeId, Math.min(500, Math.max(1, limit))],
  );
  return r.rows.map((row) => ({
    id:         row.id as string,
    userId:     row.user_id as string,
    userEmail:  (row.email as string | null) ?? null,
    redeemedAt: (row.redeemed_at as Date).toISOString(),
  }));
}

// ----------------------------------------------------------
// Admin — patch (description/active/expires/max)
// ----------------------------------------------------------
export async function updatePromo(id: string, patch: UpdatePromoInput): Promise<PromoCodePublic> {
  const updates: Partial<typeof promoCodes.$inferInsert> = {};
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.active      !== undefined) updates.active      = patch.active;
  if (patch.expiresAt   !== undefined) updates.expiresAt   = patch.expiresAt;
  if (patch.maxRedemptions !== undefined) {
    if (patch.maxRedemptions !== null && patch.maxRedemptions < 1) {
      throw new PromoCodeError("INVALID_MAX_REDEMPTIONS", "maxRedemptions must be >= 1 or null");
    }
    updates.maxRedemptions = patch.maxRedemptions;
  }
  if (Object.keys(updates).length === 0) {
    throw new PromoCodeError("NO_CHANGES", "Nothing to update");
  }
  updates.updatedAt = new Date();

  const [row] = await db
    .update(promoCodes)
    .set(updates)
    .where(eq(promoCodes.id, id))
    .returning();
  if (!row) throw new PromoCodeError("NOT_FOUND", "Promo code not found", 404);
  return toPublic(row);
}

// ----------------------------------------------------------
// Admin — archive (soft delete = active=false)
// ----------------------------------------------------------
export async function archivePromo(id: string): Promise<PromoCodePublic> {
  return updatePromo(id, { active: false });
}

// ----------------------------------------------------------
// User — redeem
// Lock optimiste : on incrémente redemptions_count via UPDATE
// WHERE redemptions_count < max_redemptions, ce qui sérialise
// les hits concurrents au niveau row.
// ----------------------------------------------------------
export async function redeemPromo(userId: string, rawCode: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode);
  if (code.length < 3) {
    throw new PromoCodeError("INVALID_CODE", "Code is too short");
  }

  // 1. Charge le code
  const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
  if (!promo) {
    throw new PromoCodeError("CODE_NOT_FOUND", "Code inconnu", 404);
  }

  // 2. Validations
  const now = new Date();
  if (!promo.active) {
    throw new PromoCodeError("CODE_INACTIVE", "Code désactivé");
  }
  if (promo.validFrom && promo.validFrom.getTime() > now.getTime()) {
    throw new PromoCodeError("CODE_NOT_YET_VALID", "Code pas encore actif");
  }
  if (promo.expiresAt && promo.expiresAt.getTime() <= now.getTime()) {
    throw new PromoCodeError("CODE_EXPIRED", "Code expiré");
  }
  if (
    promo.maxRedemptions !== null &&
    promo.redemptionsCount >= promo.maxRedemptions
  ) {
    throw new PromoCodeError("CODE_DEPLETED", "Code épuisé");
  }

  // 3. Anti-rejeu — index unique (promo_code_id, user_id), mais on check
  //    d'abord pour renvoyer une erreur propre.
  const [already] = await db
    .select({ id: promoCodeRedemptions.id })
    .from(promoCodeRedemptions)
    .where(
      and(
        eq(promoCodeRedemptions.promoCodeId, promo.id),
        eq(promoCodeRedemptions.userId, userId),
      ),
    )
    .limit(1);
  if (already) {
    throw new PromoCodeError("ALREADY_REDEEMED", "Tu as déjà utilisé ce code", 409);
  }

  // 4. Increment atomique du compteur (sérialise les concurrents)
  if (promo.maxRedemptions !== null) {
    const bumped = await db
      .update(promoCodes)
      .set({
        redemptionsCount: sql`${promoCodes.redemptionsCount} + 1`,
        updatedAt:        new Date(),
      })
      .where(
        and(
          eq(promoCodes.id, promo.id),
          // garde la condition pour ne pas dépasser le cap en cas de race
          sql`${promoCodes.redemptionsCount} < ${promoCodes.maxRedemptions}`,
        ),
      )
      .returning({ id: promoCodes.id });
    if (bumped.length === 0) {
      throw new PromoCodeError("CODE_DEPLETED", "Code épuisé");
    }
  } else {
    await db
      .update(promoCodes)
      .set({
        redemptionsCount: sql`${promoCodes.redemptionsCount} + 1`,
        updatedAt:        new Date(),
      })
      .where(eq(promoCodes.id, promo.id));
  }

  // 5. Application de l'effet
  let result: RedeemResult;
  let grantId: string | null = null;

  if (promo.kind === "subscription_days") {
    if (!promo.subscriptionPlanCode || !promo.subscriptionDays) {
      throw new PromoCodeError("INVALID_CONFIG", "Code mal configuré (sub_days)");
    }
    // Refuse si user a déjà un abonnement Stripe payant (reco produit).
    const current = await getActive(userId);
    if (current?.stripeSubscriptionId) {
      throw new PromoCodeError(
        "ALREADY_PAID_SUB",
        "Tu es déjà abonné — ce code est destiné aux nouveaux utilisateurs",
        409,
      );
    }

    // Prolonge depuis la fin actuelle si on est déjà en trial sur ce plan,
    // sinon démarre à partir de maintenant.
    const base =
      current?.currentPeriodEnd &&
      new Date(current.currentPeriodEnd).getTime() > now.getTime() &&
      current.planCode === promo.subscriptionPlanCode
        ? new Date(current.currentPeriodEnd)
        : now;
    const newEnd = new Date(base.getTime() + promo.subscriptionDays * 24 * 60 * 60 * 1000);

    const sub = await setPlan(userId, promo.subscriptionPlanCode, {
      status:           "trialing",
      currentPeriodEnd: newEnd,
    });

    result = {
      kind:         "subscription_days",
      planCode:     sub.planCode,
      newPeriodEnd: newEnd.toISOString(),
      description:  promo.description,
    };
  } else if (promo.kind === "feature_credits") {
    if (!promo.featureKey || !promo.creditQuantity) {
      throw new PromoCodeError("INVALID_CONFIG", "Code mal configuré (credits)");
    }
    const grant = await createCredit({
      userId,
      featureKey: promo.featureKey,
      quantity:   promo.creditQuantity,
      source:     "promo",
      metadata:   { promoCodeId: promo.id, promoCode: promo.code },
      expiresAt:  promo.expiresAt ?? null,
    });
    grantId = grant.id;

    result = {
      kind:           "feature_credits",
      featureKey:     promo.featureKey,
      creditsGranted: promo.creditQuantity,
      description:    promo.description,
    };
  } else {
    throw new PromoCodeError("INVALID_KIND", `Unknown kind: ${promo.kind}`);
  }

  // 6. Trace de redemption (idempotent grâce à l'unique index)
  await db.insert(promoCodeRedemptions).values({
    promoCodeId: promo.id,
    userId,
    grantId,
  });

  return result;
}

// ----------------------------------------------------------
// Export
// ----------------------------------------------------------
export const promoCodesService = {
  createPromo,
  listPromos,
  getPromoById,
  listRedemptions,
  updatePromo,
  archivePromo,
  redeemPromo,
};

// Évite les warnings d'imports inutilisés si on étend plus tard.
void desc; void gt; void isNull; void or;

// PROMO-CODES-V1 applied
