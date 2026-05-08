// ============================================================
// apps/api/src/boot/init-notifications.ts
// NOTIFICATIONS-V1 + NOTIFS-SCHEMA-BOOTSTRAP-V1
// ------------------------------------------------------------
// Deux responsabilités exposées :
//
//   1) ensureNotificationsSchema()  — applique la structure DB
//      (miroir de migrations/0009_notifications.sql). Pattern
//      aligné sur init-readings.ts / init-schema-coherence.ts :
//      le code TS inline ses tables/colonnes en `IF NOT EXISTS`,
//      les fichiers .sql servant uniquement de trace historique.
//      À appeler depuis main() avant le dispatcher.
//
//   2) startNotificationDispatcher() — démarre le dispatcher au
//      boot puis le programme toutes les 6h.
//
// Pourquoi 6h et pas 1h comme init-sky :
//   - les events sky changent rarement dans une fenêtre de 7 jours
//   - chaque dispatch coûte 1 calc natal + N appels LLM par user
//   - 4 dispatches/jour suffisent pour capter les events qui
//     entrent dans la fenêtre (ils ne disparaissent pas avant
//     la fin de leur date)
//   - réduction du coût xAI / GPU / DB
//
// Pattern aligné sur init-sky.ts : setInterval avec .unref()
// pour ne pas bloquer SIGTERM.
// ============================================================

import { pool } from "../db/index.js";
import { dispatchNotificationsForAllUsers } from "../services/notification-dispatcher.service.js";

// ------------------------------------------------------------
// SQL inliné (miroir fidèle de migrations/0009_notifications.sql)
// Idempotent : ALTER ADD COLUMN IF NOT EXISTS,
// CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
// ------------------------------------------------------------
const MIGRATION_SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            VARCHAR(32) NOT NULL,
  data            JSONB NOT NULL,
  dedup_key       VARCHAR(255) NOT NULL,
  read_at         TIMESTAMP,
  sent_email_at   TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedup_uq
  ON notifications(user_id, dedup_key);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
`;

/**
 * Bootstrap du schéma notifications. À appeler depuis main()
 * avant startNotificationDispatcher (et avant que les routes
 * /notifications acceptent du trafic).
 *
 * Idempotent : peut être ré-exécuté à chaque boot sans effet
 * sur une DB déjà à jour.
 */
export async function ensureNotificationsSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
  } finally {
    client.release();
  }
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 heures

interface MinimalLogger {
  info:  (...a: any[]) => void;
  warn:  (...a: any[]) => void;
  error: (...a: any[]) => void;
}

/**
 * Démarre le dispatcher au boot puis programme une exécution toutes
 * les 6h. À appeler depuis index.ts main() après que la DB est prête
 * et après ensureNotificationsSchema().
 *
 * Ne throw jamais : toute erreur du dispatch est attrapée et loggée
 * pour ne pas crasher le boot ni le scheduler.
 */
export function startNotificationDispatcher(logger: MinimalLogger): void {
  const run = async () => {
    try {
      const stats = await dispatchNotificationsForAllUsers(logger);
      logger.info(
        {
          usersProcessed:       stats.usersProcessed,
          notificationsCreated: stats.notificationsCreated,
          notificationsSkipped: stats.notificationsSkipped,
          errorsCount:          stats.errorsCount,
          candidateEvents:      stats.candidateEvents,
          windowStart:          stats.windowStart,
          windowEnd:            stats.windowEnd,
        },
        "[init-notifications] dispatch completed",
      );
    } catch (err) {
      logger.error({ err }, "[init-notifications] dispatch failed (full catch)");
    }
  };

  // Run immédiat au boot
  void run();

  // Puis toutes les 6h
  const interval = setInterval(() => {
    void run();
  }, CHECK_INTERVAL_MS);

  // Empêche le timer de bloquer le shutdown SIGTERM/SIGINT
  interval.unref?.();
}

// NOTIFICATIONS-V1 init-notifications applied
