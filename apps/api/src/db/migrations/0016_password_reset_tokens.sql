-- ============================================================
-- 0016_password_reset_tokens.sql
-- AUTH-PASSWORD-RECOVERY-V1 · UP migration
--
-- Tokens uniques (one-shot) pour le flow « mot de passe oublié ».
-- Le token raw est envoyé dans l'email ; seul son sha256 est
-- stocké en DB (même pattern que refresh_tokens et
-- email_verification_tokens).
--
-- TTL : 1h, géré par le service (porteur d'un changement de
-- credential → fenêtre courte). Le cron (boot/cleanup-tokens.ts)
-- purge les rows périmées et celles déjà consommées au-delà
-- de 7 jours d'audit.
--
-- Idempotente : CREATE … IF NOT EXISTS partout. Le fichier sert
-- de trace historique ; l'application au boot est faite par
-- boot/init-password-reset.ts (pattern miroir aligné sur
-- init-email-verification).
-- ============================================================

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash"  text NOT NULL UNIQUE,
  "expires_at"  timestamp NOT NULL,
  "used_at"     timestamp,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

-- Lookup des tokens actifs d'un user (anti-flood : on peut limiter
-- à 1 token actif si besoin, V1 = simple insert avec rate-limit côté route).
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_active_idx"
  ON "password_reset_tokens"("user_id")
  WHERE "used_at" IS NULL;

-- Cible le cron de purge : range scan sur expires_at < NOW().
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_idx"
  ON "password_reset_tokens"("expires_at")
  WHERE "used_at" IS NULL;

-- AUTH-PASSWORD-RECOVERY-V1 migration applied
