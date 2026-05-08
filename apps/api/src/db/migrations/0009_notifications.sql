-- ============================================================
-- 0009_notifications.sql
-- NOTIFICATIONS-V1 · UP migration
--
-- Phase 1 foundation : structure DB pour le système de notifications
-- d'événements cosmiques personnalisés (éclipses + lunaisons MVP).
--
-- 1) users.preferences (JSONB) : prefs de notification par utilisateur
--    (toggles types, seuil d'impact, fréquence email, locale).
--    Default '{}' → comportement = défauts hardcodés côté code.
--
-- 2) Table notifications : notifs persistées par le dispatcher
--    (boot task introduit en PR #D). Une notif = un user × un event
--    (ou system) avec un dedup_key UNIQUE pour idempotence.
--
-- Ne crée AUCUN service ni route — uniquement la structure de stockage.
-- ============================================================

-- 1) Préférences utilisateur (JSONB extensible)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            VARCHAR(32) NOT NULL,    -- 'sky_event' | 'system'
  data            JSONB NOT NULL,          -- payload structuré (cf. types TS)
  dedup_key       VARCHAR(255) NOT NULL,   -- ex: 'sky_event:eclipse:2026-09-08T17:24Z'
  read_at         TIMESTAMP,
  sent_email_at   TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Idempotence : un user ne reçoit jamais 2× la même notif
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedup_uq
  ON notifications(user_id, dedup_key);

-- Liste paginée des notifs d'un user (la plus récente en premier)
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

-- Badge "non-lues" : index partiel pour count rapide
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- NOTIFICATIONS-V1 migration applied
