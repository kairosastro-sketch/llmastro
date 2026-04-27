// ============================================================
// apps/api/src/boot/cleanup-tokens.ts
// ------------------------------------------------------------
// Nettoyage automatique des refresh tokens expirés.
//
// Pourquoi : sans cleanup, la table refresh_tokens grossit
// indéfiniment (chaque login crée une ligne, jamais supprimée
// si l'utilisateur ne fait pas explicitement /auth/logout).
//
// Strategy : DELETE des lignes dont expires_at < NOW() au boot
// puis toutes les heures via setInterval.
// ============================================================

import { sql } from "drizzle-orm";
import { db } from "../db/index.js";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

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
 * Lance le cleanup au boot et programme une exécution
 * toutes les heures. À appeler depuis index.ts après
 * runMigrations().
 */
export function startTokenCleanup(logger: { info: (...a: any[]) => void; error: (...a: any[]) => void }): void {
  const run = async () => {
    try {
      const n = await cleanupExpiredTokens();
      if (n > 0) {
        logger.info({ deleted: n }, "[cleanup-tokens] expired refresh tokens removed");
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
