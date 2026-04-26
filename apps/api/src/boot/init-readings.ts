// ============================================================
// apps/api/src/boot/init-readings.ts
// ------------------------------------------------------------
// ARCHIVE-PERSISTENCE-LECTURES-IA-V1
// Helper de boot : applique la migration SQL 0004 (ai_readings)
// si la table n'existe pas. Pattern miroir du fichier
// .sql inscrit dans db/migrations/0004_ai_readings.sql.
// ============================================================

import { pool } from "../db/index.js";

// ------------------------------------------------------------
// SQL inliné (miroir fidèle de migrations/0004_ai_readings.sql)
// ------------------------------------------------------------
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "ai_readings" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "natal_profile_id" uuid REFERENCES "natal_data"("id") ON DELETE CASCADE,
  "kind"             varchar(32) NOT NULL,
  "reading_key"      varchar(255) NOT NULL,
  "content"          jsonb NOT NULL,
  "prompt_version"   integer NOT NULL,
  "model"            varchar(100) NOT NULL,
  "generated_at"     timestamp NOT NULL DEFAULT NOW(),
  "regenerated_at"   timestamp,
  "regen_count"      integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_ai_readings_user_kind_key"
  ON "ai_readings" ("user_id", "kind", "reading_key");

CREATE INDEX IF NOT EXISTS "idx_ai_readings_user_kind"
  ON "ai_readings" ("user_id", "kind");

CREATE INDEX IF NOT EXISTS "idx_ai_readings_natal_profile"
  ON "ai_readings" ("natal_profile_id")
  WHERE "natal_profile_id" IS NOT NULL;
`;

// ------------------------------------------------------------
// Vérifie si la table existe déjà
// ------------------------------------------------------------
async function readingsTableExists(client: any): Promise<boolean> {
  const res = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'ai_readings'
    ) AS exists;
  `);
  return res.rows[0]?.exists === true;
}

// ------------------------------------------------------------
// Applique la migration si la table n'existe pas
// ------------------------------------------------------------
export async function initReadings(): Promise<void> {
  const client = await pool.connect();
  try {
    const exists = await readingsTableExists(client);
    if (exists) {
      console.info("[initReadings] Table ai_readings déjà présente.");
      return;
    }
    console.info("[initReadings] Table ai_readings absente, application de la migration 0004…");
    await client.query(MIGRATION_SQL);
    console.info("[initReadings] ✅ Migration 0004 appliquée");
  } catch (err) {
    console.error("[initReadings] ❌ Échec application migration:", err);
    throw err;
  } finally {
    client.release();
  }
}
