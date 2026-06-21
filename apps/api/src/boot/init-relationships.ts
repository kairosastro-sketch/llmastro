// RELATIONSHIPS-V1 — boot task idempotent.
// Ajoute le tag relationnel (catégorie + sous-type) sur natal_data.
// Même esprit que init-community.ts : DDL IF NOT EXISTS, rejouable.
import { pool } from "../db/index.js";

const MIGRATION_SQL = `
  ALTER TABLE natal_data
    ADD COLUMN IF NOT EXISTS relationship_category VARCHAR(20) NOT NULL DEFAULT 'unspecified';
  ALTER TABLE natal_data
    ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(32) NOT NULL DEFAULT 'unspecified';
`;

export async function initRelationships(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.log("✅ [init-relationships] colonnes relationnelles prêtes");
  } finally {
    client.release();
  }
}
