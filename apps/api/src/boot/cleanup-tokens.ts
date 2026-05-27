// ============================================================
// apps/api/src/boot/cleanup-tokens.ts
// ------------------------------------------------------------
// Nettoyage automatique des tokens expirés :
//   - refresh_tokens (auth.service / SECURITY-V1)
//   - email_verification_tokens (ARCHIVE-AUTH-EMAIL-VERIFY-V1) :
//     on purge à la fois les expirés ET les `used_at` plus
//     vieux que 7 jours (audit court — un user qui se demande
//     "ai-je validé mon email ?" peut interroger dans la semaine).
//
// Strategy : DELETE au boot puis toutes les heures via setInterval.
// ============================================================

import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 heure
const USED_TOKEN_RETENTION_DAYS = 7;

/**
 * Supprime tous les refresh tokens dont la date d'expiration
 * est passée. Logge le nombre supprimé.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM refresh_tokens
      WHERE expires_at < NOW()
      RETURNING 1
    )
    SELECT COUNT(*)::text AS count FROM deleted;
  `);
  const n = parseInt(result.rows[0]?.count ?? "0", 10);
  return n;
}

/**
 * ARCHIVE-AUTH-EMAIL-VERIFY-V1
 * Purge les tokens de vérif périmés (expirés sans usage) et les
 * tokens consommés au-delà de la fenêtre de rétention.
 */
export async function cleanupExpiredVerificationTokens(): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM email_verification_tokens
      WHERE (used_at IS NULL     AND expires_at < NOW())
         OR (used_at IS NOT NULL AND used_at    < NOW() - (${USED_TOKEN_RETENTION_DAYS} * INTERVAL '1 day'))
      RETURNING 1
    )
    SELECT COUNT(*)::text AS count FROM deleted;
  `);
  const n = parseInt(result.rows[0]?.count ?? "0", 10);
  return n;
}

/**
 * AUTH-PASSWORD-RECOVERY-V1
 * Purge les tokens de reset mdp périmés (expirés sans usage) et
 * les tokens consommés au-delà de la fenêtre de rétention.
 */
export async function cleanupExpiredPasswordResetTokens(): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    WITH deleted AS (
      DELETE FROM password_reset_tokens
      WHERE (used_at IS NULL     AND expires_at < NOW())
         OR (used_at IS NOT NULL AND used_at    < NOW() - (${USED_TOKEN_RETENTION_DAYS} * INTERVAL '1 day'))
      RETURNING 1
    )
    SELECT COUNT(*)::text AS count FROM deleted;
  `);
  const n = parseInt(result.rows[0]?.count ?? "0", 10);
  return n;
}

/**
 * Lance le cleanup au boot et programme une exécution
 * toutes les heures. À appeler depuis index.ts après
 * runMigrations().
 */
export function startTokenCleanup(logger: { info: (...a: any[]) => void; error: (...a: any[]) => void }): void {
  const run = async () => {
    try {
      const refresh = await cleanupExpiredTokens();
      if (refresh > 0) {
        logger.info({ deleted: refresh }, "[cleanup-tokens] expired refresh tokens removed");
      }
      const verif = await cleanupExpiredVerificationTokens();
      if (verif > 0) {
        logger.info({ deleted: verif }, "[cleanup-tokens] expired/consumed email verification tokens removed");
      }
      const reset = await cleanupExpiredPasswordResetTokens();
      if (reset > 0) {
        logger.info({ deleted: reset }, "[cleanup-tokens] expired/consumed password reset tokens removed");
      }
    } catch (err) {
      logger.error({ err }, "[cleanup-tokens] failed");
    }
  };

  // Run immédiatement au boot
  void run();

  // Puis toutes les heures
  const interval = setInterval(() => { void run(); }, CLEANUP_INTERVAL_MS);

  // Cleanup au shutdown — empêche le process de rester actif
  // s'il reçoit SIGTERM/SIGINT pendant qu'on attend la prochaine exécution.
  interval.unref?.();
}
