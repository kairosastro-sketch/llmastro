// ============================================================
// apps/api/src/boot/init-chat.ts
// ------------------------------------------------------------
// ARCHIVE-SCHEMA-COHERENCE-V1 (livre la migration 0006 manquante au boot)
//
// Helper de boot : applique les tables chat_* de la migration
// 0006_chat_persistence.sql si elles n'existent pas. Pattern
// miroir d'init-readings.ts.
//
// IMPORTANT : on N'INLINE PAS les INSERT entitlements
// (chat_save_count / chat_save_ttl_days) du fichier 0006.sql.
// Ces entitlements sont gérés via plans.config.ts → plans.seed.ts
// (lui-même appelé par bootTiers) qui est la source de vérité
// unique. Inliner les INSERTs ici risquerait d'écraser les
// valeurs typesafe (notamment ttl_days = -1 pour essential/
// premium au lieu de 0 legacy de la migration).
// ============================================================

import { pool } from "../db/index.js";

// ------------------------------------------------------------
// SQL inliné — tables + indexes UNIQUEMENT (miroir partiel
// de migrations/0006_chat_persistence.sql, sans les INSERTs
// entitlements obsolètes)
// ------------------------------------------------------------
const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "chat_conversations" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "natal_profile_id" uuid REFERENCES "natal_data"("id") ON DELETE SET NULL,
  "planet_key"       varchar(20) NOT NULL,
  "title"            varchar(255),
  "created_at"       timestamp NOT NULL DEFAULT now(),
  "last_message_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "chat_conversations_user_time_idx"
  ON "chat_conversations" ("user_id", "last_message_at" DESC);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  "role"            varchar(20) NOT NULL,
  "content"         text NOT NULL,
  "created_at"      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "chat_messages_conv_time_idx"
  ON "chat_messages" ("conversation_id", "created_at");
`;

// ------------------------------------------------------------
// Vérifie si la table principale existe déjà
// ------------------------------------------------------------
interface PgClient {
  query: (sql: string) => Promise<{ rows: Array<{ exists?: boolean }> }>;
  release: () => void;
}

async function chatTableExists(client: PgClient): Promise<boolean> {
  const res = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'chat_conversations'
    ) AS exists;
  `);
  return res.rows[0]?.exists === true;
}

// ------------------------------------------------------------
// Applique la migration si la table n'existe pas
// ------------------------------------------------------------
export async function initChat(): Promise<void> {
  const client = (await pool.connect()) as unknown as PgClient;
  try {
    const exists = await chatTableExists(client);
    if (exists) {
      console.info("[initChat] Tables chat_* déjà présentes.");
      return;
    }
    console.info("[initChat] Tables chat_* absentes, application de la migration 0006…");
    await client.query(MIGRATION_SQL);
    console.info("[initChat] ✅ Migration 0006 (tables) appliquée");
  } catch (err) {
    console.error("[initChat] ❌ Échec application migration:", err);
    throw err;
  } finally {
    client.release();
  }
}
