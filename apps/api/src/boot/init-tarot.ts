// ============================================================
// apps/api/src/boot/init-tarot.ts
// ------------------------------------------------------------
// TAROT-PERSISTENCE-V1
//
// Helper de boot : applique la table tarot_readings de la
// migration 0011_tarot_persistence.sql si elle n'existe pas.
// Pattern miroir d'init-chat.ts.
//
// IMPORTANT : on N'INLINE PAS d'INSERT entitlement (tarot_save_count).
// Cet entitlement est géré via plans.config.ts → seed-plans.ts
// (bootTiers), source de vérité unique.
// ============================================================

import { pool } from "../db/index.js";

// ------------------------------------------------------------
// SQL inliné — table + index UNIQUEMENT (miroir de
// migrations/0011_tarot_persistence.sql)
// Idempotent : CREATE TABLE / CREATE INDEX IF NOT EXISTS.
// ------------------------------------------------------------
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "tarot_readings" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "natal_profile_id" uuid REFERENCES "natal_data"("id") ON DELETE SET NULL,
  "title"            varchar(255),
  "data"             jsonb NOT NULL,
  "created_at"       timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tarot_readings_user_time_idx"
  ON "tarot_readings" ("user_id", "created_at" DESC);
`;

// ------------------------------------------------------------
// Vérifie si la table existe déjà
// ------------------------------------------------------------
interface PgClient {
  query: (sql: string) => Promise<{ rows: Array<{ exists?: boolean }> }>;
  release: () => void;
}

async function tarotTableExists(client: PgClient): Promise<boolean> {
  const res = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tarot_readings'
    ) AS exists;
  `);
  return res.rows[0]?.exists === true;
}

// ------------------------------------------------------------
// Applique la migration si la table n'existe pas
// ------------------------------------------------------------
export async function initTarot(): Promise<void> {
  const client = (await pool.connect()) as unknown as PgClient;
  try {
    const exists = await tarotTableExists(client);
    if (exists) {
      console.info("[initTarot] Table tarot_readings déjà présente.");
      return;
    }
    console.info("[initTarot] Table tarot_readings absente, application de la migration 0011…");
    await client.query(MIGRATION_SQL);
    console.info("[initTarot] ✅ Migration 0011 (table) appliquée");
  } catch (err) {
    console.error("[initTarot] ❌ Échec application migration:", err);
    throw err;
  } finally {
    client.release();
  }
}
