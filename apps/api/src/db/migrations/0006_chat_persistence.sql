-- ============================================================
-- migrations/0006_chat_persistence.sql
-- ARCHIVE-CHAT-PERSISTENCE-V1-DATA
-- ------------------------------------------------------------
-- Persistance des conversations chat Kairos (sauvegarde
-- explicite par l'utilisateur, feature payante).
--
-- Idempotente : re-runnable sans casser l'état.
-- ============================================================

-- ----------------------------------------------------------
-- chat_conversations — métadonnées d'une conversation sauvegardée
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "natal_profile_id" uuid REFERENCES "natal_data"("id") ON DELETE SET NULL,
  "planet_key"       varchar(20) NOT NULL,
  "title"            varchar(255),
  "created_at"       timestamp NOT NULL DEFAULT now(),
  "last_message_at"  timestamp NOT NULL DEFAULT now()
);

-- Index pour la liste des conversations d'un user, triée par récence
CREATE INDEX IF NOT EXISTS "chat_conversations_user_time_idx"
  ON "chat_conversations" ("user_id", "last_message_at" DESC);

-- ----------------------------------------------------------
-- chat_messages — messages individuels (role + content)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  "role"            varchar(20) NOT NULL,   -- 'user' | 'assistant'
  "content"         text NOT NULL,
  "created_at"      timestamp NOT NULL DEFAULT now()
);

-- Index pour récupérer les messages d'une conversation, ordre chronologique
CREATE INDEX IF NOT EXISTS "chat_messages_conv_time_idx"
  ON "chat_messages" ("conversation_id", "created_at");

-- ----------------------------------------------------------
-- plan_entitlements — chat_save_count (limite de conversations
-- sauvegardables par tier)
-- ----------------------------------------------------------
-- valueType = "limit", value = number simple (cf. natal.profiles.max)
-- Convention : -1 = illimité, 0 = désactivé

INSERT INTO "plan_entitlements" ("plan_id", "feature_key", "value_type", "value")
SELECT p."id", 'chat_save_count', 'limit', '1'::jsonb
FROM "plans" p WHERE p."code" = 'free'
ON CONFLICT ("plan_id", "feature_key") DO UPDATE SET "value" = EXCLUDED."value";

INSERT INTO "plan_entitlements" ("plan_id", "feature_key", "value_type", "value")
SELECT p."id", 'chat_save_count', 'limit', '10'::jsonb
FROM "plans" p WHERE p."code" = 'essential'
ON CONFLICT ("plan_id", "feature_key") DO UPDATE SET "value" = EXCLUDED."value";

INSERT INTO "plan_entitlements" ("plan_id", "feature_key", "value_type", "value")
SELECT p."id", 'chat_save_count', 'limit', '100'::jsonb
FROM "plans" p WHERE p."code" = 'premium'
ON CONFLICT ("plan_id", "feature_key") DO UPDATE SET "value" = EXCLUDED."value";

-- ----------------------------------------------------------
-- plan_entitlements — chat_save_ttl_days (auto-purge pour free)
-- ----------------------------------------------------------
-- 30 = purge après 30 jours (free)
-- 0  = pas de purge (essential, premium)

INSERT INTO "plan_entitlements" ("plan_id", "feature_key", "value_type", "value")
SELECT p."id", 'chat_save_ttl_days', 'limit', '30'::jsonb
FROM "plans" p WHERE p."code" = 'free'
ON CONFLICT ("plan_id", "feature_key") DO UPDATE SET "value" = EXCLUDED."value";

INSERT INTO "plan_entitlements" ("plan_id", "feature_key", "value_type", "value")
SELECT p."id", 'chat_save_ttl_days', 'limit', '0'::jsonb
FROM "plans" p WHERE p."code" IN ('essential', 'premium')
ON CONFLICT ("plan_id", "feature_key") DO UPDATE SET "value" = EXCLUDED."value";

-- CHAT-PERSISTENCE-V1-DATA migration applied
