// ============================================================
// apps/api/src/boot/init-password-reset.ts
// AUTH-PASSWORD-RECOVERY-V1
// ------------------------------------------------------------
// Bootstrap idempotent de la table `password_reset_tokens`.
// Miroir fidèle de migrations/0016_password_reset_tokens.sql,
// inliné ici parce que runMigrations() ne lit pas les .sql en
// séquence (cf. pattern init-email-verification.ts).
//
// À appeler depuis main() avant le démarrage des routes
// /auth/request-password-reset et /auth/reset-password.
// ============================================================

import { pool } from "../db/index.js";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash"  text NOT NULL UNIQUE,
  "expires_at"  timestamp NOT NULL,
  "used_at"     timestamp,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_active_idx"
  ON "password_reset_tokens"("user_id")
  WHERE "used_at" IS NULL;

CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_idx"
  ON "password_reset_tokens"("expires_at")
  WHERE "used_at" IS NULL;
`;

export async function initPasswordReset(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.info("[initPasswordReset] ✅ Table password_reset_tokens prête");
  } catch (err) {
    console.error("[initPasswordReset] ❌ Échec application migration:", err);
    throw err;
  } finally {
    client.release();
  }
}

// AUTH-PASSWORD-RECOVERY-V1 applied
