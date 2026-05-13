-- ============================================================
-- 0010_paywall_v3_cleanup.sql
-- PAYWALL-V3 · UP migration (cleanup post-refactor de quotas)
--
-- Le commit b1303b5 (PR #37) a remplacé le quota mensuel
-- ai.natal_reading.monthly par horoscope.daily.monthly. Le seeder
-- (seedPlans) prune automatiquement les rows orphelines de la table
-- plan_entitlements via son mécanisme notInArray, mais la table
-- usage_counters est indépendante du seeder et conserve donc des
-- rows historiques avec feature_key='ai.natal_reading.monthly' qui
-- ne sont plus jamais lues. On les supprime ici pour propreté.
--
-- 100% idempotent : DELETE sans match = no-op.
--
-- Le DELETE est aussi exécuté au boot via apps/api/src/boot/cleanup-
-- paywall-v3.ts (miroir TypeScript fidèle, comme tous les autres
-- inits de ce repo). Ce fichier .sql sert de trace d'audit.
-- ============================================================

-- 1) Suppression des compteurs orphelins
DELETE FROM "usage_counters"
WHERE "feature_key" = 'ai.natal_reading.monthly';
