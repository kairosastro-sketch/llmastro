-- ============================================================
-- 0015_email_verification_tokens.sql
-- ARCHIVE-AUTH-EMAIL-VERIFY-V1 · UP migration
--
-- Tokens uniques (one-shot) pour la vérification d'email après
-- signup local. Le token raw est envoyé dans l'email ; seul son
-- sha256 est stocké en DB (même pattern que refresh_tokens).
--
-- TTL : 24h, géré par le service. La colonne `expires_at` permet
-- au cron (boot/cleanup-tokens.ts) de purger les rows périmées.
-- `used_at` non-NULL = token déjà consommé (idempotence + audit).
--
-- Idempotente : CREATE … IF NOT EXISTS partout. Le fichier sert
-- de trace historique ; l'application au boot est faite par
-- boot/init-email-verification.ts (pattern miroir aligné sur
-- init-schema-coherence / ensureNotificationsSchema).
-- ============================================================

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash"  text NOT NULL UNIQUE,
  "expires_at"  timestamp NOT NULL,
  "used_at"     timestamp,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

-- Lookup des tokens actifs d'un user (utile pour resend : on
-- pourrait limiter à 1 token actif, mais V1 = simple insert).
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_active_idx"
  ON "email_verification_tokens"("user_id")
  WHERE "used_at" IS NULL;

-- Cible le cron de purge : range scan sur expires_at < NOW().
CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_idx"
  ON "email_verification_tokens"("expires_at")
  WHERE "used_at" IS NULL;

-- ARCHIVE-AUTH-EMAIL-VERIFY-V1 migration applied
