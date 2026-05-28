// ============================================================
// PROMO-CODES-V1
// apps/api/src/boot/init-promo-codes.ts
// ------------------------------------------------------------
// Tables des codes promo internes. Miroir fidèle de
// migrations/0017_promo_codes.sql ; le runtime applique le DDL
// inliné ici à chaque boot (idempotent), le .sql sert d'audit.
// Voir GROWTH_PLAN.md / init-growth.ts pour la convention.
// ============================================================

import { pool } from "../db/index.js";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id"                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"                    varchar(40) NOT NULL UNIQUE,
  "description"             text,
  "kind"                    varchar(32) NOT NULL,
  "subscription_plan_code"  varchar(32),
  "subscription_days"       integer,
  "feature_key"             varchar(64),
  "credit_quantity"         integer,
  "max_redemptions"         integer,
  "max_per_user"            integer NOT NULL DEFAULT 1,
  "redemptions_count"       integer NOT NULL DEFAULT 0,
  "valid_from"              timestamp,
  "expires_at"              timestamp,
  "active"                  boolean NOT NULL DEFAULT true,
  "created_by"              uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"              timestamp NOT NULL DEFAULT now(),
  "updated_at"              timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "promo_codes_kind_ck"
    CHECK ("kind" IN ('subscription_days','feature_credits')),
  CONSTRAINT "promo_codes_max_per_user_ck"
    CHECK ("max_per_user" >= 1),
  CONSTRAINT "promo_codes_max_redemptions_ck"
    CHECK ("max_redemptions" IS NULL OR "max_redemptions" >= 1),
  CONSTRAINT "promo_codes_sub_days_shape_ck"
    CHECK (
      "kind" <> 'subscription_days' OR (
        "subscription_plan_code" IS NOT NULL
        AND "subscription_days" IS NOT NULL
        AND "subscription_days" BETWEEN 1 AND 365
      )
    ),
  CONSTRAINT "promo_codes_credits_shape_ck"
    CHECK (
      "kind" <> 'feature_credits' OR (
        "feature_key" IS NOT NULL
        AND "credit_quantity" IS NOT NULL
        AND "credit_quantity" BETWEEN 1 AND 10000
      )
    )
);
CREATE INDEX IF NOT EXISTS "promo_codes_active_idx" ON "promo_codes"("active");

CREATE TABLE IF NOT EXISTS "promo_code_redemptions" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "promo_code_id"  uuid NOT NULL REFERENCES "promo_codes"("id") ON DELETE CASCADE,
  "user_id"        uuid NOT NULL REFERENCES "users"("id")       ON DELETE CASCADE,
  "grant_id"       uuid,
  "redeemed_at"    timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "promo_redemptions_code_user_uq" UNIQUE ("promo_code_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "promo_redemptions_user_idx" ON "promo_code_redemptions"("user_id");
`;

export async function initPromoCodes(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.log("✅ [init-promo-codes] tables promo_codes prêtes");
  } finally {
    client.release();
  }
}

// PROMO-CODES-V1 applied
