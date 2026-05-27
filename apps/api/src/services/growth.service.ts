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
import { and, eq, gte, sql, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  users,
  referrals,
  affiliates,
  affiliateAttributions,
  affiliateClicks,
  giftCodes,
} from "../db/schema.js";
import { resolveTerms } from "../config/affiliate-tiers.config.js";
import * as grantsService from "./grants.service.js";
import { subscriptionsService } from "./subscriptions.service.js";

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

// ----------------------------------------------------------
// GROWTH-V1-AFFILIATE-UI
// Candidatures publiques + stats détaillées affiliation
// ----------------------------------------------------------

export interface AffiliateApplicationInput {
  displayName:   string;
  email:         string;
  socialHandle:  string;
  audienceSize?: string;
  motivation?:   string;
}

/**
 * Génère un slug à partir d'un displayName. Garde les lettres,
 * chiffres et tirets, lowercase, suffixe 4 chars random pour
 * éviter les collisions humaines (ex: deux "Luna Astro").
 */
function slugifyDisplayName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "affiliate";
  const suffix = crypto.randomBytes(2).toString("hex"); // 4 hex chars
  return `${base}-${suffix}`;
}

/**
 * Crée une ligne affiliates en status='pending'. Pas d'attache user_id —
 * le candidat peut être un visiteur non inscrit. L'admin attachera plus
 * tard via GROWTH-V1-ADMIN.
 *
 * Stocke email + audienceSize + motivation dans `notes` (texte libre).
 * On évite de pousser un nouveau set de colonnes pour un MVP de capture
 * de candidatures — `notes` est désigné pour ça.
 */
export async function submitApplication(input: AffiliateApplicationInput): Promise<{ id: string; slug: string }> {
  // Retry sur collision de slug
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = slugifyDisplayName(input.displayName);
    try {
      const notes = JSON.stringify({
        kind:         "application",
        email:        input.email,
        socialHandle: input.socialHandle,
        audienceSize: input.audienceSize ?? null,
        motivation:   input.motivation   ?? null,
        submittedAt:  new Date().toISOString(),
      });

      const [row] = await db.insert(affiliates).values({
        slug,
        displayName: input.displayName.trim().slice(0, 200),
        status:      "pending",
        tier:        "standard",
        notes,
      }).returning({ id: affiliates.id, slug: affiliates.slug });

      if (!row) throw new Error("Insert returned no row");
      return { id: row.id, slug: row.slug };
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code !== "23505") throw err;   // re-throw non-unique errors
    }
  }
  throw new Error("Failed to allocate unique slug after retries");
}

// ----------------------------------------------------------
// Stats détaillées pour le dashboard affilié
// ----------------------------------------------------------
export interface AffiliateStats {
  affiliateId:        string;
  slug:               string;
  displayName:        string;
  status:             string;
  tier:               string;
  terms:              { pct: number; months: number; source: "tier" | "override" };
  monthToDate:        {
    clicks:           number;
    signups:          number;
    activeAttributions: number;
    commissionAccruedCents: number;
  };
  lifetime: {
    clicks:           number;
    signups:          number;
    commissionPaidCents: number;
  };
}

