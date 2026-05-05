-- ============================================================
-- 0008_sky_publication.sql
-- CIEL-PUBLIC-V1-DATA-POSITIONS · UP migration
--
-- Stocke les publications éphémérides publiques (jour/semaine/mois/an)
-- avec un slot llm_text rempli plus tard par CIEL-PUBLIC-V1-LLM.
-- La colonne `data` JSONB est extensible : EVENTS archive y ajoutera
-- un champ `events` sans nouvelle migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS sky_publication (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence           VARCHAR(10) NOT NULL CHECK (cadence IN ('day','week','month','year')),
  period_start      TIMESTAMP NOT NULL,
  period_end        TIMESTAMP NOT NULL,
  data              JSONB NOT NULL,
  llm_text          TEXT,
  llm_model         VARCHAR(100),
  llm_generated_at  TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sky_publication_cadence_period_uq
  ON sky_publication(cadence, period_start);

CREATE INDEX IF NOT EXISTS sky_publication_lookup_idx
  ON sky_publication(cadence, period_start DESC);
