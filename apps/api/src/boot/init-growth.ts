// ============================================================
// apps/api/src/boot/init-growth.ts
// GROWTH-V1-DB
// ------------------------------------------------------------
// Applique la structure DB du chantier growth (parrainage user→user
// + affiliation influenceurs). Miroir fidèle de
// migrations/0014_growth_v1.sql.
//
// Pattern aligné sur init-notifications.ts / init-readings.ts /
// init-schema-coherence.ts : le code TS inline les tables/colonnes
// en `IF NOT EXISTS`, le fichier .sql sert uniquement de trace
// historique (CONVENTION repo, pas de runner générique de
// migrations).
//
// À appeler depuis main() après ensureNotificationsSchema().
// Spec complète : GROWTH_PLAN.md à la racine.
// ============================================================

import { pool } from "../db/index.js";

// ------------------------------------------------------------
// SQL inliné (miroir fidèle de migrations/0014_growth_v1.sql)
// Idempotent : ALTER ADD COLUMN IF NOT EXISTS, CREATE TABLE
// IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, CREATE EXTENSION
// IF NOT EXISTS.
// ------------------------------------------------------------
const MIGRATION_SQL = `
-- pgcrypto pour pgp_sym_encrypt (branché en GROWTH-V1-ADMIN sur iban_encrypted)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------
-- users : ajout du code de parrainage + référence au parrain
-- ----------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "referral_code" varchar(12);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "referred_by" uuid REFERENCES "users"("id");

CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_uq"
  ON "users"("referral_code")
  WHERE "referral_code" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "users_referred_by_idx"
  ON "users"("referred_by")
  WHERE "referred_by" IS NOT NULL;

-- ----------------------------------------------------------
-- referrals : cycle de vie d'un parrainage
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "referrals" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrer_id"   uuid        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referred_id"   uuid        NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "status"        varchar(16) NOT NULL DEFAULT 'pending',
  "activated_at"  timestamp,
  "rewarded_at"   timestamp,
  "created_at"    timestamp   NOT NULL DEFAULT now(),
  CONSTRAINT "referrals_no_self_ck" CHECK ("referrer_id" <> "referred_id"),
  CONSTRAINT "referrals_status_ck"  CHECK ("status" IN ('pending','activated','rewarded','rejected'))
);
CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals"("referrer_id");
CREATE INDEX IF NOT EXISTS "referrals_status_time_idx" ON "referrals"("status", "created_at");

-- ----------------------------------------------------------
-- gift_codes : bons cadeaux 1 mois Essentiel (parrains Pro)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "gift_codes" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"          varchar(20) NOT NULL UNIQUE,
  "issued_to"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "granted_plan"  varchar(32) NOT NULL DEFAULT 'essential',
  "granted_days"  integer     NOT NULL DEFAULT 30,
  "expires_at"    timestamp   NOT NULL,
  "redeemed_by"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "redeemed_at"   timestamp,
  "created_at"    timestamp   NOT NULL DEFAULT now(),
  CONSTRAINT "gift_codes_days_ck" CHECK ("granted_days" > 0 AND "granted_days" <= 365)
);
CREATE INDEX IF NOT EXISTS "gift_codes_issued_to_idx"
  ON "gift_codes"("issued_to")
  WHERE "issued_to" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "gift_codes_unredeemed_idx"
  ON "gift_codes"("expires_at")
  WHERE "redeemed_at" IS NULL;

-- ----------------------------------------------------------
-- affiliates : compte affilié (tier + override + KYC)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "affiliates" (
  "id"                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "slug"                        varchar(40) NOT NULL UNIQUE,
  "display_name"                text        NOT NULL,
  "status"                      varchar(16) NOT NULL DEFAULT 'pending',
  "tier"                        varchar(16) NOT NULL DEFAULT 'standard',
  "commission_pct_override"     integer,
  "commission_months_override"  integer,
  "legal_name"                  text,
  "siret"                       text,
  "iban_encrypted"              bytea,
  "notes"                       text,
  "created_at"                  timestamp NOT NULL DEFAULT now(),
  "updated_at"                  timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "affiliates_status_ck"
    CHECK ("status" IN ('pending','active','paused','banned')),
  CONSTRAINT "affiliates_tier_ck"
    CHECK ("tier" IN ('standard','vip','top','partner')),
  CONSTRAINT "affiliates_pct_override_ck"
    CHECK ("commission_pct_override" IS NULL OR ("commission_pct_override" BETWEEN 5 AND 50)),
  CONSTRAINT "affiliates_months_override_ck"
    CHECK ("commission_months_override" IS NULL OR ("commission_months_override" BETWEEN 1 AND 36))
);
CREATE INDEX IF NOT EXISTS "affiliates_status_idx" ON "affiliates"("status");
CREATE INDEX IF NOT EXISTS "affiliates_user_idx"
  ON "affiliates"("user_id")
  WHERE "user_id" IS NOT NULL;

-- ----------------------------------------------------------
-- affiliate_clicks : journal append-only des clics (bigserial)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
  "id"            bigserial PRIMARY KEY,
  "affiliate_id"  uuid        NOT NULL REFERENCES "affiliates"("id"),
  "visitor_hash"  text        NOT NULL,
  "landing_url"   text,
  "utm_source"    text,
  "utm_medium"    text,
  "utm_campaign"  text,
  "created_at"    timestamp   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "affiliate_clicks_aff_time_idx"
  ON "affiliate_clicks"("affiliate_id", "created_at");
CREATE INDEX IF NOT EXISTS "affiliate_clicks_visitor_idx"
  ON "affiliate_clicks"("visitor_hash");

-- ----------------------------------------------------------
-- affiliate_attributions : snapshot strict des conditions
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "affiliate_attributions" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate_id"        uuid    NOT NULL REFERENCES "affiliates"("id"),
  "referred_user_id"    uuid    NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "commission_pct"      integer NOT NULL,
  "commission_months"   integer NOT NULL,
  "attributed_at"       timestamp NOT NULL DEFAULT now(),
  "expires_at"          timestamp NOT NULL,
  CONSTRAINT "aff_attr_pct_ck"    CHECK ("commission_pct" BETWEEN 5 AND 50),
  CONSTRAINT "aff_attr_months_ck" CHECK ("commission_months" BETWEEN 1 AND 36),
  CONSTRAINT "aff_attr_expiry_ck" CHECK ("expires_at" > "attributed_at")
);
CREATE INDEX IF NOT EXISTS "aff_attr_affiliate_idx"
  ON "affiliate_attributions"("affiliate_id");
CREATE INDEX IF NOT EXISTS "aff_attr_expires_idx"
  ON "affiliate_attributions"("expires_at");

-- ----------------------------------------------------------
-- affiliate_commissions : 1 ligne par facture Stripe attribuée
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "affiliate_commissions" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate_id"      uuid    NOT NULL REFERENCES "affiliates"("id"),
  "attribution_id"    uuid    NOT NULL REFERENCES "affiliate_attributions"("id"),
  "amount_cents"      integer NOT NULL,
  "period_month"      date    NOT NULL,
  "status"            varchar(16) NOT NULL DEFAULT 'accrued',
  "stripe_charge_id"  text,
  "created_at"        timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "aff_comm_status_ck"
    CHECK ("status" IN ('accrued','invoiced','paid','reversed'))
);
CREATE INDEX IF NOT EXISTS "aff_comm_aff_status_period_idx"
  ON "affiliate_commissions"("affiliate_id", "status", "period_month");
CREATE INDEX IF NOT EXISTS "aff_comm_attribution_idx"
  ON "affiliate_commissions"("attribution_id");
CREATE UNIQUE INDEX IF NOT EXISTS "aff_comm_stripe_charge_uq"
  ON "affiliate_commissions"("stripe_charge_id")
  WHERE "stripe_charge_id" IS NOT NULL;

-- ----------------------------------------------------------
-- affiliate_terms_history : audit log append-only (bigserial)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "affiliate_terms_history" (
  "id"               bigserial PRIMARY KEY,
  "affiliate_id"     uuid NOT NULL REFERENCES "affiliates"("id"),
  "changed_by"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "previous_tier"    varchar(16),
  "previous_pct"     integer,
  "previous_months"  integer,
  "new_tier"         varchar(16),
  "new_pct"          integer,
  "new_months"       integer,
  "reason"           text,
  "changed_at"       timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "aff_terms_hist_aff_time_idx"
  ON "affiliate_terms_history"("affiliate_id", "changed_at");
`;

/**
 * Applique la structure DB growth (parrainage + affiliation).
 * Idempotent — safe à appeler à chaque boot.
 */
export async function initGrowth(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.log("✅ [init-growth] tables growth prêtes (parrainage + affiliation)");
  } finally {
    client.release();
  }
}

// GROWTH-V1-DB applied
