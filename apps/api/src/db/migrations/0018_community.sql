-- COMMUNITY-V1 — stats sociales anonymes (cf. COMMUNITY-V1.md)
-- DDL d'audit. Appliquée au runtime de façon idempotente par boot/init-community.ts.

-- Opt-in d'inclusion + traçabilité du consentement (C-02, C-16).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS community_stats_opt_in BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS community_opt_in_at TIMESTAMPTZ;

-- Désignation du thème "moi" du membre (C-07). Un seul is_self=true par user,
-- garanti par l'index partiel unique.
ALTER TABLE natal_data
  ADD COLUMN IF NOT EXISTS is_self BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS natal_data_one_self_per_user
  ON natal_data (user_id) WHERE is_self;

-- Placements projetés — table DÉRIVÉE, reconstructible (C-10). Aucune donnée
-- de naissance ré-identifiante (C-06). En V1, 3 lignes max par membre (C-22).
CREATE TABLE IF NOT EXISTS community_placements (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planet      VARCHAR(16) NOT NULL,   -- 'Sun' | 'Moon' | 'Ascendant'
  sign        VARCHAR(16) NOT NULL,   -- 'Aries' … 'Pisces'
  sign_degree INTEGER,                -- 0-29, nullable
  house       INTEGER,                -- 1-12, NULL pour l'Ascendant (angle)
  element     VARCHAR(8)  NOT NULL,   -- fire|earth|air|water
  modality    VARCHAR(8)  NOT NULL,   -- cardinal|fixed|mutable
  PRIMARY KEY (user_id, planet)
);
CREATE INDEX IF NOT EXISTS community_placements_planet_sign ON community_placements (planet, sign);
CREATE INDEX IF NOT EXISTS community_placements_planet_elem ON community_placements (planet, element);
