// ============================================================
// apps/api/src/boot/init-notifications.ts
// NOTIFICATIONS-V1
// ------------------------------------------------------------
// Boot task : démarre le dispatcher de notifications
// (cf. notification-dispatcher.service.ts) au boot, puis le
// programme toutes les 6h.
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

import { dispatchNotificationsForAllUsers } from "../services/notification-dispatcher.service.js";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 heures

interface MinimalLogger {
  info:  (...a: any[]) => void;
  warn:  (...a: any[]) => void;
  error: (...a: any[]) => void;
}

/**
 * Démarre le dispatcher au boot puis programme une exécution toutes
 * les 6h. À appeler depuis index.ts main() après runMigrations() et
 * après que la DB est prête.
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
