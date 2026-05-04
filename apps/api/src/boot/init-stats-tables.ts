// ============================================================
// ADMIN-STATS-V1-BACKEND
// apps/api/src/boot/init-stats-tables.ts
// ------------------------------------------------------------
// Crée idempotemment les 2 tables de tracking pour le module
// admin stats :
//   - xai_calls_log  : logs des appels Grok (1 row par appel API)
//   - login_events   : logs des connexions (long-terme, ne purge pas)
//
// ON DELETE SET NULL pour user_id : on conserve l'historique
// agrégé même après suppression d'un user (purge soft-delete).
// ============================================================

import { pool } from "../db/index.js";

export async function initStatsTables(): Promise<void> {
  // ───── xai_calls_log ─────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS xai_calls_log (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      model       VARCHAR(100) NOT NULL,
      tokens_in   INTEGER NOT NULL DEFAULT 0,
      tokens_out  INTEGER NOT NULL DEFAULT 0,
      latency_ms  INTEGER NOT NULL DEFAULT 0,
      success     BOOLEAN NOT NULL,
      error_kind  VARCHAR(64),
      created_at  TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS xai_calls_log_created_at_idx
    ON xai_calls_log (created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS xai_calls_log_user_idx
    ON xai_calls_log (user_id, created_at DESC)
  `);

  // ───── login_events ─────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      email       VARCHAR(255) NOT NULL,
      kind        VARCHAR(20) NOT NULL,
      success     BOOLEAN NOT NULL,
      error_code  VARCHAR(50),
      ip          VARCHAR(45),
      user_agent  TEXT,
      created_at  TIMESTAMP NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS login_events_created_at_idx
    ON login_events (created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS login_events_user_idx
    ON login_events (user_id, created_at DESC)
  `);

  // eslint-disable-next-line no-console
  console.log("[init-stats-tables] xai_calls_log + login_events ready");
}

// ADMIN-STATS-V1-BACKEND applied
