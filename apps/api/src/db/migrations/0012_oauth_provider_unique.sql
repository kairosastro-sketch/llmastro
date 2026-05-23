-- ============================================================
-- 0012_oauth_provider_unique.sql
-- OAUTH-GOOGLE-FACEBOOK-V1 · UP migration
--
-- Active réellement les connexions OAuth Google + Facebook.
-- Les colonnes users.provider et users.provider_id existaient déjà
-- (cf. ARCHIVE-3-TIERS-V1 dans schema.ts) mais sans contrainte
-- d'unicité — un même couple (provider, provider_id) pouvait
-- théoriquement apparaître deux fois.
--
-- Cette migration ajoute un INDEX UNIQUE partiel sur
-- (provider, provider_id) WHERE provider_id IS NOT NULL :
--   - WHERE provider_id IS NOT NULL : les comptes locaux
--     (provider='local', provider_id NULL) ne sont pas concernés
--     par cette contrainte — c'est la colonne email qui les rend
--     uniques (UNIQUE déclaré au schema).
--   - L'index sert aussi de support pour les lookups dans
--     authService.upsertOAuthUser (recherche par couple).
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS users_provider_provider_id_unique
  ON users (provider, provider_id)
  WHERE provider_id IS NOT NULL;

-- OAUTH-GOOGLE-FACEBOOK-V1 applied