export async function getAffiliateStats(userId: string): Promise<AffiliateStats | null> {
  const [aff] = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.userId, userId))
    .limit(1);
  if (!aff) return null;

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  // Compte des clics ce mois-ci
  const monthClicks = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(affiliateClicks)
    .where(and(
      eq(affiliateClicks.affiliateId, aff.id),
      gte(affiliateClicks.createdAt, startOfMonth),
    ));

  const totalClicks = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(affiliateClicks)
    .where(eq(affiliateClicks.affiliateId, aff.id));

  // Signups + attributions actives via affiliate_attributions
  const monthSignups = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(affiliateAttributions)
    .where(and(
      eq(affiliateAttributions.affiliateId, aff.id),
      gte(affiliateAttributions.attributedAt, startOfMonth),
    ));

  const totalSignups = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(affiliateAttributions)
    .where(eq(affiliateAttributions.affiliateId, aff.id));

  const activeAttr = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(affiliateAttributions)
    .where(and(
      eq(affiliateAttributions.affiliateId, aff.id),
      sql`${affiliateAttributions.expiresAt} > now()`,
    ));

  const terms = resolveTerms(aff);

  // NB : les agrégats commissions arrivent en GROWTH-V2-STRIPE
  // (la table affiliate_commissions est vide tant que Stripe n'est pas branché).
  return {
    affiliateId:        aff.id,
    slug:               aff.slug,
    displayName:        aff.displayName,
    status:             aff.status,
    tier:               aff.tier,
    terms,
    monthToDate: {
      clicks:           monthClicks[0]?.c ?? 0,
      signups:          monthSignups[0]?.c ?? 0,
      activeAttributions: activeAttr[0]?.c ?? 0,
      commissionAccruedCents: 0,   // TODO GROWTH-V2-STRIPE
    },
    lifetime: {
      clicks:               totalClicks[0]?.c ?? 0,
      signups:              totalSignups[0]?.c ?? 0,
      commissionPaidCents:  0,     // TODO GROWTH-V2-STRIPE
    },
  };
}

// ============================================================
// GROWTH-V1-ACTIVATION-HOOK + GROWTH-V1-GIFT-CODES
// ============================================================

const ACTIVATION_MIN_ACCOUNT_AGE_DAYS = 3;
const REFERRAL_REWARD_PACK: Record<string, number> = {
  "ai.chat.credits":  10,
  "tarot.credits":    3,
  "synastry.credits": 1,
};

// Le plan "Pro" est codé "premium" en DB (cf. plans.config.ts ARCHIVE-TIERS-V2).
const PRO_PLAN_CODE = "premium";

// Bon cadeau Pro : 1 mois Essentiel, valable 90j avant expiration.
const GIFT_CODE_GRANTED_PLAN = "essential";
const GIFT_CODE_GRANTED_DAYS = 30;
const GIFT_CODE_VALIDITY_DAYS = 90;

// Le cap glissant REFERRAL_CAP_PER_30D est déjà défini plus haut
// (utilisé par getReferralStats).

// ----------------------------------------------------------
// Génération de code cadeau au format LLM-XXXX-XXXX
// (alphabet lisible commun avec referral_code, 4+4 chars).
// ----------------------------------------------------------
function randomSegment(len = 4): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += REFERRAL_CODE_ALPHABET[bytes[i]! % REFERRAL_CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Crée un gift code pour le parrain Pro. Retourne le code généré.
 * Idempotent par appel (chaque appel crée un nouveau code) — l'idempotence
 * de l'activation elle-même est gérée en amont via referrals.status.
 */
async function generateGiftCode(parrainId: string): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + GIFT_CODE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = `LLM-${randomSegment(4)}-${randomSegment(4)}`;
    try {
      const [row] = await db.insert(giftCodes).values({
        code,
        issuedTo:    parrainId,
        grantedPlan: GIFT_CODE_GRANTED_PLAN,
        grantedDays: GIFT_CODE_GRANTED_DAYS,
        expiresAt,
      }).returning({ code: giftCodes.code });
      if (row) return { code: row.code, expiresAt };
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code !== "23505") throw err;
    }
  }
  throw new Error("Failed to generate unique gift code after retries");
}

// ----------------------------------------------------------
// Distribue le pack de crédits référral à un user (filleul ou parrain).
// ----------------------------------------------------------
async function grantReferralPack(userId: string, referralRowId: string): Promise<void> {
  for (const [featureKey, quantity] of Object.entries(REFERRAL_REWARD_PACK)) {
    await grantsService.createCredit({
      userId,
      featureKey,
      quantity,
      source:   "gift",
      metadata: { kind: "referral_reward", referralId: referralRowId },
    });
  }
}

