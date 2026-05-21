-- ============================================================
-- 0011_tarot_persistence.sql — TAROT-PERSISTENCE-V1
-- ------------------------------------------------------------
-- Tirages de tarot sauvegardés par l'utilisateur.
-- Pattern miroir de 0006_chat_persistence.sql.
--
-- Un tirage est atomique : question + cartes + interprétation IA
-- stockés dans la colonne JSONB `data` (pas de table enfant,
-- contrairement aux messages de chat).
--
-- IMPORTANT : les entitlements (tarot_save_count) sont gérés via
-- plans.config.ts → seed-plans.ts (source de vérité unique). On
-- n'inline donc AUCUN INSERT entitlement ici.
-- ============================================================

CREATE TABLE IF NOT EXISTS "tarot_readings" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "natal_profile_id" uuid REFERENCES "natal_data"("id") ON DELETE SET NULL,
  "title"            varchar(255),
  "data"             jsonb NOT NULL,
  "created_at"       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tarot_readings_user_time_idx"
  ON "tarot_readings" ("user_id", "created_at" DESC);
