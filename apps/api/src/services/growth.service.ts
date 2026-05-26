// GROWTH-V1-CAPTURE
// Capture des attributions parrainage + affiliation au moment du signup.
// Spec : GROWTH_PLAN.md (sections "Mécanique parrainage" + "Mécanique
// affiliation" + règle G-03 sur le conflit cookies).
//
// Ce service est volontairement *capture-only* au MVP : il enregistre
// les attributions, mais ne crédite rien et ne déclenche aucun grant.
// L'activation (1er natal + 3j) et la distribution des récompenses
// arrivent en GROWTH-V1-ACTIVATION-HOOK et GROWTH-V1-GIFT-CODES.

import crypto from "crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  users,
  referrals,
  affiliates,
  affiliateAttributions,
  affiliateClicks,
} from "../db/schema.js";
import { resolveTerms } from "../config/affiliate-tiers.config.js";

// ----------------------------------------------------------
// Alphabet referral_code : 32 chars sans 0/O/I/l/1
// 32^8 ≈ 1.1×10¹² combinaisons — très largement assez pour
// éviter les collisions au volume où on opère.
// ----------------------------------------------------------
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REFERRAL_CODE_LENGTH   = 8;

function generateCode(): string {
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    out += REFERRAL_CODE_ALPHABET[bytes[i]! % REFERRAL_CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Génère un referral_code unique pour un user. Idempotent : si le user
 * en a déjà un, retourne celui-là sans toucher la DB. Sinon réessaye
 * sur collision (peu probable, mais on protège).
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const [u] = await db
    .select({ code: users.referralCode })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (u?.code) return u.code;

  // Retry boucle : ~6 essais max, collision déjà improbable au 1er.
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateCode();
    try {
      await db.update(users)
        .set({ referralCode: candidate, updatedAt: new Date() })
        .where(eq(users.id, userId));
      return candidate;
    } catch (err: unknown) {
      // 23505 = unique_violation Postgres
      const pgErr = err as { code?: string };
      if (pgErr.code !== "23505") throw err;
    }
  }
  throw new Error("Failed to generate unique referral code after retries");
}

