// ============================================================
// ANALYTICS-V1
// apps/api/src/boot/init-analytics-tables.ts
// ------------------------------------------------------------
// Crée idempotemment la table `page_views` : mesure d'audience
// first-party (pages vues + temps actif) pour tous les visiteurs
// (anonymes via cookie `aid`, ou rattachés à un user via JWT).
//
// ON DELETE SET NULL pour user_id : on conserve l'historique
// agrégé même après suppression d'un user (purge soft-delete).
// ============================================================

import { pool } from "../db/index.js";

export async function initAnalyticsTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_views (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      session_id  VARCHAR(64)  NOT NULL,
      path        VARCHAR(255) NOT NULL,
      active_ms   INTEGER      NOT NULL DEFAULT 0,
      referrer    VARCHAR(255),
      created_at  TIMESTAMP    NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS page_views_created_at_idx
    ON page_views (created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS page_views_path_idx
    ON page_views (path)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS page_views_session_idx
    ON page_views (session_id, created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS page_views_user_idx
    ON page_views (user_id, created_at DESC)
  `);

  // eslint-disable-next-line no-console
  console.log("[init-analytics-tables] page_views ready");
}

// ANALYTICS-V1 applied
