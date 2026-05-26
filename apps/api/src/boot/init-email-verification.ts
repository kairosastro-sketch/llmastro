// ============================================================
// apps/api/src/boot/init-email-verification.ts
// ARCHIVE-AUTH-EMAIL-VERIFY-V1
// ------------------------------------------------------------
// Bootstrap idempotent de la table `email_verification_tokens`.
// Miroir fidèle de migrations/0015_email_verification_tokens.sql,
// inliné ici parce que runMigrations() ne lit pas les .sql en
// séquence (cf. db/index.ts + pattern init-schema-coherence /
// ensureNotificationsSchema).
//
// À appeler depuis main() avant le démarrage de la route
// /auth/verify-email pour garantir que la table existe au
// premier hit (sinon 500 silencieux à l'insert du token).
// ============================================================

import { pool } from "../db/index.js";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash"  text NOT NULL UNIQUE,
  "expires_at"  timestamp NOT NULL,
  "used_at"     timestamp,
  "created_at"  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_active_idx"
  ON "email_verification_tokens"("user_id")
  WHERE "used_at" IS NULL;

CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_idx"
  ON "email_verification_tokens"("expires_at")
  WHERE "used_at" IS NULL;
`;

export async function initEmailVerification(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.info("[initEmailVerification] ✅ Table email_verification_tokens prête");
  } catch (err) {
    console.error("[initEmailVerification] ❌ Échec application migration:", err);
    throw err;
  } finally {
    client.release();
  }
}

// ARCHIVE-AUTH-EMAIL-VERIFY-V1 applied