// ----------------------------------------------------------
// Visitor hash : sha256(ip + ua) — pas de PII brute en DB.
// ----------------------------------------------------------
export function hashVisitor(ip: string | null | undefined, ua: string | null | undefined): string {
  const raw = `${ip ?? "0.0.0.0"}|${ua ?? ""}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ----------------------------------------------------------
// Capture parrainage
// ----------------------------------------------------------
export interface CaptureReferralResult {
  status:        "ignored" | "captured" | "rejected_by_affiliate" | "self" | "code_not_found";
  trialExtended: boolean;
  referrerId:    string | null;
}

/**
 * Si `code` est valide et désigne un autre user, insère une ligne
 * `referrals` (status='pending') et signale `trialExtended=true`.
 *
 * Règle G-03 : si `affiliateCaptured=true`, la row est insérée mais
 * marquée `rejected` — l'audit trail est conservé, le parrain ne sera
 * jamais récompensé (logique d'activation en GROWTH-V1-ACTIVATION-HOOK
 * sautera les rows non-'pending'). Le filleul, lui, garde le trial 14j.
 */
export async function captureReferral(
  newUserId: string,
  code: string | null | undefined,
  affiliateCaptured: boolean,
): Promise<CaptureReferralResult> {
  if (!code) return { status: "ignored", trialExtended: false, referrerId: null };

  const normalized = code.trim().toUpperCase();
  if (normalized.length !== REFERRAL_CODE_LENGTH) {
    return { status: "code_not_found", trialExtended: false, referrerId: null };
  }

  const [referrer] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, normalized))
    .limit(1);

  if (!referrer) {
    return { status: "code_not_found", trialExtended: false, referrerId: null };
  }
  if (referrer.id === newUserId) {
    return { status: "self", trialExtended: false, referrerId: null };
  }

  const status = affiliateCaptured ? "rejected" : "pending";

  await db.insert(referrals).values({
    referrerId:  referrer.id,
    referredId:  newUserId,
    status,
  });

  // Marque le filleul comme attribué côté users.referred_by, utile pour
  // les jointures rapides ailleurs (et pour les anti-abus type "déjà parrainé").
  await db.update(users)
    .set({ referredBy: referrer.id, updatedAt: new Date() })
    .where(eq(users.id, newUserId));

  return {
    status:        affiliateCaptured ? "rejected_by_affiliate" : "captured",
    // G-03 : trial 14j gardé même si l'affilié gagne la commission.
    trialExtended: true,
    referrerId:    referrer.id,
  };
}

// ----------------------------------------------------------
// Capture affiliation
// ----------------------------------------------------------
export interface CaptureAffiliateResult {
  status:       "ignored" | "captured" | "slug_not_found" | "affiliate_inactive";
  affiliateId:  string | null;
  attributionId: string | null;
}

/**
 * Si `slug` correspond à un affilié actif, insère une ligne
 * `affiliate_attributions` avec les conditions snapshotées (résolues
 * via `resolveTerms()` au moment T, immuables ensuite).
 */
export async function captureAffiliate(
  newUserId: string,
  slug: string | null | undefined,
): Promise<CaptureAffiliateResult> {
  if (!slug) return { status: "ignored", affiliateId: null, attributionId: null };

  const normalized = slug.trim().toLowerCase();
  const [aff] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.slug, normalized))
    .limit(1);

  if (!aff) {
    return { status: "slug_not_found", affiliateId: null, attributionId: null };
  }
  if (aff.status !== "active") {
    return { status: "affiliate_inactive", affiliateId: aff.id, attributionId: null };
  }
  if (aff.userId === newUserId) {
    // Self-attribution bloquée (spec A-13).
    return { status: "affiliate_inactive", affiliateId: aff.id, attributionId: null };
  }

  const terms = resolveTerms(aff);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + terms.months * 30 * 24 * 60 * 60 * 1000);

  const [row] = await db.insert(affiliateAttributions).values({
    affiliateId:      aff.id,
    referredUserId:   newUserId,
    commissionPct:    terms.pct,
    commissionMonths: terms.months,
    attributedAt:     now,
    expiresAt,
  }).returning({ id: affiliateAttributions.id });

  return {
    status:        "captured",
    affiliateId:   aff.id,
    attributionId: row?.id ?? null,
  };
}

// ----------------------------------------------------------
// Click logging — appelé depuis l'endpoint public POST /affiliate/clicks
// ----------------------------------------------------------
export interface LogClickInput {
  slug:        string;
  visitorHash: string;
  landingUrl?: string | null;
  utmSource?:  string | null;
  utmMedium?:  string | null;
  utmCampaign?: string | null;
}

export async function logAffiliateClick(input: LogClickInput): Promise<{ logged: boolean }> {
  const slug = input.slug.trim().toLowerCase();
  const [aff] = await db
    .select({ id: affiliates.id, status: affiliates.status })
    .from(affiliates)
    .where(eq(affiliates.slug, slug))
    .limit(1);

  if (!aff || aff.status === "banned") {
    return { logged: false };
  }

  await db.insert(affiliateClicks).values({
    affiliateId: aff.id,
    visitorHash: input.visitorHash,
    landingUrl:  input.landingUrl  ?? null,
    utmSource:   input.utmSource   ?? null,
    utmMedium:   input.utmMedium   ?? null,
    utmCampaign: input.utmCampaign ?? null,
  });

  return { logged: true };
}

// ----------------------------------------------------------
// Stats helpers pour les routes /referrals/me et /affiliate/me
// ----------------------------------------------------------
export interface ReferralStats {
  code:       string;
  totals:     { invited: number; activated: number; rewarded: number };
  capMonth:   { used: number; max: number; resetsAt: string };
}

const REFERRAL_CAP_PER_30D = 20;

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await ensureReferralCode(userId);

  const rows = await db
    .select({ status: referrals.status })
    .from(referrals)
    .where(eq(referrals.referrerId, userId));

  const totals = { invited: rows.length, activated: 0, rewarded: 0 };
  for (const r of rows) {
    if (r.status === "activated" || r.status === "rewarded") totals.activated += 1;
    if (r.status === "rewarded") totals.rewarded += 1;
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referrals)
    .where(and(
      eq(referrals.referrerId, userId),
      eq(referrals.status, "rewarded"),
      gte(referrals.rewardedAt, cutoff),
    ));
  const used = recent[0]?.count ?? 0;

  return {
    code,
    totals,
    capMonth: {
      used,
      max:      REFERRAL_CAP_PER_30D,
      resetsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

export const growthService = {
  ensureReferralCode,
  hashVisitor,
  captureReferral,
  captureAffiliate,
  logAffiliateClick,
  getReferralStats,
};

// GROWTH-V1-CAPTURE applied
