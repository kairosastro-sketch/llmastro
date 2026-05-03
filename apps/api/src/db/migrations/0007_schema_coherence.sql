-- ============================================================
-- migrations/0007_schema_coherence.sql
-- ARCHIVE-SCHEMA-COHERENCE-V1
-- ------------------------------------------------------------
-- Répare le schema drift entre apps/api/src/db/schema.ts
-- (drizzle, source de vérité du typage runtime) et la chaîne
-- de migrations Postgres exécutables au boot.
--
-- Colonnes manquantes au boot fresh DB :
--   - users.deleted_at                 (soft-delete avec
--                                       grâce 30j, ACCOUNT-DELETE-V1)
--   - natal_data.gender                (champ profil natal)
--   - natal_data.relationship_status   (champ profil natal)
--
-- Le SQL réel est inliné dans :
--   apps/api/src/boot/init-schema-coherence.ts
--
-- Cette migration est documentaire, suit le pattern existant
-- (cf. 0003-0006 dont le SQL est dupliqué dans boot/*.ts pour
-- bundle .cjs sans dépendance fs.readFile).
--
-- Idempotente : ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- Aucune perte de données possible (ajouts uniquement).
-- ============================================================

-- ----------------------------------------------------------
-- users.deleted_at — soft delete (ACCOUNT-DELETE-V1)
-- ----------------------------------------------------------
-- NULL = compte actif. Non-NULL = compte programmé pour
-- suppression définitive après 30j de période de grâce
-- (cf. apps/api/src/services/auth.service.ts).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

-- ----------------------------------------------------------
-- natal_data.gender + relationship_status
-- ----------------------------------------------------------
-- Champs profil natal pour personnaliser les lectures IA.
-- Default 'unspecified' = pas d'info, comportement neutre.
ALTER TABLE "natal_data"
  ADD COLUMN IF NOT EXISTS "gender" varchar(20) NOT NULL DEFAULT 'unspecified';

ALTER TABLE "natal_data"
  ADD COLUMN IF NOT EXISTS "relationship_status" varchar(20) NOT NULL DEFAULT 'unspecified';

-- ARCHIVE-SCHEMA-COHERENCE-V1 migration applied (documentaire)
