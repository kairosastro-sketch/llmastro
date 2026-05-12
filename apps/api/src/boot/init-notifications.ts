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
import { dispatchDailyHoroscopeForAllUsers } from "../services/daily-horoscope-dispatcher.service.js";
import { translateEventNarrative } from "../services/event-narrative.service.js";
import { xaiService } from "../services/ai.service.js";

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

/**
 * DEDUP-KEY-DAY-V1 — migration data one-shot.
 *
 * Avant ce patch, `buildSkyEventDedupKey` incluait l'ISO complet de
 * l'event date (`...:2026-05-08T21:22:48.171Z`). Comme `sky-events`
 * calcule cette date par recherche binaire (`(lo + hi) / 2`), la
 * précision ms varie d'un run à l'autre — d'où des dedup_keys
 * différents pour le même événement et des notifs dupliquées.
 *
 * On normalise les dedup_keys existantes au format `...:YYYY-MM-DD`
 * pour qu'elles correspondent au format produit par le dispatcher
 * patché. Sans ça, le prochain run insérerait une 3ème notif (l'ancien
 * dedup_key full-ISO ne matche pas le nouveau dedup_key tronqué).
 *
 * Étapes :
 *   1) supprimer les doublons (garder le plus récent par
 *      [user_id, dedup_key tronqué]) ;
 *   2) tronquer les dedup_keys restantes au jour.
 *
 * Idempotent : sur une DB déjà migrée (rows `sky_event:...:YYYY-MM-DD`
 * sans `T`), les deux queries ne touchent à rien (rowCount = 0).
 */
