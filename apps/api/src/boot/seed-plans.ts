// ARCHIVE-3-TIERS-V1 HOTFIX-3A
// Helper de boot : applique la migration SQL 0003 si absente, puis seed.
// SQL inline (pas de readFile) pour que ça marche avec un bundle .cjs.

import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { assertMigrationApplied, seedPlans } from "../seed/plans.seed.js";

// ----------------------------------------------------------
// SQL de migration inliné
// ----------------------------------------------------------
// Miroir fidèle de apps/api/src/db/migrations/0003_tiers_and_grants.sql
// Garder les deux en sync si tu modifies l'un.
const MIGRATION_SQL = `
-- users.timezone
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(64) NOT NULL DEFAULT 'UTC';

-- plans
CREATE TABLE IF NOT EXISTS "plans" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"             varchar(32)   NOT NULL UNIQUE,
  "name"             varchar(100)  NOT NULL,
  "description"      text          NOT NULL DEFAULT '',
  "price_cents"      integer       NOT NULL DEFAULT 0,
  "currency"         varchar(3)    NOT NULL DEFAULT 'EUR',
  "billing_period"   varchar(16)   NOT NULL DEFAULT 'month',
  "stripe_price_id"  varchar(255),
  "is_active"        boolean       NOT NULL DEFAULT true,
  "sort_order"       integer       NOT NULL DEFAULT 0,
  "created_at"       timestamp     NOT NULL DEFAULT now(),
  "updated_at"       timestamp     NOT NULL DEFAULT now()
);

-- plan_entitlements
CREATE TABLE IF NOT EXISTS "plan_entitlements" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id"      uuid         NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "feature_key"  varchar(100) NOT NULL,
  "value_type"   varchar(16)  NOT NULL,
  "value"        jsonb        NOT NULL,
  "created_at"   timestamp    NOT NULL DEFAULT now(),
  "updated_at"   timestamp    NOT NULL DEFAULT now(),
  CONSTRAINT "plan_entitlements_plan_feature_uq" UNIQUE ("plan_id", "feature_key")
);
CREATE INDEX IF NOT EXISTS "plan_entitlements_plan_idx" ON "plan_entitlements"("plan_id");

-- user_subscriptions
CREATE TABLE IF NOT EXISTS "user_subscriptions" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                  uuid         NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "plan_id"                  uuid         NOT NULL REFERENCES "plans"("id"),
  "status"                   varchar(16)  NOT NULL DEFAULT 'active',
  "started_at"               timestamp    NOT NULL DEFAULT now(),
  "current_period_end"       timestamp,
  "stripe_subscription_id"   varchar(255),
  "stripe_customer_id"       varchar(255),
  "created_at"               timestamp    NOT NULL DEFAULT now(),
  "updated_at"               timestamp    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_subscriptions_status_idx" ON "user_subscriptions"("status");

-- user_entitlement_overrides
CREATE TABLE IF NOT EXISTS "user_entitlement_overrides" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feature_key" varchar(100) NOT NULL,
  "value_type"  varchar(16)  NOT NULL,
  "value"       jsonb        NOT NULL,
  "reason"      text         NOT NULL DEFAULT '',
  "expires_at"  timestamp,
  "created_at"  timestamp    NOT NULL DEFAULT now(),
  "updated_at"  timestamp    NOT NULL DEFAULT now(),
  CONSTRAINT "user_overrides_user_feature_uq" UNIQUE ("user_id", "feature_key")
);
CREATE INDEX IF NOT EXISTS "user_overrides_user_idx" ON "user_entitlement_overrides"("user_id");

-- user_grants
CREATE TABLE IF NOT EXISTS "user_grants" (
  "id"                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                    uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feature_key"                varchar(100) NOT NULL,
  "grant_type"                 varchar(16)  NOT NULL,
  "quantity"                   integer      NOT NULL DEFAULT 1,
  "consumed"                   integer      NOT NULL DEFAULT 0,
  "expires_at"                 timestamp,
  "source"                     varchar(16)  NOT NULL DEFAULT 'purchase',
  "stripe_payment_intent_id"   varchar(255),
  "metadata"                   jsonb,
  "created_at"                 timestamp    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_grants_user_feature_idx" ON "user_grants"("user_id", "feature_key");
CREATE INDEX IF NOT EXISTS "user_grants_user_expire_idx"  ON "user_grants"("user_id", "expires_at");

-- usage_counters
CREATE TABLE IF NOT EXISTS "usage_counters" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      uuid         NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feature_key"  varchar(100) NOT NULL,
  "period_key"   varchar(16)  NOT NULL,
  "count"        integer      NOT NULL DEFAULT 0,
  "updated_at"   timestamp    NOT NULL DEFAULT now(),
  CONSTRAINT "usage_counters_triplet_uq" UNIQUE ("user_id", "feature_key", "period_key")
);
CREATE INDEX IF NOT EXISTS "usage_counters_user_idx" ON "usage_counters"("user_id");
`;

// ----------------------------------------------------------
// Applique la migration si les tables de tiers n'existent pas
// ----------------------------------------------------------
async function maybeApplyMigration(): Promise<void> {
  const result = await db.execute(sql`
    SELECT to_regclass('public.plans') AS exists
  `);
  const rows = (result as unknown as { rows?: { exists: string | null }[] }).rows
    ?? (result as unknown as { exists: string | null }[]);
  const tableExists = Array.isArray(rows) && rows[0]?.exists !== null;

  if (tableExists) return;

  // eslint-disable-next-line no-console
  console.info("[bootTiers] Tables de tiers absentes, application de la migration 0003…");

  await db.execute(sql.raw(MIGRATION_SQL));

  // eslint-disable-next-line no-console
  console.info("[bootTiers] Migration appliquée.");
}

// ----------------------------------------------------------
// STRIPE-MVP-V1 : garantit la colonne stripe_price_id sur les DBs
// créées avant son ajout au CREATE TABLE plans. Idempotent.
// ----------------------------------------------------------
async function ensureStripePriceIdColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "plans"
      ADD COLUMN IF NOT EXISTS "stripe_price_id" varchar(255)
  `);
}

// ----------------------------------------------------------
// Point d'entrée
// ----------------------------------------------------------
export async function bootTiers(): Promise<void> {
  await maybeApplyMigration();
  await ensureStripePriceIdColumn();
  await assertMigrationApplied();
  await seedPlans();
}
