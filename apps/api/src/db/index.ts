import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err);
});

export const db = drizzle(pool, { schema });

export async function runMigrations(): Promise<void> {
  console.log("🔄 Initialisation PostgreSQL...");
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email          VARCHAR(255) NOT NULL UNIQUE,
        name           VARCHAR(100),
        avatar_url     TEXT,
        provider       VARCHAR(20) NOT NULL DEFAULT 'local',
        provider_id    VARCHAR(255),
        email_verified BOOLEAN NOT NULL DEFAULT false,
        password_hash  TEXT,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS natal_data (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label              VARCHAR(50) NOT NULL,
        birth_date         VARCHAR(10) NOT NULL,
        birth_time         VARCHAR(5) NOT NULL,
        birth_time_unknown BOOLEAN NOT NULL DEFAULT false,
        latitude           DOUBLE PRECISION NOT NULL,
        longitude          DOUBLE PRECISION NOT NULL,
        timezone           VARCHAR(50) NOT NULL,
        birth_city         VARCHAR(100) NOT NULL,
        birth_country      VARCHAR(100) NOT NULL,
        created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_natal_user    ON natal_data(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_user  ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token_hash);
    `);
    console.log("✅ Tables PostgreSQL prêtes");
  } finally {
    client.release();
  }
}

export { pool };
