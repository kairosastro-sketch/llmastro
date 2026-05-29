// COMMUNITY-V1 — boot task idempotent.
// Applique au runtime la DDL de 0018_community.sql (mêmes instructions, IF NOT EXISTS),
// dans le même esprit que init-promo-codes.ts / init-readings.ts.
import { pool } from "../db/index.js";

const MIGRATION_SQL = `
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS community_stats_opt_in BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS community_opt_in_at TIMESTAMPTZ;

  ALTER TABLE natal_data
    ADD COLUMN IF NOT EXISTS is_self BOOLEAN NOT NULL DEFAULT false;
  CREATE UNIQUE INDEX IF NOT EXISTS natal_data_one_self_per_user
    ON natal_data (user_id) WHERE is_self;

  CREATE TABLE IF NOT EXISTS community_placements (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    planet      VARCHAR(16) NOT NULL,
    sign        VARCHAR(16) NOT NULL,
    sign_degree INTEGER,
    house       INTEGER,
    element     VARCHAR(8)  NOT NULL,
    modality    VARCHAR(8)  NOT NULL,
    PRIMARY KEY (user_id, planet)
  );
  CREATE INDEX IF NOT EXISTS community_placements_planet_sign ON community_placements (planet, sign);
  CREATE INDEX IF NOT EXISTS community_placements_planet_elem ON community_placements (planet, element);
`;

export async function initCommunity(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(MIGRATION_SQL);
    console.log("✅ [init-community] tables prêtes");
  } finally {
    client.release();
  }
}