// ----------------------------------------------------------
// tryActivateReferral
// ----------------------------------------------------------
// Idempotent. Appelé typiquement depuis natal.service.create() après
// l'insert. Retourne un statut diagnostic pour traçabilité dans les
// logs, mais ne throw jamais — la création de natal ne doit jamais
// échouer à cause d'un parrainage.
//
// Étapes :
//   1. Lookup referrals.referredId = userId
//   2. Si déjà rewarded/rejected → no-op
//   3. Si age compte < 3j → "account_too_young" no-op
//   4. Marque pending → activated (activated_at = now)
//   5. Check cap parrain (20 rewarded sur 30j glissants)
//        - dépassé → status reste 'activated', no grants
//   6. Look up plan parrain :
//        - Pro → generateGiftCode(parrain) + grantReferralPack(filleul)
//        - sinon → grantReferralPack(parrain) + grantReferralPack(filleul)
//   7. activated → rewarded (rewarded_at = now)
// ----------------------------------------------------------

export type ActivationResult =
  | { activated: false; reason: "no_referral" | "account_too_young" | "already_processed" }
  | { activated: true;  rewarded: false; reason: "cap_exceeded" }
  | { activated: true;  rewarded: true;  rewardType: "credits" | "gift_code"; giftCode?: string };

export async function tryActivateReferral(userId: string): Promise<ActivationResult> {
  // 1. Lookup referral row (one per filleul max, garanti par unique constraint)
  const [ref] = await db
    .select()
    .from(referrals)
    .where(eq(referrals.referredId, userId))
    .limit(1);

  if (!ref) return { activated: false, reason: "no_referral" };
  if (ref.status === "rewarded" || ref.status === "rejected") {
    return { activated: false, reason: "already_processed" };
  }

  // 2. Account age check
  const [user] = await db
    .select({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { activated: false, reason: "no_referral" };

  const ageMs    = Date.now() - user.createdAt.getTime();
  const minAgeMs = ACTIVATION_MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs < minAgeMs) {
    return { activated: false, reason: "account_too_young" };
  }

  // 3. Marque activated (idempotent : si déjà activated, on continue
  //    sans toucher activated_at).
  const now = new Date();
  if (ref.status === "pending") {
    await db.update(referrals)
      .set({ status: "activated", activatedAt: now })
      .where(eq(referrals.id, ref.id));
  }

  // 4. Cap check (rewarded dans les 30 derniers jours pour ce parrain)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cap = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referrals)
    .where(and(
      eq(referrals.referrerId, ref.referrerId),
      eq(referrals.status, "rewarded"),
      gte(referrals.rewardedAt, cutoff),
    ));
  if ((cap[0]?.count ?? 0) >= REFERRAL_CAP_PER_30D) {
    return { activated: true, rewarded: false, reason: "cap_exceeded" };
  }

  // 5. Plan parrain
  const parrainSub = await subscriptionsService.getActive(ref.referrerId);
  const isPro = parrainSub?.planCode === PRO_PLAN_CODE;

  // 6. Distribution
  let giftCode: string | undefined;
  if (isPro) {
    const gift = await generateGiftCode(ref.referrerId);
    giftCode = gift.code;
    await grantReferralPack(userId, ref.id);  // filleul garde le pack
  } else {
    await grantReferralPack(ref.referrerId, ref.id);
    await grantReferralPack(userId,         ref.id);
  }

  // 7. Marque rewarded
  await db.update(referrals)
    .set({ status: "rewarded", rewardedAt: new Date() })
    .where(eq(referrals.id, ref.id));

  return {
    activated:   true,
    rewarded:    true,
    rewardType:  isPro ? "gift_code" : "credits",
    ...(giftCode ? { giftCode } : {}),
  };
}

// ----------------------------------------------------------
// Gift codes : redeem + listing
// ----------------------------------------------------------

export type RedeemResult =
  | { success: true;  grantedPlan: string; grantedDays: number; newPeriodEnd: string }
  | { success: false; reason: "not_found" | "expired" | "already_redeemed" | "self_redeem" | "already_paid" };

/**
 * Consomme un gift code pour un user. Le user passe en `essential` trialing
 * pour `granted_days` jours. Refuse si user déjà sur un plan payant actif
 * (essential non-trialing OU premium) — la valeur du gift serait perdue.
 */
export async function redeemGiftCode(userId: string, rawCode: string): Promise<RedeemResult> {
  const normalized = rawCode.trim().toUpperCase();
  if (normalized.length < 8) return { success: false, reason: "not_found" };

  const [gift] = await db
    .select()
    .from(giftCodes)
    .where(eq(giftCodes.code, normalized))
    .limit(1);

  if (!gift) return { success: false, reason: "not_found" };
  if (gift.redeemedAt) return { success: false, reason: "already_redeemed" };
  if (gift.expiresAt.getTime() <= Date.now()) return { success: false, reason: "expired" };
  if (gift.issuedTo === userId) return { success: false, reason: "self_redeem" };

  // Refuse si user déjà sur paid plan non-trial
  const sub = await subscriptionsService.getActive(userId);
  if (sub) {
    const onPremium  = sub.planCode === "premium";
    const onPaidEss  = sub.planCode === "essential" && sub.status === "active";
    if (onPremium || onPaidEss) {
      return { success: false, reason: "already_paid" };
    }
  }

  const newPeriodEnd = new Date(Date.now() + gift.grantedDays * 24 * 60 * 60 * 1000);

  // Sequencing : on update gift_codes EN PREMIER. Si setPlan échoue après,
  // le gift est "perdu" côté flag mais l'audit montre le redemption.
  // Inversement pas idéal (gift non marqué → re-redeem possible). On
  // accepte ce trade-off vu la rareté du flow et l'absence d'enjeu monétaire.
  await db.update(giftCodes)
    .set({ redeemedBy: userId, redeemedAt: new Date() })
    .where(eq(giftCodes.id, gift.id));

  await subscriptionsService.setPlan(userId, gift.grantedPlan, {
    status:           "trialing",
    currentPeriodEnd: newPeriodEnd,
  });

  return {
    success:      true,
    grantedPlan:  gift.grantedPlan,
    grantedDays:  gift.grantedDays,
    newPeriodEnd: newPeriodEnd.toISOString(),
  };
}

/**
 * Liste les codes cadeaux émis par un user Pro (pour son /dashboard/parrainage).
 * Retourne tous les codes ordonnés par date desc, max 50.
 */
export interface GiftCodeView {
  code:        string;
  status:      "unused" | "redeemed" | "expired";
  expiresAt:   string;
  redeemedAt:  string | null;
  createdAt:   string;
}

export async function listIssuedGiftCodes(userId: string): Promise<GiftCodeView[]> {
  const rows = await db
    .select()
    .from(giftCodes)
    .where(eq(giftCodes.issuedTo, userId))
    .orderBy(desc(giftCodes.createdAt))
    .limit(50);

  const now = Date.now();
  return rows.map((g) => ({
    code:       g.code,
    status:     g.redeemedAt
      ? "redeemed"
      : g.expiresAt.getTime() <= now
        ? "expired"
        : "unused",
    expiresAt:  g.expiresAt.toISOString(),
    redeemedAt: g.redeemedAt?.toISOString() ?? null,
    createdAt:  g.createdAt.toISOString(),
  }));
}

export const growthService = {
  ensureReferralCode,
  hashVisitor,
  captureReferral,
  captureAffiliate,
  logAffiliateClick,
  getReferralStats,
  // GROWTH-V1-AFFILIATE-UI
  submitApplication,
  getAffiliateStats,
  // GROWTH-V1-ACTIVATION-HOOK + GROWTH-V1-GIFT-CODES
  tryActivateReferral,
  redeemGiftCode,
  listIssuedGiftCodes,
};

// GROWTH-V1-CAPTURE applied
// GROWTH-V1-AFFILIATE-UI applied
// GROWTH-V1-ACTIVATION-HOOK applied
// GROWTH-V1-GIFT-CODES applied
