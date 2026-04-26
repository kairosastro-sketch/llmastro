-- ARCHIVE-PERSISTENCE-LECTURES-IA-V1
-- Migration 0004 : table ai_readings — persistance des lectures Kairos.
-- Idempotente : re-runnable sans casser l'état.
--
-- Résout le bug cross-device : un même utilisateur voit la même lecture
-- sur tous ses appareils tant que le promptVersion n'a pas été incrémenté.

-- ----------------------------------------------------------
-- ai_readings
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ai_readings" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "natal_profile_id" uuid REFERENCES "natal_data"("id") ON DELETE CASCADE,

  -- Type et clé de déduplication
  "kind"             varchar(32) NOT NULL,        -- horoscope | natal_profile | tarot | synastry
  "reading_key"      varchar(255) NOT NULL,       -- voir buildReadingKey() dans readings.service.ts

  -- Contenu généré et métadonnées
  "content"          jsonb NOT NULL,
  "prompt_version"   integer NOT NULL,
  "model"            varchar(100) NOT NULL,

  -- Métadonnées temporelles
  "generated_at"     timestamp NOT NULL DEFAULT NOW(),
  "regenerated_at"   timestamp,
  "regen_count"      integer NOT NULL DEFAULT 0
);

-- Index unique pour empêcher les doublons logiques (race conditions)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ai_readings_user_kind_key"
  ON "ai_readings" ("user_id", "kind", "reading_key");

-- Index secondaires pour les lookups les plus fréquents
CREATE INDEX IF NOT EXISTS "idx_ai_readings_user_kind"
  ON "ai_readings" ("user_id", "kind");

CREATE INDEX IF NOT EXISTS "idx_ai_readings_natal_profile"
  ON "ai_readings" ("natal_profile_id")
  WHERE "natal_profile_id" IS NOT NULL;
