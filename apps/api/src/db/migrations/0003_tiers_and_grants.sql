-- ARCHIVE-3-TIERS-V1
-- Migration 0003: système de tiers, entitlements, grants, compteurs de quota.
-- Idempotente : re-runnable sans casser l'état.

-- ----------------------------------------------------------
-- users.timezone — ajout
-- ----------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "timezone" varchar(64) NOT NULL DEFAULT 'UTC';

-- ----------------------------------------------------------
-- plans
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- plan_entitlements
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- user_subscriptions
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- user_entitlement_overrides
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- user_grants
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- usage_counters
-- ----------------------------------------------------------
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