export async function normalizeDedupKeysToDay(): Promise<{
  deletedDuplicates: number;
  truncatedKeys:     number;
}> {
  const client = await pool.connect();
  try {
    // 1) Supprime les doublons : pour chaque (user_id, dedup_key
    //    tronqué au jour), on garde la row la plus récente.
    const del = await client.query(`
      DELETE FROM notifications
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id,
                         regexp_replace(
                           dedup_key,
                           '^(sky_event:[a-z_]+:[a-z_]+:[0-9]{4}-[0-9]{2}-[0-9]{2}).*$',
                           '\\1'
                         )
            ORDER BY created_at DESC
          ) AS rn
          FROM notifications
          WHERE dedup_key LIKE 'sky_event:%'
        ) ranked
        WHERE rn > 1
      );
    `);

    // 2) Tronque les dedup_keys restantes (uniquement celles qui ont
    //    encore le suffixe T... — no-op si déjà tronquées).
    const upd = await client.query(`
      UPDATE notifications
      SET dedup_key = regexp_replace(
        dedup_key,
        '^(sky_event:[a-z_]+:[a-z_]+:[0-9]{4}-[0-9]{2}-[0-9]{2}).*$',
        '\\1'
      )
      WHERE dedup_key ~ '^sky_event:[a-z_]+:[a-z_]+:[0-9]{4}-[0-9]{2}-[0-9]{2}T';
    `);

    return {
      deletedDuplicates: del.rowCount ?? 0,
      truncatedKeys:     upd.rowCount ?? 0,
    };
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
 * BILINGUAL-KAIROS-BACKFILL-V1 — migration data one-shot.
 *
 * Avant l'introduction du format bilingue `{ fr, en }`, `data.kairosText`
 * était une `string` mono-langue figée au dispatch. Les rows existantes
 * en DB restent dans cet état après le deploy bilingue (le dedup_key
 * journalier empêche `insertSkyEventIfNew` de les recréer).
 *
 * Ce backfill scanne les rows legacy, traduit via xAI, et écrit le
 * format objet `{ [origLang]: text, [otherLang]: translated }`.
 *
 * Heuristique pour deviner `origLang` : `users.preferences.locale`
 * (langue courante de l'user, généralement la même qu'au dispatch
 * puisque les switches locale sont rares).
 *
 * Idempotent : ne touche qu'aux rows où `jsonb_typeof(data->'kairosText')
 * = 'string'`. Après update, le champ devient un object → re-runs skip.
 *
 * Failure mode par row :
 *   - Traduction succès → écrit `{ [origLang]: text, [otherLang]: translated }`
 *   - Traduction fail   → écrit `{ [origLang]: text }` (single-lang object,
 *                         marque comme processed, reader fallback à
 *                         l'autre lang ou FALLBACK_BODY)
 *
 * Skip total :
 *   - Si xAI n'est pas configuré (dev/staging sans clé) → log et return
 *     stats vides. Pas d'écriture en DB → re-essai au prochain boot
 *     une fois la clé en place.
 */
export async function backfillBilingualKairosText(
  logger: MinimalLogger,
): Promise<{
  scanned:    number;
  translated: number;
  marked:     number;
  errored:    number;
  skipped:    boolean;
}> {
  const stats = { scanned: 0, translated: 0, marked: 0, errored: 0, skipped: false };

  if (!xaiService.isConfigured()) {
    logger.warn("[backfill-bilingual] xAI not configured, skipping (will retry at next boot)");
    stats.skipped = true;
    return stats;
  }

  const result = await pool.query<{
    id:      string;
    user_id: string;
    text:    string;
    locale:  string | null;
  }>(`
    SELECT n.id, n.user_id, n.data->>'kairosText' AS text,
           u.preferences->>'locale' AS locale
    FROM notifications n
    JOIN users u ON u.id = n.user_id
    WHERE jsonb_typeof(n.data->'kairosText') = 'string'
      AND length(n.data->>'kairosText') > 0
  `);

  stats.scanned = result.rowCount ?? 0;
  if (stats.scanned === 0) return stats;

  logger.info({ count: stats.scanned }, "[backfill-bilingual] starting");

  for (const row of result.rows) {
    const origLang  = row.locale === "en" ? "en" : "fr";
    const otherLang = origLang === "fr" ? "en" : "fr";

    let translated: string | null = null;
    try {
      translated = await translateEventNarrative({
        text:   row.text,
        from:   origLang,
        to:     otherLang,
        userId: row.user_id,
      });
    } catch (err) {
      logger.warn(
        { err, notifId: row.id, from: origLang, to: otherLang },
        "[backfill-bilingual] translation failed, marking as single-lang JSONB",
      );
    }

    const kairos = translated
      ? { [origLang]: row.text, [otherLang]: translated }
      : { [origLang]: row.text };

    try {
      // Guard `jsonb_typeof = 'string'` dans le WHERE : si un autre
      // process (dispatcher concurrent) a déjà bilinguisé cette row
      // entre notre SELECT et notre UPDATE, on ne l'écrase pas.
      await pool.query(
        `UPDATE notifications
         SET data = jsonb_set(data, '{kairosText}', $1::jsonb)
         WHERE id = $2
           AND jsonb_typeof(data->'kairosText') = 'string'`,
        [JSON.stringify(kairos), row.id],
      );
      if (translated) stats.translated++; else stats.marked++;
    } catch (err) {
      logger.error({ err, notifId: row.id }, "[backfill-bilingual] UPDATE failed");
      stats.errored++;
    }
  }

  return stats;
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

const DAILY_HOROSCOPE_INTERVAL_MS = 60 * 60 * 1000; // 1h — scan horaire pour capter 8h locale chez chaque user

/**
 * DAILY-HOROSCOPE-NOTIF-V1
 *
 * Démarre le scheduler de la notif quotidienne d'horoscope. Scan toutes
 * les heures (24x/jour). Chaque exécution checke quels users ont 8h
 * locale NOW et n'ont pas encore reçu leur notif du jour.
 *
 * Idempotent : dedup_key journalier (`horoscope_daily:<userId>:<YYYY-MM-DD local>`)
 * empêche les doublons si la task tourne 2x entre 8h et 9h locale.
 *
 * À 6 users en prod, le scan horaire est trivial (~6 SELECT/h, la
 * majorité skip immédiat sur hour !== 8). Scale OK jusqu'à plusieurs
 * milliers d'users avant qu'on doive optimiser (batch par offset UTC).
 *
 * Ne throw jamais.
 */
export function startDailyHoroscopeScheduler(logger: MinimalLogger): void {
  const run = async () => {
    try {
      const stats = await dispatchDailyHoroscopeForAllUsers(logger);
      // Log seulement si du travail a été fait (sinon spam de "nothing to do" 23x/jour).
      if (stats.notificationsCreated > 0 || stats.errors > 0) {
        logger.info(stats, "[daily-horoscope] dispatch completed");
      }
    } catch (err) {
      logger.error({ err }, "[daily-horoscope] dispatch failed (full catch)");
    }
  };

  // Run immédiat au boot (capte un user à 8h s'il y en a un)
  void run();

  // Puis toutes les heures
  const interval = setInterval(() => {
    void run();
  }, DAILY_HOROSCOPE_INTERVAL_MS);

  interval.unref?.();
}

// NOTIFICATIONS-V1 init-notifications applied
