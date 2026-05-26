-- ============================================================
-- 0013_push_subscriptions.sql
-- WEB-PUSH-V1 · UP migration
--
-- Stockage des abonnements Web Push (RFC 8292) par utilisateur.
-- Un user peut avoir N subscriptions (1 par device/navigateur ; on
-- ne dédoublonne que par endpoint, jamais par user).
--
-- L'endpoint est l'URL unique fournie par le push service du
-- navigateur (Mozilla / FCM Chrome / Apple Web Push). p256dh +
-- auth sont les clés ECDH fournies par `PushSubscription.toJSON()`
-- côté client, nécessaires au chiffrement aes128gcm du payload.
--
-- Le table est créée IF NOT EXISTS — pattern aligné sur les autres
-- migrations (idempotent, re-runable). L'init code TS dans
-- `boot/init-notifications.ts` inline la même DDL pour cohérence
-- avec les autres tables init-style.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  user_agent    TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Un endpoint ne doit jamais exister 2x — si le navigateur ré-émet une
-- subscription identique (cas typique au reload de la page), on UPSERT
-- via ON CONFLICT (endpoint) côté code.
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_uq
  ON push_subscriptions(endpoint);

-- Lookup par user_id (dispatch : "envoie à tous les devices de cet user").
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions(user_id);

-- WEB-PUSH-V1 migration applied
