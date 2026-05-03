// ============================================================
// apps/api/src/boot/init-schema-coherence.ts
// ------------------------------------------------------------
// ARCHIVE-SCHEMA-COHERENCE-V1
// Helper de boot : ajoute les colonnes manquantes pour combler
// le schema drift entre db/schema.ts (drizzle) et la chaîne
// de migrations exécutables.
//
// Pattern miroir des boot/init-* existants (init-readings,
// init-cities), mais sans garde "table exists" : ALTER TABLE
// ADD COLUMN IF NOT EXISTS est nativement idempotent.
//
// Colonnes ajoutées :
//   - users.deleted_at                  (soft-delete)
//   - natal_data.gender                 (profil natal)
//   - natal_data.relationship_status    (profil natal)
//
// Sur prod existant où ces colonnes ont été ajoutées
// manuellement, ce boot est un no-op silencieux (les ALTER
// ADD COLUMN IF NOT EXISTS ne font rien si la colonne existe).
// ============================================================

import { pool } from "../db/index.js";

// ------------------------------------------------------------
// SQL inliné (miroir fidèle de migrations/0007_schema_coherence.sql)
// ------------------------------------------------------------
const MIGRATION_SQL = `
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

ALTER TABLE "natal_data"
  ADD COLUMN IF NOT EXISTS "gender" varchar(20) NOT NULL DEFAULT 'unspecified';

ALTER TABLE "natal_data"
  ADD COLUMN IF NOT EXISTS "relationship_status" varchar(20) NOT NULL DEFAULT 'unspecified';
`;

// ------------------------------------------------------------
// Liste les colonnes manquantes (pour log informatif).
// Renvoie ["users.deleted_at", "natal_data.gender", ...] ou
// vide si tout est déjà présent.
// ------------------------------------------------------------
interface PgClient {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<{ exists?: boolean }> }>;
  release: () => void;
}

async function listMissingColumns(client: PgClient): Promise<string[]> {
  const expected: Array<{ table: string; column: string }> = [
    { table: "users",      column: "deleted_at" },
    { table: "natal_data", column: "gender" },
    { table: "natal_data", column: "relationship_status" },
  ];
  const missing: string[] = [];
  for (const { table, column } of expected) {
    const res = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) AS exists;`,
      [table, column],
    );
    if (res.rows[0]?.exists !== true) {
      missing.push(`${table}.${column}`);
    }
  }
  return missing;
}

// ------------------------------------------------------------
// Applique les ALTERs. Idempotent par design (IF NOT EXISTS
// au niveau Postgres + log informatif au niveau du boot).
// ------------------------------------------------------------
export async function initSchemaCoherence(): Promise<void> {
  const client = (await pool.connect()) as unknown as PgClient;
  try {
    const missing = await listMissingColumns(client);
    if (missing.length === 0) {
      console.info("[initSchemaCoherence] Toutes les colonnes sont déjà présentes.");
      return;
    }
    console.info(
      `[initSchemaCoherence] Colonnes manquantes : ${missing.join(", ")}. ` +
      `Application de la migration 0007…`,
    );
    await client.query(MIGRATION_SQL);
    console.info("[initSchemaCoherence] ✅ Migration 0007 appliquée");
  } catch (err) {
    console.error("[initSchemaCoherence] ❌ Échec application migration:", err);
    throw err;
  } finally {
    client.release();
  }
}
